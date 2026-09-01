"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ESTADO_INFO,
  TIPO_MULTA,
  dinero,
  esVencidaHoy,
  fechaLegible,
  nombreJuntaMostrar,
  nombreMes,
  periodoLegible,
  type Estado,
  type TipoMulta,
} from "@/lib/formato";
import { descargarPlanillaPDF } from "@/lib/pdf";
import { desgloseConsumo } from "@/convex/lib";
import { enlaceWhatsApp } from "@/lib/whatsapp";

// ---------------------------------------------------------------------------
// Tipos (espejo de lo que devuelve la API de Convex).
// ---------------------------------------------------------------------------

type Multa = { tipo: string; descripcion: string; monto: number };

type Planilla = {
  _id: string;
  socioId: string;
  anio: number;
  mes: number;
  lecturaAnterior: number;
  lecturaActual: number;
  consumo: number;
  montoConsumo: number;
  multas: Multa[];
  cargos?: { nombre: string; monto: number }[];
  montoTotal: number;
  estado: Estado;
  fechaLimite: string;
  fechaPago?: string;
  comprobanteId?: string;
  comprobantePorWhatsApp?: boolean;
};

type Socio = {
  _id: string;
  cedula: string;
  nombres: string;
  apellidos: string;
  direccion?: string;
  numeroMedidor?: string;
};

type Tarifa = {
  tarifaBasica: number;
  consumoIncluido: number;
  precioExcedente?: number;
  tramos?: { hasta: number | null; precio: number }[];
};

type Config = {
  nombreJunta?: string;
  banco: string;
  tipoCuenta: string;
  numeroCuenta: string;
  titular: string;
  identificacionTitular: string;
  whatsappTesorero?: string;
  videoAyudaUrl?: string;
} | null;

// ---------------------------------------------------------------------------
// Página principal: formulario de consulta + resultados.
// ---------------------------------------------------------------------------

