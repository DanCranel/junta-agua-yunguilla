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
