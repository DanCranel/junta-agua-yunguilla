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

// --- Cálculo de la tarifa (núcleo de la v2, ver PRD §4.1) ---

export type Multa = { tipo: string; descripcion: string; monto: number };
export type Tarifa = {
  tarifaBasica: number;
  consumoIncluido: number;
  precioExcedente: number;
};

/** Tarifa de la muestra: básica $3 hasta 15 m³, excedente $0.30/m³. */
export const TARIFA_POR_DEFECTO: Tarifa = {
  tarifaBasica: 3,
  consumoIncluido: 15,
  precioExcedente: 0.3,
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
 * Monto del consumo según la tarifa (básica + excedente).
 *   consumo <= incluido  -> básica
 *   consumo >  incluido  -> básica + (consumo − incluido) × precioExcedente
 */
export function calcularMontoConsumo(consumo: number, tarifa: Tarifa): number {
  const c = Math.max(0, consumo);
  if (c <= tarifa.consumoIncluido) {
    return aCentavos(tarifa.tarifaBasica);
  }
  const excedente = c - tarifa.consumoIncluido;
  return aCentavos(tarifa.tarifaBasica + excedente * tarifa.precioExcedente);
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
