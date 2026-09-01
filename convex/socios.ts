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
        // Todas las planillas sin pagar del socio, de la más antigua a la más
        // nueva (para ver toda su deuda, no solo un mes).
        const planillas = await ctx.db
          .query("planillas")
          .withIndex("by_socio", (q) => q.eq("socioId", socio._id))
          .collect();
        const noPagadas = planillas
          .filter((pl) => pl.estado !== "pagado")
          .sort((a, b) => a.anio - b.anio || a.mes - b.mes);

        const pendientes = await Promise.all(
          noPagadas.map(async (p) => ({
            _id: p._id,
            anio: p.anio,
            mes: p.mes,
            montoTotal: p.montoTotal,
            estado: p.estado,
            fechaLimite: p.fechaLimite,
            comprobanteUrl: p.comprobanteId
              ? await ctx.storage.getUrl(p.comprobanteId)
              : null,
            comprobantePorWhatsApp: p.comprobantePorWhatsApp ?? false,
            grupoEnvio: p.grupoEnvio ?? null,
          })),
        );

        return { ...socio, pendientes };
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

/**
 * Importa un padrón de socios de una vez (desde un Excel). Crea cada socio,
 * salta los que ya existen (misma cédula) o a los que les falta cédula/nombre/
 * apellido, y devuelve cuántos creó y la lista de filas con problema. Requiere
 * sesión. Pensado para el alta inicial de una junta.
 */
export const importar = mutation({
  args: {
    token: v.string(),
    socios: v.array(
      v.object({
        cedula: v.string(),
        nombres: v.string(),
        apellidos: v.string(),
        direccion: v.optional(v.string()),
        telefono: v.optional(v.string()),
        numeroMedidor: v.optional(v.string()),
        lecturaInicial: v.number(),
      }),
    ),
  },
  handler: async (ctx, { token, socios }) => {
    await requerirSesion(ctx, token);

    let creados = 0;
    const errores: { fila: number; cedula: string; mensaje: string }[] = [];

    for (let i = 0; i < socios.length; i++) {
      const s = socios[i];
      const cedula = soloDigitos(s.cedula);
      const nombres = s.nombres.trim();
      const apellidos = s.apellidos.trim();

      if (!cedula || !nombres || !apellidos) {
        errores.push({
          fila: i + 1,
          cedula: s.cedula,
          mensaje: "Faltan cédula, nombres o apellidos.",
        });
        continue;
      }

      // Duplicados: ya en la base, o repetido dentro del mismo archivo (las
      // inserciones previas de esta misma mutación ya son visibles aquí).
      const existente = await ctx.db
        .query("socios")
        .withIndex("by_cedula", (q) => q.eq("cedula", cedula))
        .first();
      if (existente) {
        errores.push({ fila: i + 1, cedula, mensaje: "Cédula repetida (ya existe)." });
        continue;
      }

      await ctx.db.insert("socios", {
        cedula,
        nombres,
        apellidos,
        direccion: s.direccion?.trim() || undefined,
        telefono: s.telefono?.trim() || undefined,
        numeroMedidor: s.numeroMedidor?.trim() || undefined,
        lecturaInicial: Number.isFinite(s.lecturaInicial) ? s.lecturaInicial : 0,
        activo: true,
      });
      creados++;
    }

    return { creados, errores };
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
