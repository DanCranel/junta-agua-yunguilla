// Ayudas de presentación compartidas por las páginas.

export type Estado = "por_pagar" | "en_revision" | "pagado";

export const ESTADO_INFO: Record<
  Estado,
  { etiqueta: string; emoji: string; clase: string }
> = {
  por_pagar: {
    etiqueta: "Por pagar",
    emoji: "🔴",
    clase: "bg-red-100 text-red-800 border-red-200",
  },
  en_revision: {
    etiqueta: "En revisión",
    emoji: "🟡",
    clase: "bg-yellow-100 text-yellow-800 border-yellow-200",
  },
  pagado: {
    etiqueta: "Pagado",
    emoji: "🟢",
    clase: "bg-green-100 text-green-800 border-green-200",
  },
};

/** Formatea un número como dólares: 6.5 -> "$6.50". */
export function dinero(valor: number): string {
  return "$" + valor.toFixed(2);
}

/** Formatea una fecha ISO (YYYY-MM-DD) a algo legible: "31 de julio de 2026". */
export function fechaLegible(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  const meses = [
    "enero", "febrero", "marzo", "abril", "mayo", "junio",
    "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
  ];
  return `${d} de ${meses[m - 1]} de ${y}`;
}
