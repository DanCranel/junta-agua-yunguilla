import { query, mutation } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { normalizar, soloDigitos, coincideApellido } from "./lib";
import { requerirSesion, sesionActiva } from "./auth";

// Campos de identidad de un socio (reutilizados en crear y actualizar).
const camposSocio = {
  cedula: v.string(),
  nombres: v.string(),
  apellidos: v.string(),
  direccion: v.optional(v.string()),
  telefono: v.optional(v.string()),
  numeroMedidor: v.optional(v.string()),
  lecturaInicial: v.number(),
  activo: v.boolean(),
};

/**
 * Consulta pública: busca un socio por cédula + apellido y devuelve su
 * historial completo de planillas (más reciente primero).
 * El apellido puede ser el completo o solo el primero.
 * Devuelve { encontrado: boolean, socio?, planillas? }.
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

    if (!coincideApellido(apellido, socio.apellidos)) {
      return { encontrado: false as const };
    }

    // Todas las planillas del socio, ordenadas por (anio, mes) descendente.
    const planillas = await ctx.db
      .query("planillas")
      .withIndex("by_socio", (q) => q.eq("socioId", socio._id))
      .collect();
    planillas.sort((a, b) => b.anio - a.anio || b.mes - a.mes);

    return {
      encontrado: true as const,
      socio: {
        _id: socio._id,
        cedula: socio.cedula,
        nombres: socio.nombres,
        apellidos: socio.apellidos,
        direccion: socio.direccion,
        numeroMedidor: socio.numeroMedidor,
      },
      planillas,
    };
  },
});

/**
 * Lista todos los socios para el panel del tesorero (requiere sesión válida).
 * Cada socio incluye su planilla pendiente más reciente (si la tiene), con la
 * URL del comprobante resuelta.
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
      socios.map(async (socio) => {
        // Planilla pendiente: la más reciente que no esté pagada.
        const planillas = await ctx.db
          .query("planillas")
          .withIndex("by_socio", (q) => q.eq("socioId", socio._id))
          .collect();
        planillas.sort((a, b) => b.anio - a.anio || b.mes - a.mes);
        const p = planillas.find((pl) => pl.estado !== "pagado") ?? null;

        const pendiente = p
          ? {
              _id: p._id,
              anio: p.anio,
              mes: p.mes,
              montoTotal: p.montoTotal,
              estado: p.estado,
              comprobanteUrl: p.comprobanteId
                ? await ctx.storage.getUrl(p.comprobanteId)
                : null,
              comprobantePorWhatsApp: p.comprobantePorWhatsApp ?? false,
            }
          : null;

        return { ...socio, pendiente };
      }),
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

/** Actualiza los datos de identidad de un socio (requiere sesión). */
export const actualizar = mutation({
  args: { token: v.string(), id: v.id("socios"), ...camposSocio },
  handler: async (ctx, { token, id, ...datos }) => {
    await requerirSesion(ctx, token);
    await ctx.db.patch(id, { ...datos, cedula: soloDigitos(datos.cedula) });
    return null;
  },
});

/**
 * Elimina un socio y todo su historial. Requiere sesión.
 * Borra primero sus planillas (y los comprobantes almacenados de cada una).
 */
export const eliminar = mutation({
  args: { token: v.string(), id: v.id("socios") },
  handler: async (ctx, { token, id }) => {
    await requerirSesion(ctx, token);

    const planillas = await ctx.db
      .query("planillas")
      .withIndex("by_socio", (q) => q.eq("socioId", id))
      .collect();
    for (const planilla of planillas) {
      if (planilla.comprobanteId) {
        await ctx.storage.delete(planilla.comprobanteId);
      }
      await ctx.db.delete(planilla._id);
    }

    await ctx.db.delete(id);
    return null;
  },
});
