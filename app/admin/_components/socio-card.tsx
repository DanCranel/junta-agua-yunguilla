"use client";

import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { dinero, esVencidaHoy, nombreJuntaMostrar } from "@/lib/formato";
import { periodoLegible } from "@/lib/formato";
import { mensajeRecordatorioDeuda } from "@/lib/whatsapp";
import { BotonWhatsApp } from "./boton-whatsapp";
import { RegistrarPago } from "./registrar-pago";
import { FormSocio } from "./form-socio";
import { RegistrarLectura } from "./registrar-lectura";
import { HistorialSocio } from "./historial-socio";
import type { SocioListado } from "./tipos";

type Pendiente = SocioListado["pendientes"][number];

/** Tarjeta de un socio: resumen de su deuda y las acciones del tesorero. */
export function SocioCard({ token, socio }: { token: string; socio: SocioListado }) {
  const eliminar = useMutation(api.socios.eliminar);
  const confirmarPagos = useMutation(api.planillas.confirmarPagos);
  const rechazarPagos = useMutation(api.planillas.rechazarPagos);
  const config = useQuery(api.config.obtener, {});

  const nombre = `${socio.apellidos} ${socio.nombres}`;
  const pendientes = socio.pendientes;
  const total = pendientes.reduce((acc, p) => acc + p.montoTotal, 0);
  const enRevision = pendientes.filter((p) => p.estado === "en_revision");
  const porPagar = pendientes.filter((p) => p.estado === "por_pagar");
  const hayVencida = pendientes.some((p) => esVencidaHoy(p.estado, p.fechaLimite));

  // Agrupar los comprobantes "en revisión" por envío (los meses que el socio
  // mandó juntos). Sin grupo (envíos viejos) = cada uno por su cuenta.
  const grupos: { key: string; items: Pendiente[] }[] = [];
  const idxPorClave = new Map<string, number>();
  for (const p of enRevision) {
    const clave = p.grupoEnvio ?? p._id;
    if (!idxPorClave.has(clave)) {
      idxPorClave.set(clave, grupos.length);
      grupos.push({ key: clave, items: [] });
    }
    grupos[idxPorClave.get(clave)!].items.push(p);
  }

  const mensajeWhatsApp =
    pendientes.length > 0 &&
    mensajeRecordatorioDeuda({
      nombre: socio.nombres,
      nombreJunta: nombreJuntaMostrar(config?.nombreJunta),
      meses: pendientes.length,
      monto: dinero(total),
      enlaceConsulta:
        typeof window !== "undefined" ? window.location.origin : "",
    });

  async function eliminarSocio() {
    if (
      !confirm(
        `¿Eliminar a ${nombre} y todo su historial? Esta acción no se puede deshacer.`,
      )
    ) {
      return;
    }
    await eliminar({ token, id: socio._id });
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex flex-wrap items-center justify-between gap-2 text-lg">
          <span className="flex items-center gap-2">
            {socio.apellidos} {socio.nombres}
            {!socio.activo && (
              <span className="rounded-full border border-gray-300 bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                Inactivo
              </span>
            )}
          </span>
          {pendientes.length > 0 ? (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-red-200 bg-red-100 px-3 py-0.5 text-sm font-medium text-red-800">
              Debe {pendientes.length}{" "}
              {pendientes.length === 1 ? "mes" : "meses"} · {dinero(total)}
            </span>
          ) : (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-green-200 bg-green-100 px-3 py-0.5 text-sm font-medium text-green-800">
              ✅ Al día
            </span>
          )}
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted-foreground">
          <span>Cédula: {socio.cedula}</span>
          {socio.numeroMedidor && <span>Medidor: {socio.numeroMedidor}</span>}
        </div>

        {/* Detalle de la deuda: resumen que se expande */}
        {pendientes.length > 0 && (
          <details className="rounded-md border border-input">
            <summary className="flex cursor-pointer select-none flex-wrap items-center gap-2 px-3 py-2 text-base font-medium">
              Ver detalle de la deuda
              {enRevision.length > 0 && (
                <span className="rounded-full border border-yellow-300 bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-800">
                  {enRevision.length} por revisar
                </span>
              )}
              {hayVencida && (
                <span className="rounded-full border border-red-300 bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800">
                  🔴 Vencida
                </span>
              )}
            </summary>

            <div className="space-y-3 border-t p-3">
              {/* Comprobantes por revisar, agrupados por envío */}
              {grupos.map((g) => {
                const t = g.items.reduce((acc, p) => acc + p.montoTotal, 0);
                const porWhats = g.items.some((p) => p.comprobantePorWhatsApp);
                const url = g.items.find((p) => p.comprobanteUrl)?.comprobanteUrl;
                const meses = g.items
                  .map((p) => periodoLegible(p.anio, p.mes))
                  .join(", ");
                const ids = g.items.map((p) => p._id);
                return (
                  <div key={g.key} className="space-y-2 rounded-md bg-yellow-50 p-3">
                    <p className="text-sm font-medium text-yellow-900">
                      Comprobante enviado · {meses} · {dinero(t)}
                    </p>
                    {porWhats ? (
                      <p className="text-sm text-yellow-800">
                        📱 Enviado por WhatsApp — revíselo en su WhatsApp.
                      </p>
                    ) : url ? (
                      <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm font-medium underline underline-offset-4"
                      >
                        Ver comprobante
                      </a>
                    ) : null}
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        className="bg-green-600 text-white hover:bg-green-700"
                        onClick={() => confirmarPagos({ token, planillaIds: ids })}
                      >
                        {g.items.length > 1
                          ? `Confirmar los ${g.items.length}`
                          : "Confirmar pago"}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => rechazarPagos({ token, planillaIds: ids })}
                      >
                        Rechazar
                      </Button>
                    </div>
                  </div>
                );
              })}

              {/* Meses aún por pagar (sin comprobante) */}
              {porPagar.length > 0 && (
                <div className="space-y-2 rounded-md bg-muted/40 p-3">
                  <p className="text-sm font-medium">
                    Aún sin pagar ({porPagar.length}):
                  </p>
                  <ul className="space-y-1 text-sm">
                    {porPagar.map((p) => (
                      <li key={p._id} className="flex justify-between gap-3">
                        <span>
                          {periodoLegible(p.anio, p.mes)}
                          {esVencidaHoy(p.estado, p.fechaLimite) && (
                            <span className="ml-1 font-medium text-red-700">
                              · vencida
                            </span>
                          )}
                        </span>
                        <span className="font-medium">{dinero(p.montoTotal)}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="flex justify-end">
                    <RegistrarPago token={token} socioId={socio._id} nombre={nombre} />
                  </div>
                </div>
              )}
            </div>
          </details>
        )}

        <div className="flex flex-wrap gap-2">
          <RegistrarLectura token={token} socioId={socio._id} nombre={nombre} />
          {pendientes.length > 0 && mensajeWhatsApp && (
            <BotonWhatsApp
              telefono={socio.telefono}
              mensaje={mensajeWhatsApp}
              label="Recordar"
            />
          )}
          <HistorialSocio token={token} socioId={socio._id} nombre={nombre} />
          <FormSocio token={token} socio={socio} triggerLabel="Editar" variant="outline" />
          <Button
            variant="outline"
            size="sm"
            className="text-red-700 hover:text-red-800"
            onClick={eliminarSocio}
          >
            Eliminar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
