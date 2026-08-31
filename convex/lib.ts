// Utilidades compartidas por las funciones de Convex.

/** Quita acentos, espacios sobrantes y pasa a minusculas. */
export function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim()
    .toLowerCase();
}

/** Deja solo los digitos (para comparar cedulas escritas con espacios o guiones). */
export function soloDigitos(texto: string): string {
  return texto.replace(/\D/g, "");
}

/**
 * Verifica si el apellido escrito coincide con el del socio: se acepta el
 * apellido completo o solo el primero. Fuente única de esta regla, usada tanto
 * por la consulta pública como por la verificación de identidad en la subida de
 * comprobantes.
 */
export function coincideApellido(
  apellidoBuscado: string,
  apellidosSocio: string,
): boolean {
  const buscado = normalizar(apellidoBuscado);
  const apellidos = normalizar(apellidosSocio);
  const primero = apellidos.split(/\s+/)[0] ?? "";
  return buscado === apellidos || buscado === primero;
}

// --- Validación del comprobante de pago (subido por el socio) ---

/** Tipos de archivo aceptados como comprobante: fotos comunes o PDF. */
export const COMPROBANTE_TIPOS_OK = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "application/pdf",
];

/** Tamaño máximo del comprobante: 5 MB. */
export const COMPROBANTE_MAX_BYTES = 5 * 1024 * 1024;

// --- Cálculo de la tarifa (núcleo de la v2, ver PRD §4.1) ---

export type Multa = { tipo: string; descripcion: string; monto: number };

/**
 * Un tramo de excedente: cobra `precio` por m³ desde el fin del tramo anterior
 * hasta `hasta` m³. El último tramo lleva `hasta: null` (de ahí en adelante).
 * Los tramos van en orden ascendente de `hasta`.
 */
export type Tramo = { hasta: number | null; precio: number };

/** Regla de mora por atraso (ver schema `moraValidator`). */
export type Mora = {
  activa: boolean;
  tipo: "fijo" | "porcentaje";
  valor: number;
  diasGracia: number;
};

export type Tarifa = {
  tarifaBasica: number;
  consumoIncluido: number;
  precioExcedente?: number; // legado: excedente de un solo precio (tramo único)
  tramos?: Tramo[]; // excedente por tramos (tiene prioridad sobre precioExcedente)
  mora?: Mora; // regla de mora por atraso (opcional)
};

/** Tarifa de la muestra: básica $3 hasta 15 m³, excedente $0.30/m³. */
export const TARIFA_POR_DEFECTO: Tarifa = {
  tarifaBasica: 3,
  consumoIncluido: 15,
  precioExcedente: 0.3,
  tramos: [{ hasta: null, precio: 0.3 }],
};

/** Redondea a centavos para evitar arrastre de errores de punto flotante. */
function aCentavos(valor: number): number {
  return Math.round(valor * 100) / 100;
}

/**
 * Consumo del mes = lectura actual − lectura anterior.
 * No se limita a >= 0 aquí: una lectura menor a la anterior se valida y bloquea
 * en la mutation (ver PRD §4.2), no se corrige silenciosamente.
 */
export function calcularConsumo(
  lecturaAnterior: number,
  lecturaActual: number,
): number {
  return lecturaActual - lecturaAnterior;
}

/**
 * Tramos de excedente de la tarifa. Compatibilidad: si la tarifa aún usa el
 * precio único heredado, se representa como un solo tramo abierto.
 */
export function tramosDe(tarifa: Tarifa): Tramo[] {
  if (tarifa.tramos && tarifa.tramos.length > 0) return tarifa.tramos;
  return [{ hasta: null, precio: tarifa.precioExcedente ?? 0 }];
}

/**
 * Monto del consumo según la tarifa (básica + excedente por tramos).
 *   consumo <= incluido  -> básica
 *   consumo >  incluido  -> básica + la suma de cada tramo de excedente usado
 * Cada tramo cobra su precio por los m³ desde el fin del tramo anterior hasta su
 * tope `hasta` (el último, `hasta: null`, cobra de ahí en adelante).
 */
