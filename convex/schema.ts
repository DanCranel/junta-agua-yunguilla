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

/**
 * Un tramo de excedente: cobra `precio` por cada m³ desde el fin del tramo
 * anterior hasta `hasta` m³. El último tramo lleva `hasta: null` (de ahí en
 * adelante). Permite tarifas escalonadas (ej. 15–30 m³ a $0.25, más de 30 a $1).
 */
export const tramoValidator = v.object({
  hasta: v.union(v.number(), v.null()),
  precio: v.number(),
});

/**
 * Regla de mora por pago atrasado (configurable por junta). Puede estar
 * desactivada. `valor` es dólares si `tipo` es "fijo", o porcentaje del consumo
 * si es "porcentaje". `diasGracia` son los días después de la fecha límite antes
 * de que aplique.
 */
export const moraValidator = v.object({
  activa: v.boolean(),
  tipo: v.union(v.literal("fijo"), v.literal("porcentaje")),
  valor: v.number(),
  diasGracia: v.number(),
});

/** Un cargo adicional recurrente (alcantarillado, cuota fija, aporte, etc.). */
export const cargoValidator = v.object({
  nombre: v.string(),
  monto: v.number(),
});

export default defineSchema({
  // Identidad del socio (separada de sus planillas mensuales).
  socios: defineTable({
    cedula: v.string(), // guardada solo con dígitos
    nombres: v.string(),
    apellidos: v.string(),
    direccion: v.optional(v.string()),
    telefono: v.optional(v.string()), // para enviar recordatorios por WhatsApp
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
    cargos: v.optional(v.array(cargoValidator)), // copia de los cargos vigentes al crearla
    montoTotal: v.number(), // montoConsumo + cargos + multas
    estado: estadoValidator,
    fechaLimite: v.string(), // ISO YYYY-MM-DD
    fechaPago: v.optional(v.string()), // ISO, se llena al confirmar
    comprobanteId: v.optional(v.id("_storage")), // comprobante subido por el socio
    comprobantePorWhatsApp: v.optional(v.boolean()), // el socio dijo que lo envió por WhatsApp
    grupoEnvio: v.optional(v.string()), // id del envío: agrupa los meses pagados juntos
  })
    .index("by_socio", ["socioId"])
    .index("by_socio_periodo", ["socioId", "anio", "mes"]),

  // Configuración de tarifa (doc único).
  tarifa: defineTable({
    tarifaBasica: v.number(), // valor mínimo mensual
    consumoIncluido: v.number(), // m³ que cubre la básica
    precioExcedente: v.optional(v.number()), // legado: excedente de un solo precio
    tramos: v.optional(v.array(tramoValidator)), // excedente por tramos (tiene prioridad)
    mora: v.optional(moraValidator), // regla de mora por atraso (opcional)
    cargos: v.optional(v.array(cargoValidator)), // cargos adicionales recurrentes
  }),

  // Configuración única: nombre de la junta + cuenta bancaria + WhatsApp.
  config: defineTable({
    nombreJunta: v.optional(v.string()), // marca visible; cada junta pone el suyo
    banco: v.string(),
    tipoCuenta: v.string(),
    numeroCuenta: v.string(),
    titular: v.string(),
    identificacionTitular: v.string(),
    whatsappTesorero: v.optional(v.string()), // para que el socio envíe el comprobante
    videoAyudaUrl: v.optional(v.string()), // enlace de YouTube con el instructivo para socios
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
