"use client";

import { ConvexError } from "convex/values";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ESTADO_INFO, type Estado } from "@/lib/formato";

/** Extrae un mensaje legible de un error de mutation (ConvexError o genérico). */
export function mensajeError(err: unknown, porDefecto = "Ocurrió un error."): string {
  if (err instanceof ConvexError) {
    return (err.data as { mensaje?: string })?.mensaje ?? porDefecto;
  }
  return porDefecto;
}

/** Muestra un mensaje de error en un recuadro rojo. */
export function AvisoError({ mensaje }: { mensaje: string | null }) {
  if (!mensaje) return null;
  return (
    <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{mensaje}</p>
  );
}

/** Badge con el estado de una planilla (emoji + etiqueta + color). */
export function EstadoBadge({ estado }: { estado: string }) {
  const info = ESTADO_INFO[estado as Estado] ?? ESTADO_INFO.por_pagar;
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-3 py-0.5 text-sm font-medium ${info.clase}`}
    >
      {info.emoji} {info.etiqueta}
    </span>
  );
}

/** Campo de formulario etiquetado (label + input) con letras cómodas. */
export function Campo({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  autoFocus,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  autoFocus?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-base">{label}</Label>
      <Input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoFocus={autoFocus}
        className="h-12 text-base"
      />
    </div>
  );
}
