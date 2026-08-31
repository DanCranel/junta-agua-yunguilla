import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requerirSesion } from "./auth";
import { tramoValidator } from "./schema";
import { TARIFA_POR_DEFECTO } from "./lib";

/**
 * Devuelve la tarifa configurada (básica, consumo incluido, excedente).
 * Si aún no se ha configurado, devuelve la tarifa por defecto de la muestra.
 * Pública: la usan el panel (previsualización) y el desglose de la planilla.
 */
export const obtener = query({
  args: {},
  handler: async (ctx) => {
    const doc = await ctx.db.query("tarifa").first();
    if (!doc) return TARIFA_POR_DEFECTO;
    return {
      tarifaBasica: doc.tarifaBasica,
      consumoIncluido: doc.consumoIncluido,
      precioExcedente: doc.precioExcedente,
      tramos: doc.tramos,
    };
  },
});

/** Actualiza (o crea) la tarifa única, con el excedente por tramos. Requiere sesión. */
export const actualizar = mutation({
  args: {
    token: v.string(),
    tarifaBasica: v.number(),
    consumoIncluido: v.number(),
    tramos: v.array(tramoValidator),
  },
  handler: async (ctx, { token, ...datos }) => {
    await requerirSesion(ctx, token);
    const existente = await ctx.db.query("tarifa").first();
    if (existente) {
      await ctx.db.patch(existente._id, datos);
    } else {
      await ctx.db.insert("tarifa", datos);
    }
    return null;
  },
});
