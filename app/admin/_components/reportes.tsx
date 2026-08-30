"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Card, CardContent } from "@/components/ui/card";
import { dinero, nombreJuntaMostrar, nombreMes } from "@/lib/formato";
import { mensajeRecordatorioDeuda } from "@/lib/whatsapp";
import { BotonWhatsApp } from "./boton-whatsapp";

const MESES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

/** Panel de reportes para la directiva: recaudación del mes + morosos. */
export function Reportes({ token }: { token: string }) {
  const ahora = new Date();
  const [anio, setAnio] = useState(ahora.getFullYear());
  const [mes, setMes] = useState(ahora.getMonth() + 1);

  const datos = useQuery(api.reportes.resumen, { token, anio, mes });
  const config = useQuery(api.config.obtener, {});
  const nombreJunta = nombreJuntaMostrar(config?.nombreJunta);
  const enlaceConsulta =
    typeof window !== "undefined" ? window.location.origin : "";

  // Años a elegir: los últimos 4 hasta el actual.
  const anios: number[] = [];
  for (let a = ahora.getFullYear(); a >= ahora.getFullYear() - 4; a--) {
    anios.push(a);
  }

  return (
    <div className="space-y-6">
      {/* Selector de período */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <label className="text-base font-medium">Mes</label>
          <select
            value={mes}
            onChange={(e) => setMes(Number(e.target.value))}
            className="h-12 w-full rounded-lg border border-input bg-transparent px-3 text-base"
          >
            {MESES.map((m) => (
              <option key={m} value={m}>
                {nombreMes(m)}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <label className="text-base font-medium">Año</label>
          <select
            value={anio}
            onChange={(e) => setAnio(Number(e.target.value))}
            className="h-12 w-full rounded-lg border border-input bg-transparent px-3 text-base"
          >
            {anios.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </div>
      </div>

      {datos === undefined && <p className="text-muted-foreground">Cargando…</p>}

      {datos && (
        <>
          {/* Tarjetas de totales */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Tarjeta
              titulo={`Recaudado en ${nombreMes(mes)}`}
              valor={dinero(datos.recaudado.monto)}
              detalle={`${datos.recaudado.count} pago(s) confirmado(s)`}
              tono="verde"
            />
            <Tarjeta
              titulo={`Pendiente de ${nombreMes(mes)}`}
              valor={dinero(datos.pendienteMes.monto)}
              detalle={`${datos.pendienteMes.count} planilla(s) sin pagar`}
              tono="rojo"
            />
            <Tarjeta
              titulo={`Emitido en ${nombreMes(mes)}`}
              valor={dinero(datos.emitido.monto)}
              detalle={`${datos.emitido.count} planilla(s) · ${datos.consumoMes} m³`}
            />
            <Tarjeta
              titulo="Total pendiente (toda la junta)"
              valor={dinero(datos.totalPendiente)}
              detalle={`${datos.morosos.length} socio(s) con deuda`}
              tono="rojo"
            />
          </div>

          {/* Morosos */}
          <section className="space-y-3">
            <h2 className="text-xl font-bold">
              Socios con deuda ({datos.morosos.length})
            </h2>
            {datos.morosos.length === 0 ? (
              <Card>
                <CardContent className="py-6 text-center text-lg">
                  Ningún socio tiene planillas pendientes. ¡Todos al día! ✅
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {datos.morosos.map((m) => (
                  <div
                    key={m.socioId}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card p-3"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 text-lg font-medium">
                        {m.nombre}
                        {!m.activo && (
                          <span className="rounded-full border border-gray-300 bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                            Inactivo
                          </span>
                        )}
                      </div>
                      <div className="text-base text-muted-foreground">
                        {m.meses} mes(es) · debe{" "}
                        <span className="font-semibold text-red-700">
                          {dinero(m.monto)}
                        </span>
                      </div>
                    </div>
                    <BotonWhatsApp
                      telefono={m.telefono}
                      label="Recordar"
                      mensaje={mensajeRecordatorioDeuda({
                        nombre: m.nombres || m.nombre,
                        nombreJunta,
                        meses: m.meses,
                        monto: dinero(m.monto),
                        enlaceConsulta,
                      })}
                    />
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}

/** Tarjeta grande con un total y su detalle. */
function Tarjeta({
  titulo,
  valor,
  detalle,
  tono,
}: {
  titulo: string;
  valor: string;
  detalle: string;
  tono?: "verde" | "rojo";
}) {
  const color =
    tono === "verde"
      ? "text-green-700"
      : tono === "rojo"
        ? "text-red-700"
        : "text-foreground";
  return (
    <Card>
      <CardContent className="space-y-1 py-4">
        <div className="text-base text-muted-foreground">{titulo}</div>
        <div className={`text-3xl font-bold ${color}`}>{valor}</div>
        <div className="text-sm text-muted-foreground">{detalle}</div>
      </CardContent>
    </Card>
  );
}