export function calcularMontoConsumo(consumo: number, tarifa: Tarifa): number {
  const c = Math.max(0, consumo);
  if (c <= tarifa.consumoIncluido) {
    return aCentavos(tarifa.tarifaBasica);
  }
  let monto = tarifa.tarifaBasica;
  let limiteAnterior = tarifa.consumoIncluido;
  for (const tramo of tramosDe(tarifa)) {
    const tope = tramo.hasta ?? Infinity;
    const m3 = Math.min(c, tope) - limiteAnterior;
    if (m3 > 0) monto += m3 * tramo.precio;
    limiteAnterior = tope;
    if (c <= tope) break;
  }
  return aCentavos(monto);
}

/** Una línea del desglose de excedente (para mostrar en la planilla y el PDF). */
export type LineaExcedente = {
  m3: number;
  precio: number;
  monto: number;
  desde: number;
  hasta: number | null;
};

/**
 * Desglose del monto del consumo: la básica y una línea por cada tramo de
 * excedente efectivamente usado. Comparte la lógica con calcularMontoConsumo,
 * para que lo que se muestra coincida siempre con lo que se cobra.
 */
export function desgloseConsumo(
  consumo: number,
  tarifa: Tarifa,
): { basica: number; excedentes: LineaExcedente[] } {
  const c = Math.max(0, consumo);
  const basica = aCentavos(tarifa.tarifaBasica);
  const excedentes: LineaExcedente[] = [];
  if (c <= tarifa.consumoIncluido) return { basica, excedentes };

  let limiteAnterior = tarifa.consumoIncluido;
  for (const tramo of tramosDe(tarifa)) {
    const tope = tramo.hasta ?? Infinity;
    const m3 = Math.min(c, tope) - limiteAnterior;
    if (m3 > 0) {
      excedentes.push({
        m3,
        precio: tramo.precio,
        monto: aCentavos(m3 * tramo.precio),
        desde: limiteAnterior,
        hasta: tramo.hasta,
      });
    }
    limiteAnterior = tope;
    if (c <= tope) break;
  }
  return { basica, excedentes };
}

/** Suma de todas las multas de una planilla. */
export function sumaMultas(multas: Multa[]): number {
  return aCentavos(multas.reduce((acc, m) => acc + (m.monto || 0), 0));
}

/** Monto total = monto del consumo + suma de multas. */
export function calcularMontoTotal(montoConsumo: number, multas: Multa[]): number {
  return aCentavos(montoConsumo + sumaMultas(multas));
}

/** Fecha (YYYY-MM-DD) a partir de una marca de tiempo en ms (usar Date.now()). */
export function fechaHoyISO(msAhora: number): string {
  return new Date(msAhora).toISOString().slice(0, 10);
}

/** Último día del mes en formato ISO YYYY-MM-DD (mes en 1..12). */
export function ultimoDiaDelMes(anio: number, mes: number): string {
  // El día 0 del mes siguiente es el último día de este mes.
  const fecha = new Date(Date.UTC(anio, mes, 0));
  return fecha.toISOString().slice(0, 10);
}

/** Suma (o resta) días a una fecha ISO YYYY-MM-DD y devuelve ISO. */
export function sumarDiasISO(fechaISO: string, dias: number): string {
  const d = new Date(fechaISO + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

/**
 * ¿La planilla está vencida? Solo aplica a las que siguen "por pagar": la
 * fecha de hoy pasó la fecha límite. Las fechas ISO se comparan como texto.
 */
export function esVencida(
  estado: string,
  fechaLimite: string,
  hoyISO: string,
): boolean {
  return estado === "por_pagar" && hoyISO > fechaLimite;
}

/** Monto de mora según la regla: fijo en dólares, o porcentaje del consumo. */
export function montoMora(montoConsumo: number, mora: Mora): number {
  if (!mora.activa) return 0;
  const bruto =
    mora.tipo === "porcentaje" ? (montoConsumo * mora.valor) / 100 : mora.valor;
  return aCentavos(Math.max(0, bruto));
}
