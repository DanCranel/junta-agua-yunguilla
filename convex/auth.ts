import { mutation, query, QueryCtx } from "./_generated/server";
import { v, ConvexError } from "convex/values";

// Duración de una sesión del panel del tesorero: 8 horas.
const DURACION_SESION_MS = 1000 * 60 * 60 * 8;

// Protección básica contra fuerza bruta: tras este número de claves incorrectas
// seguidas, el ingreso se bloquea por un tiempo corto. Un ingreso correcto
// reinicia el contador. Nota: Convex no expone la IP del cliente en una
// mutation, así que el límite es a nivel de despliegue (aceptable para un único
// tesorero); en producción a gran escala convendría un límite por IP vía HTTP
// action o el componente de rate limiting de Convex.
const MAX_INTENTOS = 5;
const BLOQUEO_MS = 1000 * 60; // 1 minuto

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

/** Devuelve true si el token corresponde a una sesión vigente. */
export async function sesionActiva(
  ctx: QueryCtx,
  token: string | null,
): Promise<boolean> {
  if (!token) return false;
  const sesion = await ctx.db
    .query("sesiones")
    .withIndex("by_token", (q) => q.eq("token", token))
    .first();
  return !!sesion && sesion.expiraEn > Date.now();
}

/** Lanza un error si el token no corresponde a una sesión vigente. */
export async function requerirSesion(ctx: QueryCtx, token: string): Promise<void> {
  if (!(await sesionActiva(ctx, token))) {
    throw new ConvexError({ codigo: "no_autorizado", mensaje: "Sesión inválida o expirada." });
  }
}

/**
 * Valida la clave del administrador (guardada como variable de entorno de
 * Convex: CLAVE_ADMIN) y, si es correcta, crea una sesión y devuelve su token.
 */
export const iniciarSesion = mutation({
  args: { clave: v.string() },
  handler: async (ctx, { clave }) => {
    const ahora = Date.now();
    const control = await ctx.db.query("accesoAdmin").first();

    // Ingreso bloqueado temporalmente por demasiados intentos fallidos.
    if (control && control.bloqueadoHasta > ahora) {
      const segundos = Math.ceil((control.bloqueadoHasta - ahora) / 1000);
      return { ok: false as const, motivo: "bloqueado" as const, segundos };
    }

    const claveCorrecta = process.env.CLAVE_ADMIN;

    if (!claveCorrecta) {
      // Aún no se ha configurado la clave en Convex.
      return { ok: false as const, motivo: "no_configurada" as const };
    }

    if (clave !== claveCorrecta) {
      // Registrar el fallo y, si se alcanza el límite, activar el bloqueo.
      const intentos = (control?.intentosFallidos ?? 0) + 1;
      const alcanzaLimite = intentos >= MAX_INTENTOS;
      const datos = {
        intentosFallidos: alcanzaLimite ? 0 : intentos,
        bloqueadoHasta: alcanzaLimite ? ahora + BLOQUEO_MS : 0,
      };
      if (control) await ctx.db.patch(control._id, datos);
      else await ctx.db.insert("accesoAdmin", datos);
      return { ok: false as const, motivo: "incorrecta" as const };
    }

    // Clave correcta: reiniciar el contador de intentos.
    if (control) {
      await ctx.db.patch(control._id, { intentosFallidos: 0, bloqueadoHasta: 0 });
    }

    const token = generarToken();
    await ctx.db.insert("sesiones", {
      token,
      expiraEn: ahora + DURACION_SESION_MS,
    });
    return { ok: true as const, token };
  },
});

/** Indica si un token de sesión sigue siendo válido (existe y no ha caducado). */
export const validarSesion = query({
  args: { token: v.union(v.string(), v.null()) },
  handler: async (ctx, { token }) => {
    return await sesionActiva(ctx, token);
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
