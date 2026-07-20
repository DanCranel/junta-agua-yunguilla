import { query, mutation, QueryCtx } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { Id } from "./_generated/dataModel";
import { requerirSesion, sesionActiva } from "./auth";
import { tipoMultaValidator } from "./schema";
import {
  calcularConsumo,
  calcularMontoConsumo,
  calcularMontoTotal,
  fechaHoyISO,
  ultimoDiaDelMes,
  TARIFA_POR_DEFECTO,
  type Tarifa,
} from "./lib";

/**
 * Devuelve la tarifa vigente (doc único). Si aún no se configuró, usa la
 * tarifa por defecto de la muestra. Helper interno de este módulo.
 */
async function obtenerTarifa(ctx: QueryCtx): Promise<Tarifa> {
  const doc = await ctx.db.query("tarifa").first();
  return doc
    ? {
        tarifaBasica: doc.tarifaBasica,
        consumoIncluido: doc.consumoIncluido,
        precioExcedente: doc.precioExcedente,
      }
    : TARIFA_POR_DEFECTO;
}

/**
 * Lectura anterior de un socio para el período (anio, mes):
 * la lecturaActual de la planilla más reciente ESTRICTAMENTE anterior a ese
 * período; si no existe ninguna, la lecturaInicial del socio.
 */
async function lecturaAnteriorDe(
  ctx: QueryCtx,
  socioId: Id<"socios">,
  anio: number,
  mes: number,
): Promise<number> {
  const planillas = await ctx.db
    .query("planillas")
    .withIndex("by_socio", (q) => q.eq("socioId", socioId))
    .collect();

  // Solo períodos estrictamente anteriores a (anio, mes).
  const anteriores = planillas.filter(
    (p) => p.anio < anio || (p.anio === anio && p.mes < mes),
  );
  anteriores.sort((a, b) => b.anio - a.anio || b.mes - a.mes);

  if (anteriores.length > 0) return anteriores[0].lecturaActual;

  const socio = await ctx.db.get(socioId);
  return socio ? socio.lecturaInicial : 0;
}

/**
 * Lista las planillas de un socio (más reciente primero), con la URL del
 * comprobante resuelta. Requiere sesión del tesorero; token inválido -> [].
 */
export const listarPorSocio = query({
  args: { token: v.union(v.string(), v.null()), socioId: v.id("socios") },
  handler: async (ctx, { token, socioId }) => {
    if (!(await sesionActiva(ctx, token))) return [];

    const planillas = await ctx.db
      .query("planillas")
      .withIndex("by_socio", (q) => q.eq("socioId", socioId))
      .collect();
    planillas.sort((a, b) => b.anio - a.anio || b.mes - a.mes);

    return Promise.all(
      planillas.map(async (p) => ({
        ...p,
        comprobanteUrl: p.comprobanteId
          ? await ctx.storage.getUrl(p.comprobanteId)
          : null,
      })),
    );
  },
});

/**
 * Vista previa del cálculo para el tesorero antes de registrar la lectura.
 * No valida ni guarda nada. Requiere sesión; token inválido -> null.
 */
export const previsualizar = query({
  args: {
    token: v.union(v.string(), v.null()),
    socioId: v.id("socios"),
    anio: v.number(),
    mes: v.number(),
    lecturaActual: v.number(),
  },
  handler: async (ctx, { token, socioId, anio, mes, lecturaActual }) => {
    if (!(await sesionActiva(ctx, token))) return null;

    const tarifa = await obtenerTarifa(ctx);
    const lecturaAnterior = await lecturaAnteriorDe(ctx, socioId, anio, mes);
    const consumo = calcularConsumo(lecturaAnterior, lecturaActual);
    const montoConsumo = calcularMontoConsumo(consumo, tarifa);

    return { lecturaAnterior, consumo, montoConsumo, tarifa };
  },
});

/**
 * Registra la lectura de un mes y crea la planilla (estado por_pagar).
 * Rechaza duplicados por período y lecturas menores a la anterior.
 * Devuelve el id de la planilla creada.
 */
export const registrarLectura = mutation({
  args: {
    token: v.string(),
    socioId: v.id("socios"),
    anio: v.number(),
    mes: v.number(),
    lecturaActual: v.number(),
    fechaLimite: v.optional(v.string()),
  },
  handler: async (ctx, { token, socioId, anio, mes, lecturaActual, fechaLimite }) => {
    await requerirSesion(ctx, token);

    // No debe existir ya una planilla para ese socio y período.
    const existente = await ctx.db
      .query("planillas")
      .withIndex("by_socio_periodo", (q) =>
        q.eq("socioId", socioId).eq("anio", anio).eq("mes", mes),
      )
      .first();
    if (existente) {
      throw new ConvexError({
        codigo: "planilla_duplicada",
        mensaje: "Ya existe una planilla para ese mes.",
      });
    }

    const lecturaAnterior = await lecturaAnteriorDe(ctx, socioId, anio, mes);
    if (lecturaActual < lecturaAnterior) {
      throw new ConvexError({
        codigo: "lectura_invalida",
        mensaje: `La lectura actual (${lecturaActual}) no puede ser menor que la anterior (${lecturaAnterior}). Revise el medidor.`,
      });
    }

    const tarifa = await obtenerTarifa(ctx);
    const consumo = calcularConsumo(lecturaAnterior, lecturaActual);
    const montoConsumo = calcularMontoConsumo(consumo, tarifa);
    const multas: never[] = [];
    const montoTotal = montoConsumo;

    return await ctx.db.insert("planillas", {
      socioId,
      anio,
      mes,
      lecturaAnterior,
      lecturaActual,
      consumo,
      montoConsumo,
      multas,
      montoTotal,
      estado: "por_pagar",
      fechaLimite: fechaLimite ?? ultimoDiaDelMes(anio, mes),
    });
  },
});

