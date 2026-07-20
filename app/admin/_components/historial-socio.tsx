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
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  dinero,
  fechaLegible,
  periodoLegible,
  TIPO_MULTA,
  type TipoMulta,
} from "@/lib/formato";
import { AvisoError, EstadoBadge, mensajeError } from "./comunes";
import type { Planilla } from "./tipos";

/** Diálogo con el historial de planillas de un socio, agrupado por año. */
export function HistorialSocio({
  token,
  socioId,
  nombre,
}: {
  token: string;
  socioId: Id<"socios">;
  nombre: string;
}) {
  const [abierto, setAbierto] = useState(false);
  const planillas = useQuery(
    api.planillas.listarPorSocio,
    abierto ? { token, socioId } : "skip",
  );

  // Agrupar por año conservando el orden descendente que llega del backend.
  const porAnio = new Map<number, Planilla[]>();
  for (const p of planillas ?? []) {
    const lista = porAnio.get(p.anio) ?? [];
    lista.push(p);
    porAnio.set(p.anio, lista);
  }
  const anios = [...porAnio.keys()];

  return (
    <Dialog open={abierto} onOpenChange={setAbierto}>
      <DialogTrigger
        render={
          <Button variant="outline" size="sm">
            Ver planillas
          </Button>
        }
      />
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl">Planillas de {nombre}</DialogTitle>
          <DialogDescription className="text-base">
            Historial por año. Aquí puede gestionar multas y corregir lecturas.
          </DialogDescription>
        </DialogHeader>

        {planillas === undefined && (
          <p className="text-muted-foreground">Cargando…</p>
        )}
        {planillas && planillas.length === 0 && (
          <p className="text-muted-foreground">
            Este socio todavía no tiene planillas registradas.
          </p>
        )}

        <div className="space-y-3">
          {anios.map((anio, idx) => (
            <details
              key={anio}
              open={idx === 0}
              className="rounded-lg border border-input"
            >
              <summary className="cursor-pointer select-none px-4 py-3 text-lg font-semibold">
                {anio}
              </summary>
              <div className="space-y-3 border-t p-3">
                {porAnio.get(anio)!.map((p) => (
                  <PlanillaItem key={p._id} token={token} planilla={p} />
                ))}
              </div>
            </details>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Una planilla dentro del historial, con sus acciones. */
function PlanillaItem({ token, planilla: p }: { token: string; planilla: Planilla }) {
  const confirmarPago = useMutation(api.planillas.confirmarPago);
  const rechazarPago = useMutation(api.planillas.rechazarPago);

  return (
    <div className="rounded-lg border border-input p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-lg font-semibold">
          {periodoLegible(p.anio, p.mes)}
        </span>
        <EstadoBadge estado={p.estado} />
      </div>

      <dl className="mt-2 space-y-1 text-base">
        <div className="flex justify-between gap-4">
          <dt className="text-muted-foreground">
            Consumo ({p.lecturaAnterior} → {p.lecturaActual} m³)
          </dt>
          <dd className="font-medium">{p.consumo} m³</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-muted-foreground">Consumo</dt>
          <dd className="font-medium">{dinero(p.montoConsumo)}</dd>
        </div>
        {p.multas.map((m, i) => (
          <div key={i} className="flex justify-between gap-4">
            <dt className="text-muted-foreground">
              {TIPO_MULTA[m.tipo as TipoMulta]}
              {m.descripcion ? ` — ${m.descripcion}` : ""}
            </dt>
            <dd className="font-medium">{dinero(m.monto)}</dd>
          </div>
        ))}
        <div className="mt-1 flex justify-between gap-4 border-t pt-1 text-lg font-bold">
          <dt>Total</dt>
          <dd>{dinero(p.montoTotal)}</dd>
        </div>
      </dl>

      <p className="mt-2 text-sm text-muted-foreground">
        Vence: {fechaLegible(p.fechaLimite)}
        {p.fechaPago ? ` · Pagado: ${fechaLegible(p.fechaPago)}` : ""}
      </p>

      {/* Comprobante en revisión */}
      {p.estado === "en_revision" && (
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-md bg-yellow-50 p-3">
          <span className="text-sm text-yellow-800">
            Comprobante enviado, pendiente de revisión.
          </span>
          {p.comprobanteUrl && (
            <a
              href={p.comprobanteUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium underline underline-offset-4"
            >
              Ver comprobante
            </a>
          )}
          <div className="ml-auto flex gap-2">
            <Button
              size="sm"
              className="bg-green-600 text-white hover:bg-green-700"
              onClick={() => confirmarPago({ token, planillaId: p._id })}
            >
              Confirmar pago
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => rechazarPago({ token, planillaId: p._id })}
            >
              Rechazar
            </Button>
          </div>
        </div>
      )}

      {/* Herramientas del tesorero */}
      <div className="mt-3 space-y-2">
        <EditarLectura token={token} planilla={p} />
        <GestionMultas token={token} planilla={p} />
      </div>
    </div>
  );
}

/** Corregir la lectura actual de una planilla existente. */
function EditarLectura({ token, planilla: p }: { token: string; planilla: Planilla }) {
  const editarLectura = useMutation(api.planillas.editarLectura);
  const [valor, setValor] = useState(String(p.lecturaActual));
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setGuardando(true);
    try {
      await editarLectura({
        token,
        planillaId: p._id,
        lecturaActual: Number(valor) || 0,
      });
    } catch (err) {
      setError(mensajeError(err, "No se pudo corregir la lectura."));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <details className="rounded-md border border-input">
      <summary className="cursor-pointer select-none px-3 py-2 text-base font-medium">
        Corregir lectura
      </summary>
      <form onSubmit={guardar} className="space-y-2 border-t p-3">
        <Label className="text-base">Lectura actual (m³)</Label>
        <div className="flex gap-2">
          <Input
            type="number"
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            className="h-11 text-base"
          />
          <Button type="submit" disabled={guardando}>
            {guardando ? "…" : "Guardar"}
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">
          El consumo y el monto se recalculan automáticamente.
        </p>
        <AvisoError mensaje={error} />
      </form>
    </details>
  );
}

/** Agregar / quitar multas de una planilla. */
function GestionMultas({ token, planilla: p }: { token: string; planilla: Planilla }) {
  const agregarMulta = useMutation(api.planillas.agregarMulta);
  const quitarMulta = useMutation(api.planillas.quitarMulta);

  const [tipo, setTipo] = useState<TipoMulta>("mora");
  const [descripcion, setDescripcion] = useState("");
  const [monto, setMonto] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  async function agregar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setGuardando(true);
    try {
      await agregarMulta({
        token,
        planillaId: p._id,
        tipo,
        descripcion: descripcion.trim(),
        monto: Number(monto) || 0,
      });
      setDescripcion("");
      setMonto("");
      setTipo("mora");
    } catch (err) {
      setError(mensajeError(err, "No se pudo agregar la multa."));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <details className="rounded-md border border-input">
      <summary className="cursor-pointer select-none px-3 py-2 text-base font-medium">
        Multas ({p.multas.length})
      </summary>
      <div className="space-y-3 border-t p-3">
        {p.multas.length > 0 && (
          <ul className="space-y-2">
            {p.multas.map((m, i) => (
              <li
                key={i}
                className="flex items-center justify-between gap-3 rounded-md bg-muted/40 px-3 py-2 text-base"
              >
                <span>
                  {TIPO_MULTA[m.tipo as TipoMulta]}
                  {m.descripcion ? ` — ${m.descripcion}` : ""} · {dinero(m.monto)}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-red-700 hover:text-red-800"
                  onClick={() => quitarMulta({ token, planillaId: p._id, indice: i })}
                >
                  Quitar
                </Button>
              </li>
            ))}
          </ul>
        )}

        <form onSubmit={agregar} className="space-y-2">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label className="text-base">Tipo</Label>
              <select
                value={tipo}
                onChange={(e) => setTipo(e.target.value as TipoMulta)}
                className="h-11 w-full rounded-lg border border-input bg-transparent px-3 text-base"
              >
                <option value="mora">Mora</option>
                <option value="minga">Minga</option>
                <option value="otro">Otro</option>
              </select>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-base">Descripción</Label>
              <Input
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                className="h-11 text-base"
              />
            </div>
          </div>
          <div className="flex items-end gap-2">
            <div className="flex-1 space-y-1.5">
              <Label className="text-base">Monto ($)</Label>
              <Input
                type="number"
                value={monto}
                onChange={(e) => setMonto(e.target.value)}
                className="h-11 text-base"
              />
            </div>
            <Button type="submit" disabled={guardando}>
              {guardando ? "…" : "Agregar"}
            </Button>
          </div>
          <AvisoError mensaje={error} />
        </form>
      </div>
    </details>
  );
}
