import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

/**
 * Estados posibles de una planilla:
 *  - por_pagar:   el socio aún no ha pagado.
 *  - en_revision: el socio subió el comprobante; el tesorero lo verifica.
 *  - pagado:      el tesorero confirmó el pago.
 */
export const estadoValidator = v.union(
  v.literal("por_pagar"),
  v.literal("en_revision"),
  v.literal("pagado"),
);

/** Tipos de multa que el tesorero puede agregar a una planilla. */
export const tipoMultaValidator = v.union(
  v.literal("mora"),
  v.literal("minga"),
  v.literal("otro"),
);

/** Una multa individual sumada a la planilla. */
export const multaValidator = v.object({
  tipo: tipoMultaValidator,
  descripcion: v.string(),
  monto: v.number(),
});

export default defineSchema({
  // Identidad del socio (separada de sus planillas mensuales).
  socios: defineTable({
    cedula: v.string(), // guardada solo con dígitos
    nombres: v.string(),
    apellidos: v.string(),
    direccion: v.optional(v.string()),
    numeroMedidor: v.optional(v.string()),
    lecturaInicial: v.number(), // base de la primera planilla
    activo: v.boolean(), // dar de baja sin borrar historial
  }).index("by_cedula", ["cedula"]),

  // Una planilla por socio por mes. Consumo y montos son calculados.
  planillas: defineTable({
    socioId: v.id("socios"),
    anio: v.number(), // ej. 2026
    mes: v.number(), // 1..12
    lecturaAnterior: v.number(), // heredada del mes previo (no editable)
    lecturaActual: v.number(), // único dato que ingresa el tesorero
    consumo: v.number(), // calculado = actual − anterior
    montoConsumo: v.number(), // calculado (básica + excedente)
    multas: v.array(multaValidator),
    montoTotal: v.number(), // montoConsumo + suma(multas)
    estado: estadoValidator,
    fechaLimite: v.string(), // ISO YYYY-MM-DD
    fechaPago: v.optional(v.string()), // ISO, se llena al confirmar
    comprobanteId: v.optional(v.id("_storage")), // comprobante subido por el socio
  })
    .index("by_socio", ["socioId"])
    .index("by_socio_periodo", ["socioId", "anio", "mes"]),

  // Configuración de tarifa (doc único).
  tarifa: defineTable({
    tarifaBasica: v.number(), // valor mínimo mensual
    consumoIncluido: v.number(), // m³ que cubre la básica
    precioExcedente: v.number(), // valor por m³ adicional
  }),

  // Configuración única: nombre de la junta + cuenta bancaria.
  config: defineTable({
    nombreJunta: v.optional(v.string()), // marca visible; cada junta pone el suyo
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

  // Control de intentos de acceso al panel (protección básica contra fuerza
  // bruta). Doc único: cuenta fallos seguidos y, superado el límite, bloquea el
  // ingreso por un tiempo corto.
  accesoAdmin: defineTable({
    intentosFallidos: v.number(),
    bloqueadoHasta: v.number(), // ms; 0 = sin bloqueo
  }),
});
