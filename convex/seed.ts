import { mutation } from "./_generated/server";
import { v } from "convex/values";
import { requerirSesion } from "./auth";
import type { Id } from "./_generated/dataModel";
import {
  TARIFA_POR_DEFECTO,
  calcularConsumo,
  calcularMontoConsumo,
  calcularMontoTotal,
  ultimoDiaDelMes,
} from "./lib";

type Estado = "por_pagar" | "en_revision" | "pagado";
type Multa = { tipo: "mora" | "minga" | "otro"; descripcion: string; monto: number };

// Una lectura mensual de la muestra. lecturaAnterior se encadena automáticamente.
type Lectura = {
  anio: number;
  mes: number;
  lecturaActual: number;
  estado: Estado;
  fechaPago?: string;
  multas?: Multa[];
};

type SocioEjemplo = {
  cedula: string;
  nombres: string;
  apellidos: string;
  direccion?: string;
  telefono?: string;
  numeroMedidor?: string;
  lecturaInicial: number;
  lecturas: Lectura[];
};

/**
 * Carga datos de ejemplo para la muestra: tarifa, cuenta bancaria, socios y varias
 * planillas por socio a lo largo de 2 años (2025–2026), en distintos estados.
 * No hace nada si ya existen socios. Requiere sesión.
 */
export const sembrarEjemplo = mutation({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    await requerirSesion(ctx, token);

    const yaHay = await ctx.db.query("socios").take(1);
    if (yaHay.length > 0) {
      return { creados: 0, mensaje: "Ya existen datos de ejemplo." };
    }

    // Tarifa de la muestra.
    if (!(await ctx.db.query("tarifa").first())) {
      await ctx.db.insert("tarifa", TARIFA_POR_DEFECTO);
    }

    // Cuenta bancaria ficticia.
    if (!(await ctx.db.query("config").first())) {
      await ctx.db.insert("config", {
        banco: "Banco del Austro",
        tipoCuenta: "Ahorros",
        numeroCuenta: "1234567890",
        titular: "Junta de Agua",
        identificacionTitular: "0190000000001",
      });
    }

    const socios: SocioEjemplo[] = [
      {
        cedula: "0102030405",
        nombres: "María Rosa",
        apellidos: "Guamán Pineda",
        direccion: "Sector La Loma",
        telefono: "0991000001",
        numeroMedidor: "MED-001",
        lecturaInicial: 100,
        lecturas: [
          { anio: 2025, mes: 10, lecturaActual: 112, estado: "pagado", fechaPago: "2025-10-28" },
          { anio: 2025, mes: 11, lecturaActual: 125, estado: "pagado", fechaPago: "2025-11-27" },
          { anio: 2025, mes: 12, lecturaActual: 139, estado: "pagado", fechaPago: "2025-12-29" },
          { anio: 2026, mes: 6, lecturaActual: 154, estado: "pagado", fechaPago: "2026-06-30" },
          { anio: 2026, mes: 7, lecturaActual: 176, estado: "por_pagar" },
        ],
      },
      {
        cedula: "0203040506",
        nombres: "José Manuel",
        apellidos: "Quizhpi Tenesaca",
        direccion: "Vía Principal",
        telefono: "0991000002",
        numeroMedidor: "MED-002",
        lecturaInicial: 80,
        lecturas: [
          { anio: 2025, mes: 11, lecturaActual: 90, estado: "pagado", fechaPago: "2025-11-20" },
          { anio: 2025, mes: 12, lecturaActual: 98, estado: "pagado", fechaPago: "2025-12-22" },
          { anio: 2026, mes: 6, lecturaActual: 108, estado: "pagado", fechaPago: "2026-06-25" },
          { anio: 2026, mes: 7, lecturaActual: 116, estado: "en_revision" },
        ],
      },
      {
        cedula: "0304050607",
        nombres: "Rosa Elena",
        apellidos: "Lema Chuqui",
        direccion: "Sector El Mirador",
        telefono: "0991000003",
        numeroMedidor: "MED-003",
        lecturaInicial: 200,
        lecturas: [
          { anio: 2025, mes: 12, lecturaActual: 214, estado: "pagado", fechaPago: "2025-12-18" },
          { anio: 2026, mes: 6, lecturaActual: 226, estado: "pagado", fechaPago: "2026-06-28" },
          {
            anio: 2026,
            mes: 7,
            lecturaActual: 250,
            estado: "por_pagar",
            multas: [{ tipo: "minga", descripcion: "Inasistencia a minga", monto: 5 }],
          },
        ],
      },
      {
        cedula: "0405060708",
        nombres: "Segundo Luis",
        apellidos: "Cabrera Ortiz",
        direccion: "Centro",
        telefono: "0991000004",
        numeroMedidor: "MED-004",
        lecturaInicial: 40,
        lecturas: [
          { anio: 2025, mes: 12, lecturaActual: 52, estado: "pagado", fechaPago: "2025-12-15" },
          { anio: 2026, mes: 6, lecturaActual: 65, estado: "pagado", fechaPago: "2026-06-20" },
          {
            anio: 2026,
            mes: 7,
            lecturaActual: 78,
            estado: "por_pagar",
            multas: [{ tipo: "mora", descripcion: "Pago atrasado del mes anterior", monto: 1 }],
          },
        ],
      },
      {
        cedula: "0506070809",
        nombres: "Ana Lucía",
        apellidos: "Morocho Sisa",
        direccion: "Sector La Quebrada",
        telefono: "0991000005",
        numeroMedidor: "MED-005",
        lecturaInicial: 300,
        lecturas: [
          { anio: 2025, mes: 11, lecturaActual: 312, estado: "pagado", fechaPago: "2025-11-29" },
          { anio: 2025, mes: 12, lecturaActual: 324, estado: "pagado", fechaPago: "2025-12-30" },
          { anio: 2026, mes: 6, lecturaActual: 336, estado: "pagado", fechaPago: "2026-06-27" },
          { anio: 2026, mes: 7, lecturaActual: 348, estado: "por_pagar" },
        ],
      },
    ];

    const tarifa = TARIFA_POR_DEFECTO;
    let creados = 0;

    for (const s of socios) {
      const socioId: Id<"socios"> = await ctx.db.insert("socios", {
        cedula: s.cedula,
        nombres: s.nombres,
        apellidos: s.apellidos,
        direccion: s.direccion,
        telefono: s.telefono,
        numeroMedidor: s.numeroMedidor,
        lecturaInicial: s.lecturaInicial,
        activo: true,
      });
      creados++;

      // Encadenar lecturas en orden cronológico.
      const enOrden = [...s.lecturas].sort((a, b) =>
        a.anio !== b.anio ? a.anio - b.anio : a.mes - b.mes,
      );
      let lecturaAnterior = s.lecturaInicial;
      for (const l of enOrden) {
        const consumo = calcularConsumo(lecturaAnterior, l.lecturaActual);
        const montoConsumo = calcularMontoConsumo(consumo, tarifa);
        const multas = l.multas ?? [];
        const montoTotal = calcularMontoTotal(montoConsumo, multas);
        await ctx.db.insert("planillas", {
          socioId,
          anio: l.anio,
          mes: l.mes,
          lecturaAnterior,
          lecturaActual: l.lecturaActual,
          consumo,
          montoConsumo,
          multas,
          montoTotal,
          estado: l.estado,
          fechaLimite: ultimoDiaDelMes(l.anio, l.mes),
          fechaPago: l.fechaPago,
        });
        lecturaAnterior = l.lecturaActual;
      }
    }

    return { creados };
  },
});
