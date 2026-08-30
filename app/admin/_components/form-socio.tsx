"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { AvisoError, Campo, mensajeError } from "./comunes";
import type { SocioListado } from "./tipos";

/**
 * Formulario de identidad del socio (crear o editar) dentro de un diálogo.
 * Solo maneja datos del socio; las lecturas/planillas van por otro flujo.
 */
export function FormSocio({
  token,
  socio,
  triggerLabel,
  variant,
}: {
  token: string;
  socio?: SocioListado;
  triggerLabel: string;
  variant?: "outline";
}) {
  const crear = useMutation(api.socios.crear);
  const actualizar = useMutation(api.socios.actualizar);

  const [abierto, setAbierto] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  const [f, setF] = useState({
    cedula: socio?.cedula ?? "",
    nombres: socio?.nombres ?? "",
    apellidos: socio?.apellidos ?? "",
    direccion: socio?.direccion ?? "",
    telefono: socio?.telefono ?? "",
    numeroMedidor: socio?.numeroMedidor ?? "",
    lecturaInicial: String(socio?.lecturaInicial ?? ""),
    activo: socio?.activo ?? true,
  });

  function set<K extends keyof typeof f>(campo: K, valor: (typeof f)[K]) {
    setF((prev) => ({ ...prev, [campo]: valor }));
  }

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setGuardando(true);
    try {
      const datos = {
        cedula: f.cedula.trim(),
        nombres: f.nombres.trim(),
        apellidos: f.apellidos.trim(),
        direccion: f.direccion.trim() || undefined,
        telefono: f.telefono.trim() || undefined,
        numeroMedidor: f.numeroMedidor.trim() || undefined,
        lecturaInicial: Number(f.lecturaInicial) || 0,
        activo: f.activo,
      };
      if (socio) {
        await actualizar({ token, id: socio._id, ...datos });
      } else {
        await crear({ token, ...datos });
      }
      setAbierto(false);
    } catch (err) {
      setError(mensajeError(err, "No se pudo guardar. Revise los datos."));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Dialog open={abierto} onOpenChange={setAbierto}>
      <DialogTrigger
        render={
          <Button variant={variant} size={variant ? "sm" : "lg"}>
            {triggerLabel}
          </Button>
        }
      />
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-xl">
            {socio ? "Editar socio" : "Nuevo socio"}
          </DialogTitle>
          <DialogDescription className="text-base">
            Complete los datos del socio.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={guardar} className="space-y-4">
          <Campo
            label="Cédula"
            value={f.cedula}
            onChange={(v) => set("cedula", v)}
            autoFocus
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Campo label="Nombres" value={f.nombres} onChange={(v) => set("nombres", v)} />
            <Campo
              label="Apellidos"
              value={f.apellidos}
              onChange={(v) => set("apellidos", v)}
            />
          </div>
          <Campo
            label="Dirección (opcional)"
            value={f.direccion}
            onChange={(v) => set("direccion", v)}
          />
          <Campo
            label="Teléfono / WhatsApp (opcional)"
            type="tel"
            placeholder="Ej. 0991234567"
            value={f.telefono}
            onChange={(v) => set("telefono", v)}
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Campo
              label="Número de medidor (opcional)"
              value={f.numeroMedidor}
              onChange={(v) => set("numeroMedidor", v)}
            />
            <Campo
              label="Lectura inicial (m³)"
              type="number"
              value={f.lecturaInicial}
              onChange={(v) => set("lecturaInicial", v)}
            />
          </div>

          <label className="flex items-center gap-3 rounded-md border border-input px-3 py-3">
            <input
              type="checkbox"
              checked={f.activo}
              onChange={(e) => set("activo", e.target.checked)}
              className="size-5"
            />
            <span className="text-base">Socio activo</span>
          </label>

          <AvisoError mensaje={error} />

          <DialogFooter>
            <Button type="submit" size="lg" disabled={guardando}>
              {guardando ? "Guardando…" : "Guardar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