export default function ConsultaPage() {
  const [cedula, setCedula] = useState("");
  const [apellido, setApellido] = useState("");
  // Valores "confirmados" al presionar Consultar (dispara la búsqueda).
  const [busqueda, setBusqueda] = useState<{
    cedula: string;
    apellido: string;
  } | null>(null);

  // Solo consulta cuando ya se presionó el botón.
  const resultado = useQuery(api.socios.buscar, busqueda ? busqueda : "skip");
  const config = useQuery(api.config.obtener, {}) as Config | undefined;

  const nombreJunta = nombreJuntaMostrar(config?.nombreJunta);

  const cargando = busqueda !== null && resultado === undefined;

  // Ancla para bajar la pantalla automáticamente cuando llega el resultado, de
  // modo que el usuario vea que abajo cargó su información (audiencia mayor).
  const resultadoRef = useRef<HTMLDivElement>(null);

  // El título de la pestaña sigue el nombre configurado por la junta.
  useEffect(() => {
    document.title = nombreJunta;
  }, [nombreJunta]);

  // Al llegar el resultado de una búsqueda, desplaza suavemente hacia él para
  // que el usuario note que abajo cargó su información. Se difiere un momento
  // para que el resultado ya esté pintado y el desplazamiento sea consistente.
  const scrollHechoRef = useRef<object | null>(null);
  useEffect(() => {
    if (!busqueda || resultado === undefined) return;
    if (scrollHechoRef.current === busqueda) return; // una sola vez por búsqueda
    scrollHechoRef.current = busqueda;
    const id = setTimeout(() => {
      resultadoRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 150);
    return () => clearTimeout(id);
  }, [busqueda, resultado]);

  function consultar(e: React.FormEvent) {
    e.preventDefault();
    if (!cedula.trim() || !apellido.trim()) return;
    setBusqueda({ cedula: cedula.trim(), apellido: apellido.trim() });
  }

  return (
    <main className="mx-auto w-full max-w-xl px-4 py-8">
      <header className="mb-8 text-center">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          {nombreJunta}
        </h1>
        <p className="mt-2 text-lg text-muted-foreground">
          Consulte cuánto debe por el servicio de agua
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Consultar mi deuda</CardTitle>
          <CardDescription className="text-base">
            Escriba su número de cédula y su apellido.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={consultar} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="cedula" className="text-lg">
                Número de cédula
              </Label>
              <Input
                id="cedula"
                inputMode="numeric"
                placeholder="Ej. 0102030405"
                value={cedula}
                onChange={(e) => setCedula(e.target.value)}
                className="h-14 text-lg"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="apellido" className="text-lg">
                Apellido
              </Label>
              <Input
                id="apellido"
                placeholder="Ej. Guamán"
                value={apellido}
                onChange={(e) => setApellido(e.target.value)}
                className="h-14 text-lg"
              />
            </div>
            <Button
              type="submit"
              className="h-14 w-full text-lg"
              disabled={cargando}
            >
              {cargando ? "Consultando…" : "Consultar"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Video instructivo (si la junta lo configuró) */}
      {config?.videoAyudaUrl && (
        <div className="mt-4 text-center">
          <a
            href={config.videoAyudaUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 rounded-lg border-2 border-primary bg-primary/5 px-5 py-3 text-lg font-medium text-primary transition-colors hover:bg-primary/10"
          >
            <span aria-hidden>▶</span> Aprenda a usar esta página
          </a>
        </div>
      )}

      {/* Resultado de la consulta (ancla del desplazamiento automático) */}
      <div ref={resultadoRef} className="scroll-mt-4">
        {resultado && resultado.encontrado === false && (
          <Card className="mt-6 border-red-200">
            <CardContent className="py-6 text-center text-lg">
              No encontramos datos con esa cédula y apellido. Revise que estén
              bien escritos o acérquese a la junta.
            </CardContent>
          </Card>
        )}

        {resultado && resultado.encontrado === true && (
          <ResultadoSocio
            socio={resultado.socio}
            planillas={resultado.planillas}
          />
        )}
      </div>

      <div className="mt-10 text-center">
        <Link
          href="/admin"
          className="text-sm text-muted-foreground underline underline-offset-4"
        >
          Ingreso del tesorero
        </Link>
      </div>

      <footer className="mt-6 text-center text-xs text-muted-foreground">
        Hecho por{" "}
        <a
          href="https://cranelstudios.com"
          target="_blank"
          rel="noopener noreferrer"
          className="underline underline-offset-4 hover:text-foreground"
        >
          Cranel Studios
        </a>
      </footer>
    </main>
  );
}

// ---------------------------------------------------------------------------
// Resultado: planilla pendiente destacada + historial por año.
// ---------------------------------------------------------------------------

function ResultadoSocio({
  socio,
  planillas,
}: {
  socio: Socio;
  planillas: Planilla[];
}) {
  // Estas queries solo se disparan cuando ya hay un socio (este componente
  // se monta únicamente al encontrar resultados).
  const tarifa = useQuery(api.tarifas.obtener, {}) as Tarifa | undefined;
  const config = useQuery(api.config.obtener, {}) as Config | undefined;

  // Todas las planillas sin pagar, de la más antigua a la más nueva (se paga
  // primero lo más viejo). `planillas` viene DESC, así que la reordenamos.
  const pendientes = planillas
    .filter((p) => p.estado !== "pagado")
    .sort((a, b) => a.anio - b.anio || a.mes - b.mes);

  return (
    <div className="mt-6 space-y-8">
      {pendientes.length > 0 ? (
        <PlanillasPorPagar
          socio={socio}
          pendientes={pendientes}
          tarifa={tarifa}
          config={config ?? null}
        />
      ) : (
        <Card className="border-green-200">
          <CardContent className="py-8 text-center text-xl">
            No tiene deudas pendientes. ¡Está al día! ✅
          </CardContent>
        </Card>
      )}

      <HistorialAnios
        socio={socio}
        planillas={planillas}
        tarifa={tarifa}
        config={config ?? null}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Planillas por pagar: el socio elige qué mes(es) paga (uno, varios o todos).
// ---------------------------------------------------------------------------

function PlanillasPorPagar({
  socio,
  pendientes,
  tarifa,
  config,
}: {
  socio: Socio;
  pendientes: Planilla[];
  tarifa: Tarifa | undefined;
  config: Config;
}) {
  const marcarWhatsApp = useMutation(api.planillas.marcarComprobanteWhatsApp);
  // El socio pidió corregir un comprobante ya enviado: reabre el envío.
  const [corrigiendo, setCorrigiendo] = useState(false);

  const porPagar = pendientes.filter((p) => p.estado === "por_pagar");
  const enRevision = pendientes.filter((p) => p.estado === "en_revision");

  // Meses que se pueden enviar ahora: los que están por pagar; y, si el socio
  // está corrigiendo, también los que ya envió (para reemplazarlos).
  const enviables = corrigiendo ? pendientes : porPagar;
  const bloqueados = corrigiendo ? [] : enRevision;

  // Selección dentro de los enviables (todos marcados por defecto).
  const [sel, setSel] = useState<Record<string, boolean>>({});
  const marcada = (p: Planilla) => sel[p._id] ?? true;
  const seleccionadas = enviables.filter(marcada);
  const total = seleccionadas.reduce((acc, p) => acc + p.montoTotal, 0);

  // Mensaje de WhatsApp con la identidad del socio ya escrita y los meses.
  const periodosSel = seleccionadas
    .map((p) => periodoLegible(p.anio, p.mes))
    .join(", ");
  const mensajeWhatsApp =
    `Hola, soy ${socio.nombres} ${socio.apellidos}. Mi cédula es ${socio.cedula}. ` +
    `Le envío el comprobante de pago de mi planilla de agua` +
    (periodosSel ? ` (${periodosSel})` : "") +
    `. Adjunto la foto del comprobante.`;

  // Al tocar WhatsApp: marca los meses como enviados por WhatsApp (en segundo
  // plano) y cierra el envío; el enlace sigue abriendo WhatsApp.
  function alTocarWhatsApp() {
    if (seleccionadas.length === 0) return;
    void marcarWhatsApp({
      cedula: socio.cedula,
      apellido: socio.apellidos,
      planillaIds: seleccionadas.map((p) => p._id as Id<"planillas">),
    });
    setCorrigiendo(false);
    setSel({});
  }

  function alEnviarComprobante() {
    setCorrigiendo(false);
    setSel({});
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl">
          {socio.nombres} {socio.apellidos}
        </CardTitle>
        <CardDescription className="text-base">
          {pendientes.length === 1
            ? "Tiene 1 mes pendiente"
            : `Tiene ${pendientes.length} meses pendientes`}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5 text-lg">
        {/* Meses ya enviados, en espera de revisión (bloqueados) */}
        {bloqueados.length > 0 && (
          <div className="space-y-2 rounded-lg border border-yellow-300 bg-yellow-50 p-4">
            <p className="text-lg font-semibold text-yellow-900">
              ✅ Comprobante enviado
            </p>
            <p className="text-base text-yellow-900">
              {bloqueados.length === 1 ? "El mes de " : "Los meses de "}
              {bloqueados.map((p) => periodoLegible(p.anio, p.mes)).join(", ")}{" "}
              {bloqueados.length === 1 ? "está" : "están"} en revisión. Espere a
              que el tesorero confirme el pago.
            </p>
            <button
              type="button"
              onClick={() => setCorrigiendo(true)}
              className="text-base font-medium text-yellow-900 underline underline-offset-4 hover:text-yellow-950"
            >
              ¿Envió algo incorrecto? Corregir
            </button>
          </div>
        )}

        {/* Meses por pagar (o en corrección): selección + envío */}
        {enviables.length > 0 && (
          <>
            <p className="text-base text-muted-foreground">
              Marque el mes o los meses que va a pagar.
            </p>

            <div className="space-y-3">
              {enviables.map((p) => (
                <MesPorPagar
                  key={p._id}
                  socio={socio}
                  planilla={p}
                  tarifa={tarifa}
                  config={config}
                  marcada={marcada(p)}
                  onToggle={(v) => setSel((prev) => ({ ...prev, [p._id]: v }))}
                />
              ))}
            </div>

            <div className="rounded-lg bg-muted p-4 text-center">
              <div className="text-base text-muted-foreground">
                Total a pagar ·{" "}
                {seleccionadas.length === 1
                  ? "1 mes"
                  : `${seleccionadas.length} meses`}
              </div>
              <div className="text-4xl font-bold">{dinero(total)}</div>
            </div>

            {config && (
              <div className="rounded-lg border bg-muted/40 p-4">
                <div className="text-base font-semibold">Cómo pagar</div>
                <p className="mt-1 text-base text-muted-foreground">
                  Realice la transferencia a esta cuenta y luego envíe la foto del
                  comprobante.
                </p>
                <dl className="mt-3 space-y-2">
                  <Fila etiqueta="Banco" valor={config.banco} />
                  <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b py-2">
                    <dt className="text-muted-foreground">
                      {`Cuenta ${config.tipoCuenta}`}
                    </dt>
                    <div className="flex items-center gap-3">
                      <dd className="text-right font-medium">
                        {config.numeroCuenta}
                      </dd>
                      <BotonCopiar texto={config.numeroCuenta} />
                    </div>
                  </div>
                  <Fila etiqueta="Titular" valor={config.titular} />
                  <Fila
                    etiqueta="Identificación"
                    valor={config.identificacionTitular}
                  />
                </dl>
              </div>
            )}

            <SubirComprobante
              planillaIds={seleccionadas.map((p) => p._id)}
              cedula={socio.cedula}
              apellido={socio.apellidos}
              onEnviado={alEnviarComprobante}
            />

            {config?.whatsappTesorero && (
              <div className="rounded-lg border border-green-300 bg-green-50 p-4 text-center">
                <p className="text-base text-green-900">
                  ¿Se le complica subir la foto? También puede enviar el
                  comprobante por WhatsApp al tesorero.
                </p>
                <a
                  href={enlaceWhatsApp(config.whatsappTesorero, mensajeWhatsApp)}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={alTocarWhatsApp}
                  className={`mt-3 inline-flex h-14 w-full items-center justify-center gap-2 rounded-lg text-lg font-medium text-white transition-colors ${
                    seleccionadas.length === 0
                      ? "pointer-events-none bg-green-300"
                      : "bg-green-600 hover:bg-green-700"
                  }`}
                >
                  💬 Enviar comprobante por WhatsApp
                </a>
                <p className="mt-2 text-sm text-green-800">
                  Se abre WhatsApp con sus datos ya escritos. Solo adjunte la foto
                  del comprobante y presione enviar.
                </p>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Un mes por pagar: casilla para seleccionarlo, monto (con multas incluidas),
 * estado, y un detalle desplegable con el desglose y la descarga del PDF.
 */
function MesPorPagar({
  socio,
  planilla,
  tarifa,
  config,
  marcada,
  onToggle,
}: {
  socio: Socio;
  planilla: Planilla;
  tarifa: Tarifa | undefined;
  config: Config;
  marcada: boolean;
  onToggle: (v: boolean) => void;
}) {
  const consumo = Math.max(0, planilla.consumo);
  const desglose = tarifa ? desgloseConsumo(planilla.consumo, tarifa) : null;
  const enRevision = planilla.estado === "en_revision";

  return (
    <div className="rounded-lg border">
      <label className="flex cursor-pointer items-center gap-3 p-4">
        <input
          type="checkbox"
          checked={marcada}
          onChange={(e) => onToggle(e.target.checked)}
          className="size-6"
        />
        <div className="min-w-0 flex-1">
          <div className="text-lg font-medium">
            {periodoLegible(planilla.anio, planilla.mes)}
          </div>
          {enRevision && (
            <div className="text-sm text-yellow-700">
              En revisión — ya envió comprobante
            </div>
          )}
          {esVencidaHoy(planilla.estado, planilla.fechaLimite) && (
            <div className="text-sm font-medium text-red-700">
              🔴 Vencida — pague pronto
            </div>
          )}
        </div>
        <div className="text-xl font-bold">{dinero(planilla.montoTotal)}</div>
      </label>

      <details className="border-t">
        <summary className="cursor-pointer list-none px-4 py-2 text-base text-muted-foreground">
          Ver detalle
        </summary>
        <div className="px-4 pb-4">
          <dl className="space-y-2">
            {desglose && (
              <Fila etiqueta="Tarifa básica" valor={dinero(desglose.basica)} />
            )}
            {desglose?.excedentes.map((ex, i) => (
              <Fila
                key={`ex${i}`}
                etiqueta={`Excedente ${ex.m3} m³ × ${dinero(ex.precio)}/m³`}
                valor={dinero(ex.monto)}
              />
            ))}
            {planilla.cargos?.map((c, i) => (
              <Fila key={`cg${i}`} etiqueta={c.nombre} valor={dinero(c.monto)} />
            ))}
            {planilla.multas.map((m, i) => (
              <Fila
                key={i}
                etiqueta={`${TIPO_MULTA[m.tipo as TipoMulta] ?? m.tipo}${
                  m.descripcion ? ` — ${m.descripcion}` : ""
                }`}
                valor={dinero(m.monto)}
              />
            ))}
            <Fila etiqueta="Total" valor={dinero(planilla.montoTotal)} fuerte />
            <Fila etiqueta="Consumo del mes" valor={`${consumo} m³`} />
            <Fila
              etiqueta="Pagar hasta"
              valor={fechaLegible(planilla.fechaLimite)}
            />
          </dl>
          <Button
            type="button"
            variant="outline"
            className="mt-3 h-12 w-full text-base"
            onClick={() =>
              tarifa && descargarPlanillaPDF({ socio, planilla, tarifa, config })
            }
            disabled={!tarifa}
          >
            Descargar PDF de este mes
          </Button>
        </div>
      </details>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Subida de comprobante de pago.
// ---------------------------------------------------------------------------

type EstadoSubida = "idle" | "subiendo" | "exito" | "error";

function SubirComprobante({
  planillaIds,
  cedula,
  apellido,
  onEnviado,
}: {
  planillaIds: string[];
  cedula: string;
  apellido: string;
  onEnviado?: () => void;
}) {
  const generarUrlSubida = useMutation(api.planillas.generarUrlSubida);
  const adjuntarComprobante = useMutation(api.planillas.adjuntarComprobante);

  const [archivo, setArchivo] = useState<File | null>(null);
  const [estado, setEstado] = useState<EstadoSubida>("idle");
  const [mensajeError, setMensajeError] = useState<string | null>(null);

  // Inputs de archivo ocultos: los disparan los botones grandes de abajo.
  const camaraRef = useRef<HTMLInputElement>(null);
  const archivoRef = useRef<HTMLInputElement>(null);

  function elegir(e: React.ChangeEvent<HTMLInputElement>) {
    setArchivo(e.target.files?.[0] ?? null);
    if (estado === "error") setEstado("idle");
  }

  async function enviar() {
    if (!archivo || planillaIds.length === 0) return;
    setEstado("subiendo");
    setMensajeError(null);
    try {
      // Se sube una copia del comprobante para cada mes seleccionado: cada
      // planilla guarda su propio archivo (no se comparte entre meses).
      for (const id of planillaIds) {
        const url = await generarUrlSubida({ cedula, apellido });
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": archivo.type },
          body: archivo,
        });
        if (!res.ok) throw new Error("Fallo la subida del archivo");
        const { storageId } = await res.json();
        const resultado = await adjuntarComprobante({
          planillaId: id as Id<"planillas">,
          storageId,
          cedula,
          apellido,
        });
        // El servidor puede rechazar el archivo (tipo/tamaño) o la identidad y
        // devuelve el motivo; en ese caso lo mostramos sin tratarlo como caída.
        if (!resultado.ok) {
          setMensajeError(resultado.mensaje);
          setEstado("error");
          return;
        }
      }
      setEstado("exito");
      setArchivo(null);
      onEnviado?.();
    } catch (err) {
      // Error inesperado (red, o identidad rechazada al pedir la URL de subida).
      const data = (err as { data?: unknown }).data;
      const mensaje =
        data && typeof data === "object" && "mensaje" in data
          ? String((data as { mensaje: unknown }).mensaje)
          : null;
      setMensajeError(mensaje);
      setEstado("error");
    }
  }

  if (estado === "exito") {
    return (
      <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-center text-base text-green-800">
        Comprobante enviado. Los meses quedan en revisión. ✅
      </div>
    );
  }

  const deshabilitado = estado === "subiendo";

  return (
    <div className="space-y-4 rounded-lg border p-4">
      <div className="text-base font-semibold">Subir comprobante de pago</div>
      <p className="text-base text-muted-foreground">
        Tome una foto de su comprobante o suba el archivo desde su teléfono.
      </p>

      {/* Inputs ocultos */}
      <input
        ref={camaraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={elegir}
      />
      <input
        ref={archivoRef}
        type="file"
        accept="image/*,application/pdf"
        className="hidden"
        onChange={elegir}
      />

      {/* Dos botones grandes con interacción al pasar el mouse */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <BotonSubida
          emoji="📷"
          titulo="Tomar foto"
          descripcion="Con la cámara"
          onClick={() => camaraRef.current?.click()}
          disabled={deshabilitado}
        />
        <BotonSubida
          emoji="📎"
          titulo="Subir archivo"
          descripcion="Foto o PDF guardado"
          onClick={() => archivoRef.current?.click()}
          disabled={deshabilitado}
        />
      </div>

      {/* Archivo elegido */}
      {archivo && (
        <div className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 text-base">
          <span aria-hidden>✅</span>
          <span className="min-w-0 flex-1 truncate font-medium">{archivo.name}</span>
          <button
            type="button"
            onClick={() => setArchivo(null)}
            disabled={deshabilitado}
            className="shrink-0 text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
          >
            Quitar
          </button>
        </div>
      )}

      <Button
        type="button"
        className="h-14 w-full text-lg"
        onClick={enviar}
        disabled={!archivo || deshabilitado || planillaIds.length === 0}
      >
        {estado === "subiendo"
          ? "Subiendo…"
          : planillaIds.length === 0
            ? "Seleccione un mes arriba"
            : planillaIds.length === 1
              ? "Enviar comprobante"
              : `Enviar comprobante (${planillaIds.length} meses)`}
      </Button>
      {estado === "error" && (
        <p className="text-center text-base text-red-700">
          {mensajeError ?? "No se pudo enviar el comprobante. Intente de nuevo."}
        </p>
      )}
    </div>
  );
}

/** Botón grande de subida con emoji, título y realce al pasar el mouse. */
function BotonSubida({
  emoji,
  titulo,
  descripcion,
  onClick,
  disabled,
}: {
  emoji: string;
  titulo: string;
  descripcion: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex flex-col items-center justify-center gap-1 rounded-xl border-2 border-input bg-card p-5 text-center transition-all hover:-translate-y-0.5 hover:border-primary hover:bg-primary/5 hover:shadow-md focus-visible:border-primary focus-visible:outline-none active:translate-y-0 disabled:pointer-events-none disabled:opacity-50"
    >
      <span className="text-3xl" aria-hidden>
        {emoji}
      </span>
      <span className="text-lg font-semibold">{titulo}</span>
      <span className="text-sm text-muted-foreground">{descripcion}</span>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Historial de pagos agrupado por año.
// ---------------------------------------------------------------------------

function HistorialAnios({
  socio,
  planillas,
  tarifa,
  config,
}: {
  socio: Socio;
  planillas: Planilla[];
  tarifa: Tarifa | undefined;
  config: Config;
}) {
  // El historial muestra solo los meses pagados; los pendientes (por pagar y en
  // revisión) ya salen arriba en la tarjeta de pago.
  const pagadas = planillas.filter((p) => p.estado === "pagado");
  const [abierto, setAbierto] = useState(false);
  if (pagadas.length === 0) return null;

  // Agrupa por año conservando el orden DESC de la lista de entrada.
  const anios: number[] = [];
  const porAnio = new Map<number, Planilla[]>();
  for (const p of pagadas) {
    if (!porAnio.has(p.anio)) {
      porAnio.set(p.anio, []);
      anios.push(p.anio);
    }
    porAnio.get(p.anio)!.push(p);
  }

  return (
    <section className="space-y-3">
      <Button
        type="button"
        variant="outline"
        className="h-14 w-full justify-between text-lg"
        onClick={() => setAbierto((v) => !v)}
      >
        <span>Historial de pagos</span>
        <span className="text-muted-foreground">
          {abierto ? "Ocultar ▲" : "Mostrar ▼"}
        </span>
      </Button>

      {abierto && (
        <>
          <p className="text-base text-muted-foreground">
            Toque un mes para ver el detalle.
          </p>
          {anios.map((anio, i) => (
            <details
              key={anio}
              open={i === 0}
              className="rounded-lg border bg-card"
            >
              <summary className="cursor-pointer list-none px-4 py-4 text-xl font-semibold">
                {anio}
              </summary>
              <div className="border-t">
                {porAnio.get(anio)!.map((p) => (
                  <FilaHistorial
                    key={p._id}
                    socio={socio}
                    planilla={p}
                    tarifa={tarifa}
                    config={config}
                  />
                ))}
              </div>
            </details>
          ))}
        </>
      )}
    </section>
  );
}

/**
 * Fila de un mes en el historial: se muestra compacta y, al tocarla, se
 * despliega hacia abajo el desglose completo (consumo, lecturas, tarifa,
 * excedente, multas, total y fechas) para el socio.
 */
function FilaHistorial({
  socio,
  planilla,
  tarifa,
  config,
}: {
  socio: Socio;
  planilla: Planilla;
  tarifa: Tarifa | undefined;
  config: Config;
}) {
  const consumo = Math.max(0, planilla.consumo);
  const desglose = tarifa ? desgloseConsumo(planilla.consumo, tarifa) : null;

  return (
    <details className="group border-b last:border-b-0">
      <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-4 transition-colors hover:bg-muted/40">
        <div className="flex min-w-0 items-center gap-3">
          <span
            className="text-lg text-muted-foreground transition-transform group-open:rotate-90"
            aria-hidden
          >
            ▸
          </span>
          <div className="min-w-0">
            <div className="text-lg font-medium">{nombreMes(planilla.mes)}</div>
            <div className="text-base text-muted-foreground">{consumo} m³</div>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <div className="text-lg font-semibold">
            {dinero(planilla.montoTotal)}
          </div>
          <EstadoBadge estado={planilla.estado} />
        </div>
      </summary>

      {/* Detalle desplegado, bien estructurado */}
      <div className="border-t bg-muted/20 px-4 py-3">
        <dl className="space-y-2">
          <Fila etiqueta="Consumo del mes" valor={`${consumo} m³`} />
          <Fila
            etiqueta="Lectura anterior → actual"
            valor={`${planilla.lecturaAnterior} → ${planilla.lecturaActual}`}
          />
          {desglose && (
            <Fila etiqueta="Tarifa básica" valor={dinero(desglose.basica)} />
          )}
          {desglose?.excedentes.map((ex, i) => (
            <Fila
              key={`ex${i}`}
              etiqueta={`Excedente ${ex.m3} m³ × ${dinero(ex.precio)}/m³`}
              valor={dinero(ex.monto)}
            />
          ))}
          {planilla.cargos?.map((c, i) => (
            <Fila key={`cg${i}`} etiqueta={c.nombre} valor={dinero(c.monto)} />
          ))}
          {planilla.multas.map((m, i) => (
            <Fila
              key={i}
              etiqueta={`${TIPO_MULTA[m.tipo as TipoMulta] ?? m.tipo}${
                m.descripcion ? ` — ${m.descripcion}` : ""
              }`}
              valor={dinero(m.monto)}
            />
          ))}
          <Fila etiqueta="Total" valor={dinero(planilla.montoTotal)} fuerte />
          <Fila
            etiqueta="Pagar hasta"
            valor={fechaLegible(planilla.fechaLimite)}
          />
          {planilla.estado === "pagado" && planilla.fechaPago && (
            <Fila
              etiqueta="Pagado el"
              valor={fechaLegible(planilla.fechaPago)}
            />
          )}
        </dl>

        {planilla.estado === "pagado" && tarifa && (
          <Button
            type="button"
            variant="outline"
            className="mt-3 h-12 w-full text-base"
            onClick={() =>
              descargarPlanillaPDF({ socio, planilla, tarifa, config })
            }
          >
            Descargar recibo
          </Button>
        )}
      </div>
    </details>
  );
}

// ---------------------------------------------------------------------------
// Piezas reutilizables.
// ---------------------------------------------------------------------------

function EstadoBadge({ estado }: { estado: Estado }) {
  const info = ESTADO_INFO[estado];
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border px-4 py-1 text-base font-medium ${info.clase}`}
    >
      <span>{info.emoji}</span>
      <span>{info.etiqueta}</span>
    </span>
  );
}

function Fila({
  etiqueta,
  valor,
  fuerte,
}: {
  etiqueta: string;
  valor: string;
  fuerte?: boolean;
}) {
  return (
    <div
      className={`flex justify-between gap-4 border-b py-2 last:border-b-0 ${
        fuerte ? "text-xl font-bold" : ""
      }`}
    >
      <dt className={fuerte ? "" : "text-muted-foreground"}>{etiqueta}</dt>
      <dd className="text-right font-medium">{valor}</dd>
    </div>
  );
}

/**
 * Botón para copiar un texto (p. ej. el número de cuenta) al portapapeles.
 * Muestra "Copiado ✓" durante ~2 segundos y luego vuelve a "Copiar".
 */
function BotonCopiar({ texto }: { texto: string }) {
  const [copiado, setCopiado] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  async function copiar() {
    let exito = false;
    try {
      await navigator.clipboard.writeText(texto);
      exito = true;
    } catch {
      // Respaldo para navegadores sin acceso al portapapeles.
      try {
        const area = document.createElement("textarea");
        area.value = texto;
        area.style.position = "fixed";
        area.style.opacity = "0";
        document.body.appendChild(area);
        area.focus();
        area.select();
        exito = document.execCommand("copy");
        document.body.removeChild(area);
      } catch {
        exito = false;
      }
    }

    if (exito) {
      setCopiado(true);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => setCopiado(false), 2000);
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      onClick={copiar}
      aria-live="polite"
      className="h-11 px-4 text-base"
    >
      {copiado ? "Copiado ✓" : "Copiar"}
    </Button>
  );
}
