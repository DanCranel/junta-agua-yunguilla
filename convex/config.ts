import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requerirSesion } from "./auth";

/** Devuelve la configuración (cuenta bancaria de la junta), o null si no existe. */
export const obtener = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("config").first();
  },
});

/** Actualiza (o crea) la cuenta bancaria única. Requiere sesión del tesorero. */
export const actualizar = mutation({
  args: {
    token: v.string(),
    banco: v.string(),
    tipoCuenta: v.string(),
    numeroCuenta: v.string(),
    titular: v.string(),
    identificacionTitular: v.string(),
  },
  handler: async (ctx, { token, ...datos }) => {
    await requerirSesion(ctx, token);
    const existente = await ctx.db.query("config").first();
    if (existente) {
      await ctx.db.patch(existente._id, datos);
    } else {
      await ctx.db.insert("config", datos);
    }
    return null;
  },
});
