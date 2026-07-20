import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// Duración de una sesión del panel del tesorero: 8 horas.
const DURACION_SESION_MS = 1000 * 60 * 60 * 8;

/**
 * Genera un token de sesión. Usa Math.random(), que la documentación de Convex
 * garantiza como generador pseudoaleatorio fuerte y permitido dentro de las
 * mutations (a diferencia de crypto.randomUUID, que no está documentado aquí).
 */
function generarToken(): string {
  let token = "";
  for (let i = 0; i < 4; i++) {
    token += Math.random().toString(36).slice(2, 12);
  }
  return token;
}

/**
 * Valida la clave del administrador (guardada como variable de entorno de
 * Convex: CLAVE_ADMIN) y, si es correcta, crea una sesión y devuelve su token.
 */
export const iniciarSesion = mutation({
  args: { clave: v.string() },
  handler: async (ctx, { clave }) => {
    const claveCorrecta = process.env.CLAVE_ADMIN;

    if (!claveCorrecta) {
      // Aún no se ha configurado la clave en Convex.
      return { ok: false as const, motivo: "no_configurada" as const };
    }
    if (clave !== claveCorrecta) {
      return { ok: false as const, motivo: "incorrecta" as const };
    }

    const token = generarToken();
    await ctx.db.insert("sesiones", {
      token,
      expiraEn: Date.now() + DURACION_SESION_MS,
    });
    return { ok: true as const, token };
  },
});

/** Indica si un token de sesión sigue siendo válido (existe y no ha caducado). */
export const validarSesion = query({
  args: { token: v.union(v.string(), v.null()) },
  handler: async (ctx, { token }) => {
    if (!token) return false;
    const sesion = await ctx.db
      .query("sesiones")
      .withIndex("by_token", (q) => q.eq("token", token))
      .first();
    if (!sesion) return false;
    return sesion.expiraEn > Date.now();
  },
});

/** Cierra la sesión: elimina el token. */
export const cerrarSesion = mutation({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const sesion = await ctx.db
      .query("sesiones")
      .withIndex("by_token", (q) => q.eq("token", token))
      .first();
    if (sesion) await ctx.db.delete(sesion._id);
    return null;
  },
});
