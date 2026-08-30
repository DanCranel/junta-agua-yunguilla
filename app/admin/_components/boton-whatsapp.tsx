"use client";

import { Button } from "@/components/ui/button";
import { enlaceWhatsApp } from "@/lib/whatsapp";

/**
 * Botón que abre WhatsApp con un mensaje ya escrito. El mensaje lo arma quien
 * lo usa (recordatorio de una planilla o de la deuda total). Si el socio no
 * tiene teléfono cargado, WhatsApp se abre sin destinatario para que el
 * tesorero elija el contacto (por eso el botón siempre sirve).
 */
export function BotonWhatsApp({
  telefono,
  mensaje,
  label = "WhatsApp",
  size = "sm",
}: {
  telefono?: string | null;
  mensaje: string;
  label?: string;
  size?: "sm" | "lg";
}) {
  const href = enlaceWhatsApp(telefono, mensaje);
  return (
    <Button
      size={size}
      variant="outline"
      className="gap-1.5 border-green-300 bg-green-50 text-green-800 hover:bg-green-100 hover:text-green-900"
      render={
        <a href={href} target="_blank" rel="noopener noreferrer">
          <span aria-hidden>💬</span> {label}
          {!telefono && <span className="text-xs opacity-70"> (sin n.º)</span>}
        </a>
      }
    />
  );
}
