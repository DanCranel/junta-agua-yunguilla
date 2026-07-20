import { query } from "./_generated/server";

/** Devuelve la configuración (cuenta bancaria de la junta), o null si no existe. */
export const obtener = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("config").first();
  },
});
