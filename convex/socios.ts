import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { normalizar, soloDigitos } from "./lib";

/**
 * Consulta pública: busca un socio por cédula + apellido.
 * El apellido puede ser el completo o solo el primero.
 * Devuelve { encontrado: boolean, socio? }.
 */
export const buscar = query({
  args: { cedula: v.string(), apellido: v.string() },
  handler: async (ctx, { cedula, apellido }) => {
    const ced = soloDigitos(cedula);
    if (!ced) return { encontrado: false as const };

    const socio = await ctx.db
      .query("socios")
      .withIndex("by_cedula", (q) => q.eq("cedula", ced))
      .first();

    if (!socio) return { encontrado: false as const };

    const apBuscado = normalizar(apellido);
    const apellidos = normalizar(socio.apellidos);
    const primerApellido = apellidos.split(/\s+/)[0] ?? "";
    if (apBuscado !== apellidos && apBuscado !== primerApellido) {
      return { encontrado: false as const };
    }

    return { encontrado: true as const, socio };
  },
});

/** Lista todos los socios, ordenados por apellido (para el panel del tesorero). */
export const listar = query({
  args: {},
  handler: async (ctx) => {
    const socios = await ctx.db.query("socios").collect();
    return socios.sort((a, b) =>
      normalizar(a.apellidos).localeCompare(normalizar(b.apellidos)),
    );
  },
});

/**
 * Carga datos de ejemplo (para la muestra). No hace nada si ya existen socios.
 * Así el flujo se puede probar de inmediato desde el panel.
 */
export const sembrarEjemplo = mutation({
  args: {},
  handler: async (ctx) => {
    const yaHay = await ctx.db.query("socios").take(1);
    if (yaHay.length > 0) {
      return { creados: 0, mensaje: "Ya existen datos de ejemplo." };
    }

    const ejemplos = [
      {
        cedula: "0102030405", nombres: "María Rosa", apellidos: "Guamán Pineda",
        direccion: "Sector La Loma", lecturaAnterior: 120, lecturaActual: 135,
        montoDeuda: 6.5, mes: "Julio 2026", fechaLimite: "2026-07-31",
        estado: "por_pagar" as const,
      },
      {
        cedula: "0203040506", nombres: "José Manuel", apellidos: "Quizhpi Tenesaca",
        direccion: "Vía Principal", lecturaAnterior: 88, lecturaActual: 96,
        montoDeuda: 4.0, mes: "Julio 2026", fechaLimite: "2026-07-31",
        estado: "en_revision" as const,
      },
      {
        cedula: "0304050607", nombres: "Rosa Elena", apellidos: "Lema Chuqui",
        direccion: "Sector El Mirador", lecturaAnterior: 200, lecturaActual: 210,
        montoDeuda: 5.0, mes: "Julio 2026", fechaLimite: "2026-07-31",
        estado: "pagado" as const,
      },
      {
        cedula: "0405060708", nombres: "Segundo Luis", apellidos: "Cabrera Ortiz",
        direccion: "Centro", lecturaAnterior: 45, lecturaActual: 58,
        montoDeuda: 6.0, mes: "Julio 2026", fechaLimite: "2026-07-31",
        estado: "por_pagar" as const,
      },
      {
        cedula: "0506070809", nombres: "Ana Lucía", apellidos: "Morocho Sisa",
        direccion: "Sector La Quebrada", lecturaAnterior: 310, lecturaActual: 322,
        montoDeuda: 5.5, mes: "Julio 2026", fechaLimite: "2026-07-31",
        estado: "por_pagar" as const,
      },
    ];

    for (const e of ejemplos) {
      await ctx.db.insert("socios", e);
    }

    // Configuración (cuenta bancaria de la junta) de ejemplo.
    const cfg = await ctx.db.query("config").first();
    if (!cfg) {
      await ctx.db.insert("config", {
        banco: "Banco del Austro",
        tipoCuenta: "Ahorros",
        numeroCuenta: "1234567890",
        titular: "Junta de Agua de Yunguilla",
        identificacionTitular: "0190000000001",
      });
    }

    return { creados: ejemplos.length };
  },
});
