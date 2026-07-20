import { query, mutation } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { normalizar, soloDigitos } from "./lib";
import { estadoValidator } from "./schema";
import { requerirSesion, sesionActiva } from "./auth";

// Campos editables de un socio (reutilizados en crear y actualizar).
const camposSocio = {
  cedula: v.string(),
  nombres: v.string(),
  apellidos: v.string(),
  direccion: v.optional(v.string()),
  lecturaAnterior: v.number(),
  lecturaActual: v.number(),
  montoDeuda: v.number(),
  mes: v.string(),
  fechaLimite: v.string(),
  estado: estadoValidator,
};

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

/**
 * Lista todos los socios para el panel del tesorero (requiere sesión válida).
 * Incluye la URL del comprobante si el socio subió uno.
 */
export const listar = query({
  args: { token: v.union(v.string(), v.null()) },
  handler: async (ctx, { token }) => {
    if (!(await sesionActiva(ctx, token))) return [];

    const socios = await ctx.db.query("socios").collect();
    socios.sort((a, b) =>
      normalizar(a.apellidos).localeCompare(normalizar(b.apellidos)),
    );

    return Promise.all(
      socios.map(async (s) => ({
        ...s,
        comprobanteUrl: s.comprobanteId
          ? await ctx.storage.getUrl(s.comprobanteId)
          : null,
      })),
    );
  },
});

/** Crea un socio nuevo (requiere sesión). Evita cédulas duplicadas. */
export const crear = mutation({
  args: { token: v.string(), ...camposSocio },
  handler: async (ctx, { token, ...datos }) => {
    await requerirSesion(ctx, token);
    const cedula = soloDigitos(datos.cedula);

    const existente = await ctx.db
      .query("socios")
      .withIndex("by_cedula", (q) => q.eq("cedula", cedula))
      .first();
    if (existente) {
      throw new ConvexError({
        codigo: "cedula_duplicada",
        mensaje: "Ya existe un socio con esa cédula.",
      });
    }

    await ctx.db.insert("socios", { ...datos, cedula });
    return null;
  },
});

/** Actualiza los datos de un socio (requiere sesión). */
export const actualizar = mutation({
  args: { token: v.string(), id: v.id("socios"), ...camposSocio },
  handler: async (ctx, { token, id, ...datos }) => {
    await requerirSesion(ctx, token);
    await ctx.db.patch(id, { ...datos, cedula: soloDigitos(datos.cedula) });
    return null;
  },
});

/** Elimina un socio y su comprobante (si tiene). Requiere sesión. */
export const eliminar = mutation({
  args: { token: v.string(), id: v.id("socios") },
  handler: async (ctx, { token, id }) => {
    await requerirSesion(ctx, token);
    const socio = await ctx.db.get(id);
    if (socio?.comprobanteId) {
      await ctx.storage.delete(socio.comprobanteId);
    }
    await ctx.db.delete(id);
    return null;
  },
});

/** Confirma el pago de un socio: estado -> pagado. Requiere sesión. */
export const confirmarPago = mutation({
  args: { token: v.string(), id: v.id("socios") },
  handler: async (ctx, { token, id }) => {
    await requerirSesion(ctx, token);
    await ctx.db.patch(id, { estado: "pagado" });
    return null;
  },
});

/** Rechaza el pago: vuelve el estado a por_pagar. Requiere sesión. */
export const rechazarPago = mutation({
  args: { token: v.string(), id: v.id("socios") },
  handler: async (ctx, { token, id }) => {
    await requerirSesion(ctx, token);
    await ctx.db.patch(id, { estado: "por_pagar" });
    return null;
  },
});

/**
 * Carga datos de ejemplo (para la muestra). No hace nada si ya existen socios.
 * Requiere sesión.
 */
export const sembrarEjemplo = mutation({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    await requerirSesion(ctx, token);

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