/**
 * Corrige la lectura actual de una planilla existente y recalcula los montos
 * (conservando las multas). Requiere sesión.
 */
export const editarLectura = mutation({
  args: {
    token: v.string(),
    planillaId: v.id("planillas"),
    lecturaActual: v.number(),
  },
  handler: async (ctx, { token, planillaId, lecturaActual }) => {
    await requerirSesion(ctx, token);

    const planilla = await ctx.db.get(planillaId);
    if (!planilla) {
      throw new ConvexError({
        codigo: "planilla_inexistente",
        mensaje: "No se encontró la planilla.",
      });
    }

    if (lecturaActual < planilla.lecturaAnterior) {
      throw new ConvexError({
        codigo: "lectura_invalida",
        mensaje: `La lectura actual (${lecturaActual}) no puede ser menor que la anterior (${planilla.lecturaAnterior}). Revise el medidor.`,
      });
    }

    const tarifa = await obtenerTarifa(ctx);
    const consumo = calcularConsumo(planilla.lecturaAnterior, lecturaActual);
    const montoConsumo = calcularMontoConsumo(consumo, tarifa);
    const montoTotal = calcularMontoTotal(montoConsumo, planilla.multas);

    await ctx.db.patch(planillaId, { lecturaActual, consumo, montoConsumo, montoTotal });
    return null;
  },
});

/** Agrega una multa a la planilla y recalcula el total. Requiere sesión. */
export const agregarMulta = mutation({
  args: {
    token: v.string(),
    planillaId: v.id("planillas"),
    tipo: tipoMultaValidator,
    descripcion: v.string(),
    monto: v.number(),
  },
  handler: async (ctx, { token, planillaId, tipo, descripcion, monto }) => {
    await requerirSesion(ctx, token);

    const planilla = await ctx.db.get(planillaId);
    if (!planilla) {
      throw new ConvexError({
        codigo: "planilla_inexistente",
        mensaje: "No se encontró la planilla.",
      });
    }

    const multas = [...planilla.multas, { tipo, descripcion, monto }];
    const montoTotal = calcularMontoTotal(planilla.montoConsumo, multas);

    await ctx.db.patch(planillaId, { multas, montoTotal });
    return null;
  },
});

/** Quita la multa en la posición indicada y recalcula el total. Requiere sesión. */
export const quitarMulta = mutation({
  args: {
    token: v.string(),
    planillaId: v.id("planillas"),
    indice: v.number(),
  },
  handler: async (ctx, { token, planillaId, indice }) => {
    await requerirSesion(ctx, token);

    const planilla = await ctx.db.get(planillaId);
    if (!planilla) {
      throw new ConvexError({
        codigo: "planilla_inexistente",
        mensaje: "No se encontró la planilla.",
      });
    }

    const multas = planilla.multas.filter((_, i) => i !== indice);
    const montoTotal = calcularMontoTotal(planilla.montoConsumo, multas);

    await ctx.db.patch(planillaId, { multas, montoTotal });
    return null;
  },
});

/** Confirma el pago de una planilla (estado pagado + fecha). Requiere sesión. */
export const confirmarPago = mutation({
  args: { token: v.string(), planillaId: v.id("planillas") },
  handler: async (ctx, { token, planillaId }) => {
    await requerirSesion(ctx, token);
    await ctx.db.patch(planillaId, {
      estado: "pagado",
      fechaPago: fechaHoyISO(Date.now()),
    });
    return null;
  },
});

/** Rechaza el pago: vuelve la planilla a por_pagar. Requiere sesión. */
export const rechazarPago = mutation({
  args: { token: v.string(), planillaId: v.id("planillas") },
  handler: async (ctx, { token, planillaId }) => {
    await requerirSesion(ctx, token);
    await ctx.db.patch(planillaId, { estado: "por_pagar" });
    return null;
  },
});

/** Genera una URL para que el socio suba su comprobante. Pública. */
export const generarUrlSubida = mutation({
  args: {},
  handler: async (ctx) => {
    return await ctx.storage.generateUploadUrl();
  },
});

/**
 * Adjunta el comprobante subido por el socio y pasa la planilla a en_revision.
 * Pública (la usa el socio, sin token).
 */
export const adjuntarComprobante = mutation({
  args: { planillaId: v.id("planillas"), storageId: v.id("_storage") },
  handler: async (ctx, { planillaId, storageId }) => {
    await ctx.db.patch(planillaId, {
      comprobanteId: storageId,
      estado: "en_revision",
    });
    return null;
  },
});
