import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

/**
 * Estados posibles de un cobro:
 *  - por_pagar:  el socio aún no ha pagado.
 *  - en_revision: el socio subió el comprobante; el tesorero lo verifica.
 *  - pagado:     el tesorero confirmó el pago.
 */
export const estadoValidator = v.union(
  v.literal("por_pagar"),
  v.literal("en_revision"),
  v.literal("pagado"),
);

export default defineSchema({
  // Socios de la junta y su cobro del mes.
  socios: defineTable({
    cedula: v.string(), // guardada solo con dígitos
    nombres: v.string(),
    apellidos: v.string(),
    direccion: v.optional(v.string()),
    lecturaAnterior: v.number(),
    lecturaActual: v.number(),
    montoDeuda: v.number(),
    mes: v.string(),
    fechaLimite: v.string(), // ISO YYYY-MM-DD
    estado: estadoValidator,
    // Comprobante de pago subido por el socio (Convex File Storage).
    comprobanteId: v.optional(v.id("_storage")),
  }).index("by_cedula", ["cedula"]),

  // Configuración única: cuenta bancaria de la junta.
  config: defineTable({
    banco: v.string(),
    tipoCuenta: v.string(),
    numeroCuenta: v.string(),
    titular: v.string(),
    identificacionTitular: v.string(),
  }),

  // Sesiones activas del panel del tesorero (token temporal tras validar la clave).
  sesiones: defineTable({
    token: v.string(),
    expiraEn: v.number(), // marca de tiempo (ms) en que caduca la sesión
  }).index("by_token", ["token"]),
});
