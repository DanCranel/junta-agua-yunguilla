// Ayudas de presentación compartidas por las páginas.

/** Nombre visible por defecto cuando la junta aún no configuró el suyo. */
export const NOMBRE_JUNTA_POR_DEFECTO = "Junta de Agua";

/** Nombre de la junta a mostrar: el configurado o el genérico por defecto. */
export function nombreJuntaMostrar(nombre?: string | null): string {
  return nombre?.trim() ? nombre.trim() : NOMBRE_JUNTA_POR_DEFECTO;
}

export type Estado = "por_pagar" | "en_revision" | "pagado";
export type TipoMulta = "mora" | "minga" | "otro";

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

/** Etiquetas legibles para los tipos de multa. */
export const TIPO_MULTA: Record<TipoMulta, string> = {
  mora: "Mora (pago atrasado)",
  minga: "Inasistencia a minga",
  otro: "Otro",
};

/** Formatea un número como dólares: 6.5 -> "$6.50". */
export function dinero(valor: number): string {
  return "$" + valor.toFixed(2);
}

const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

/** Nombre del mes con inicial mayúscula (1..12): 7 -> "Julio". */
export function nombreMes(mes: number): string {
  const n = MESES[mes - 1];
  if (!n) return String(mes);
  return n.charAt(0).toUpperCase() + n.slice(1);
}

/** Período legible: (2026, 7) -> "Julio 2026". */
export function periodoLegible(anio: number, mes: number): string {
  return `${nombreMes(mes)} ${anio}`;
}

/** Formatea una fecha ISO (YYYY-MM-DD) a algo legible: "31 de julio de 2026". */
export function fechaLegible(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return `${d} de ${MESES[m - 1]} de ${y}`;
}
