"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
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
import { dinero, periodoLegible } from "@/lib/formato";
import { AvisoError, EstadoBadge, mensajeError } from "./comunes";
import type { Planilla } from "./tipos";

/**
 * Registrar pago a mano: abre un menú con las planillas pendientes del socio,
 * el tesorero marca los meses que pagó (uno, varios, con multa incluida) y
 * confirma. El total se calcula solo. Sirve cuando pagan en efectivo, varios
 * meses juntos, o mandan el comprobante por WhatsApp fuera de la app.
 */
export function RegistrarPago({
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
  const confirmarPagos = useMutation(api.planillas.confirmarPagos);

  // Selección explícita por planilla; sin valor = marcada por defecto.
  const [sel, setSel] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  // Pendientes (no pagadas), de la más antigua a la más nueva.
  const pendientes = useMemo(
    () =>
      (planillas ?? [])
        .filter((p) => p.estado !== "pagado")
        .sort((a, b) => a.anio - b.anio || a.mes - b.mes),
    [planillas],
  );

  const marcada = (id: string) => sel[id] ?? true;
  const seleccionadas = pendientes.filter((p) => marcada(p._id));
  const total = seleccionadas.reduce((acc, p) => acc + p.montoTotal, 0);

  function alCambiarApertura(o: boolean) {
    setAbierto(o);
    if (!o) {
      setSel({});
      setError(null);
    }
  }

  async function registrar() {
    if (seleccionadas.length === 0) return;
    setError(null);
    setGuardando(true);
    try {
      await confirmarPagos({
        token,
        planillaIds: seleccionadas.map((p) => p._id as Id<"planillas">),
      });
      alCambiarApertura(false);
    } catch (err) {
      setError(mensajeError(err, "No se pudo registrar el pago."));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Dialog open={abierto} onOpenChange={alCambiarApertura}>
      <DialogTrigger
        render={
          <Button size="sm" className="bg-green-600 text-white hover:bg-green-700">
            💵 Registrar pago
          </Button>
        }
      />
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-xl">Registrar pago de {nombre}</DialogTitle>
          <DialogDescription className="text-base">
            Marque los meses que pagó. El total se calcula solo.
          </DialogDescription>
        </DialogHeader>

        {planillas === undefined && (
          <p className="text-muted-foreground">Cargando…</p>
        )}

        {planillas && pendientes.length === 0 && (
          <p className="py-4 text-center text-lg">
            Este socio no tiene planillas pendientes. ✅
          </p>
        )}

        {pendientes.length > 0 && (
          <div className="space-y-2">
            {pendientes.map((p) => (
              <FilaPago
                key={p._id}
                planilla={p}
                marcada={marcada(p._id)}
                onToggle={(v) => setSel((prev) => ({ ...prev, [p._id]: v }))}
              />
            ))}
          </div>
        )}

        {pendientes.length > 0 && (
          <>
            <div className="flex items-center justify-between rounded-lg bg-muted p-4">
              <span className="text-lg">Total a registrar</span>
              <span className="text-2xl font-bold">{dinero(total)}</span>
            </div>
            <p className="text-sm text-muted-foreground">
              El monto de cada mes ya incluye sus multas. Para agregar una multa,
              use “Ver planillas”.
            </p>
            <AvisoError mensaje={error} />
            <DialogFooter>
              <Button
                size="lg"
                className="h-14 w-full bg-green-600 text-lg text-white hover:bg-green-700"
                onClick={registrar}
                disabled={guardando || seleccionadas.length === 0}
              >
                {guardando
                  ? "Guardando…"
                  : seleccionadas.length === 0
                    ? "Seleccione al menos un mes"
                    : `Confirmar pago de ${dinero(total)} · ${seleccionadas.length} ${
                        seleccionadas.length === 1 ? "mes" : "meses"
                      }`}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** Una planilla pendiente con su casilla, mes, estado y monto (multas incluidas). */
function FilaPago({
  planilla: p,
  marcada,
  onToggle,
}: {
  planilla: Planilla;
  marcada: boolean;
  onToggle: (v: boolean) => void;
}) {
  const conMulta = p.multas.length > 0;
  return (
    <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-input p-3 hover:bg-muted/40">
      <input
        type="checkbox"
        checked={marcada}
        onChange={(e) => onToggle(e.target.checked)}
        className="size-5"
      />
      <div className="min-w-0 flex-1">
        <div className="text-lg font-medium">{periodoLegible(p.anio, p.mes)}</div>
        <div className="mt-0.5 flex flex-wrap items-center gap-2">
          <EstadoBadge estado={p.estado} />
          {p.comprobantePorWhatsApp && (
            <span className="text-sm font-medium text-yellow-700">
              📱 por WhatsApp
            </span>
          )}
          {conMulta && (
            <span className="text-sm font-medium text-amber-700">con multa</span>
          )}
        </div>
      </div>
      <div className="text-lg font-semibold">{dinero(p.montoTotal)}</div>
    </label>
  );
}
