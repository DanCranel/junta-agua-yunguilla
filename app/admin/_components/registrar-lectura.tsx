"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { dinero, nombreMes } from "@/lib/formato";
import { desgloseConsumo, sumaCargos } from "@/convex/lib";
import { AvisoError, mensajeError } from "./comunes";

const ANIO_POR_DEFECTO = 2026;
const MES_POR_DEFECTO = 7;

/**
 * Diálogo para registrar la lectura del mes de un socio. El monto NO se escribe
 * a mano: mientras el tesorero teclea la lectura, se muestra en vivo (solo
 * lectura) el cálculo que hará el backend.
 */
export function RegistrarLectura({
  token,
  socioId,
  nombre,
}: {
  token: string;
  socioId: Id<"socios">;
  nombre: string;
}) {
  const registrar = useMutation(api.planillas.registrarLectura);

  const [abierto, setAbierto] = useState(false);
  const [anio, setAnio] = useState(String(ANIO_POR_DEFECTO));
  const [mes, setMes] = useState(String(MES_POR_DEFECTO));
  const [lectura, setLectura] = useState("");
  const [fechaLimite, setFechaLimite] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  const anioN = Number(anio);
  const mesN = Number(mes);
  const lecturaN = Number(lectura);
  const lecturaValida = lectura.trim() !== "" && Number.isFinite(lecturaN);
  const periodoValido = Number.isFinite(anioN) && Number.isFinite(mesN);

  // Vista previa reactiva: se salta hasta que haya una lectura válida.
  const preview = useQuery(
    api.planillas.previsualizar,
    abierto && lecturaValida && periodoValido
      ? { token, socioId, anio: anioN, mes: mesN, lecturaActual: lecturaN }
      : "skip",
  );

  function limpiar() {
    setAnio(String(ANIO_POR_DEFECTO));
    setMes(String(MES_POR_DEFECTO));
    setLectura("");
    setFechaLimite("");
    setError(null);
  }

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    if (!lecturaValida || !periodoValido) return;
    setError(null);
    setGuardando(true);
    try {
      await registrar({
        token,
        socioId,
        anio: anioN,
        mes: mesN,
        lecturaActual: lecturaN,
        ...(fechaLimite ? { fechaLimite } : {}),
      });
      limpiar();
      setAbierto(false);
    } catch (err) {
      setError(mensajeError(err, "No se pudo registrar la lectura."));
    } finally {
      setGuardando(false);
    }
  }

  // Desglose para mostrar (a partir de la vista previa del backend).
  const desglose = preview
    ? desgloseConsumo(preview.consumo, preview.tarifa)
    : null;

  return (
    <Dialog
      open={abierto}
      onOpenChange={(v) => {
        setAbierto(v);
        if (!v) limpiar();
      }}
    >
      <DialogTrigger render={<Button size="sm">Registrar lectura</Button>} />
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-xl">Registrar lectura del mes</DialogTitle>
          <DialogDescription className="text-base">{nombre}</DialogDescription>
        </DialogHeader>

        <form onSubmit={guardar} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-base">Año</Label>
              <Input
                type="number"
                value={anio}
                onChange={(e) => setAnio(e.target.value)}
                className="h-12 text-base"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-base">Mes</Label>
              <select
                value={mes}
                onChange={(e) => setMes(e.target.value)}
                className="h-12 w-full rounded-lg border border-input bg-transparent px-3 text-base"
              >
                {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                  <option key={m} value={m}>
                    {nombreMes(m)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-base">Lectura actual del medidor (m³)</Label>
            <Input
              type="number"
              value={lectura}
              onChange={(e) => setLectura(e.target.value)}
              placeholder="Ej. 176"
              className="h-12 text-base"
              autoFocus
            />
          </div>

          {/* Cálculo automático, solo lectura */}
          <div className="rounded-lg border border-input bg-muted/40 p-4 text-base">
            <p className="mb-2 text-sm font-medium text-muted-foreground">
              Cálculo automático (no se edita a mano)
            </p>
            {!lecturaValida ? (
              <p className="text-muted-foreground">
                Escriba la lectura actual para ver el consumo y el monto.
              </p>
            ) : preview === undefined ? (
              <p className="text-muted-foreground">Calculando…</p>
            ) : preview === null ? (
              <p className="text-muted-foreground">No se pudo calcular.</p>
            ) : (
              <dl className="space-y-1">
                <Fila
                  etiqueta="Lectura anterior"
                  valor={`${preview.lecturaAnterior} m³`}
                />
                <Fila etiqueta="Consumo del mes" valor={`${preview.consumo} m³`} />
                <Fila
                  etiqueta={`Tarifa básica (incluye ${preview.tarifa.consumoIncluido} m³)`}
                  valor={dinero(preview.tarifa.tarifaBasica)}
                />
                {desglose?.excedentes.map((ex, i) => (
                  <Fila
                    key={`ex${i}`}
                    etiqueta={`Excedente: ${ex.m3} m³ × ${dinero(ex.precio)}/m³`}
                    valor={dinero(ex.monto)}
                  />
                ))}
                {preview.tarifa.cargos?.map((c, i) => (
                  <Fila key={`cg${i}`} etiqueta={c.nombre} valor={dinero(c.monto)} />
                ))}
                <div className="mt-2 flex justify-between border-t pt-2 text-lg font-bold">
                  <span>Total a cobrar</span>
                  <span>
                    {dinero(
                      preview.montoConsumo +
                        sumaCargos(preview.tarifa.cargos ?? []),
                    )}
                  </span>
                </div>
              </dl>
            )}
          </div>

          <div className="space-y-1.5">
            <Label className="text-base">Fecha límite (opcional)</Label>
            <Input
              type="date"
              value={fechaLimite}
              onChange={(e) => setFechaLimite(e.target.value)}
              className="h-12 text-base"
            />
            <p className="text-sm text-muted-foreground">
              Si la deja vacía, se usa el último día del mes.
            </p>
          </div>

          <AvisoError mensaje={error} />

          <DialogFooter>
            <Button type="submit" size="lg" disabled={guardando || !lecturaValida}>
              {guardando ? "Guardando…" : "Guardar lectura"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Fila({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-muted-foreground">{etiqueta}</dt>
      <dd className="font-medium">{valor}</dd>
    </div>
  );
}
