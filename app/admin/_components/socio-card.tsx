"use client";

import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { dinero, nombreJuntaMostrar, periodoLegible } from "@/lib/formato";
import { mensajeRecordatorioPlanilla } from "@/lib/whatsapp";
import { EstadoBadge } from "./comunes";
import { BotonWhatsApp } from "./boton-whatsapp";
import { RegistrarPago } from "./registrar-pago";
import { FormSocio } from "./form-socio";
import { RegistrarLectura } from "./registrar-lectura";
import { HistorialSocio } from "./historial-socio";
import type { SocioListado } from "./tipos";

/** Tarjeta de un socio con su estado del mes y las acciones del tesorero. */
export function SocioCard({ token, socio }: { token: string; socio: SocioListado }) {
  const eliminar = useMutation(api.socios.eliminar);
  const confirmarPago = useMutation(api.planillas.confirmarPago);
  const rechazarPago = useMutation(api.planillas.rechazarPago);
  const config = useQuery(api.config.obtener, {});

  const nombre = `${socio.apellidos} ${socio.nombres}`;
  const pendiente = socio.pendiente;

  // Recordatorio de WhatsApp para la planilla pendiente (si la hay).
  const mensajeWhatsApp =
    pendiente &&
    mensajeRecordatorioPlanilla({
      nombre: socio.nombres,
      nombreJunta: nombreJuntaMostrar(config?.nombreJunta),
      periodo: periodoLegible(pendiente.anio, pendiente.mes),
      monto: dinero(pendiente.montoTotal),
      enlaceConsulta:
        typeof window !== "undefined" ? window.location.origin : "",
    });

  async function eliminarSocio() {
    if (!confirm(`¿Eliminar a ${nombre} y todo su historial? Esta acción no se puede deshacer.`)) {
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
          {pendiente ? (
            <EstadoBadge estado={pendiente.estado} />
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

        {pendiente ? (
          <p className="text-base">
            {periodoLegible(pendiente.anio, pendiente.mes)}:{" "}
            <span className="font-semibold">{dinero(pendiente.montoTotal)}</span>
          </p>
        ) : (
          <p className="text-base text-muted-foreground">Sin planillas pendientes.</p>
        )}

        {/* Registrar pago a mano: efectivo, comprobante por WhatsApp, o varios meses */}
        {pendiente && (
          <div className="flex flex-wrap items-center gap-2 rounded-md bg-green-50 p-3">
            <span className="text-sm text-green-800">
              ¿Ya pagó? Registre el pago (uno o varios meses).
            </span>
            <div className="ml-auto">
              <RegistrarPago token={token} socioId={socio._id} nombre={nombre} />
            </div>
          </div>
        )}

        {/* Comprobante pendiente de revisión */}
        {pendiente?.estado === "en_revision" && (
          <div className="flex flex-wrap items-center gap-2 rounded-md bg-yellow-50 p-3">
            <span className="text-sm text-yellow-800">
              Comprobante enviado, pendiente de revisión.
            </span>
            {pendiente.comprobanteUrl && (
              <a
                href={pendiente.comprobanteUrl}
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
                onClick={() => confirmarPago({ token, planillaId: pendiente._id })}
              >
                Confirmar pago
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => rechazarPago({ token, planillaId: pendiente._id })}
              >
                Rechazar
              </Button>
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <RegistrarLectura token={token} socioId={socio._id} nombre={nombre} />
          {pendiente && mensajeWhatsApp && (
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
