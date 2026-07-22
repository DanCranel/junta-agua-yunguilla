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
  fechaLegible,
  nombreJuntaMostrar,
  nombreMes,
  periodoLegible,
  type Estado,
  type TipoMulta,
} from "@/lib/formato";
import { descargarPlanillaPDF } from "@/lib/pdf";

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
  montoTotal: number;
  estado: Estado;
  fechaLimite: string;
  fechaPago?: string;
  comprobanteId?: string;
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
  precioExcedente: number;
};

type Config = {
  nombreJunta?: string;
  banco: string;
  tipoCuenta: string;
  numeroCuenta: string;
  titular: string;
  identificacionTitular: string;
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

  // La planilla pendiente es la más reciente que no esté pagada.
  // `planillas` ya viene ordenado DESC por (anio, mes).
  const pendiente = planillas.find((p) => p.estado !== "pagado") ?? null;

  return (
    <div className="mt-6 space-y-8">
      {pendiente ? (
        <PlanillaPendiente
          socio={socio}
          planilla={pendiente}
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

      <HistorialAnios planillas={planillas} tarifa={tarifa} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tarjeta de la planilla pendiente.
// ---------------------------------------------------------------------------

function PlanillaPendiente({
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
  const m3Excedente = tarifa
    ? Math.max(0, planilla.consumo - tarifa.consumoIncluido)
    : 0;
  const montoExcedente = tarifa
    ? Math.round((planilla.montoConsumo - tarifa.tarifaBasica) * 100) / 100
    : 0;

  function descargar() {
    if (!tarifa) return;
    descargarPlanillaPDF({ socio, planilla, tarifa, config });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl">
          {socio.nombres} {socio.apellidos}
        </CardTitle>
        <CardDescription className="text-base">
          Planilla de {periodoLegible(planilla.anio, planilla.mes)}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5 text-lg">
        <EstadoBadge estado={planilla.estado} />

        {/* Monto grande y destacado */}
        <div className="rounded-lg bg-muted p-4 text-center">
          <div className="text-base text-muted-foreground">Debe pagar</div>
          <div className="text-4xl font-bold">{dinero(planilla.montoTotal)}</div>
        </div>

        {/* Desglose */}
        <dl className="space-y-2">
          {tarifa && (
            <Fila
              etiqueta="Tarifa básica"
              valor={dinero(tarifa.tarifaBasica)}
            />
          )}
          {tarifa && m3Excedente > 0 && (
            <Fila
              etiqueta={`Excedente ${m3Excedente} m³ × ${dinero(
                tarifa.precioExcedente
              )}`}
              valor={dinero(montoExcedente)}
            />
          )}
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
        </dl>

        {/* Datos de lectura */}
        <dl className="space-y-2">
          <Fila etiqueta="Consumo del mes" valor={`${consumo} m³`} />
          <Fila
            etiqueta="Lectura anterior → actual"
            valor={`${planilla.lecturaAnterior} → ${planilla.lecturaActual}`}
          />
          <Fila
            etiqueta="Pagar hasta"
            valor={fechaLegible(planilla.fechaLimite)}
          />
        </dl>

        <Button
          type="button"
          variant="outline"
          className="h-14 w-full text-lg"
          onClick={descargar}
          disabled={!tarifa}
        >
          Descargar PDF
        </Button>

        {/* Datos de pago */}
        {config && (
          <div className="rounded-lg border bg-muted/40 p-4">
            <div className="text-base font-semibold">Cómo pagar</div>
            <p className="mt-1 text-base text-muted-foreground">
              Realice la transferencia a esta cuenta y luego suba la foto del
              comprobante.
            </p>
            <dl className="mt-3 space-y-2">
              <Fila etiqueta="Banco" valor={config.banco} />
              <Fila
                etiqueta={`Cuenta ${config.tipoCuenta}`}
                valor={config.numeroCuenta}
              />
              <Fila etiqueta="Titular" valor={config.titular} />
              <Fila
                etiqueta="Identificación"
                valor={config.identificacionTitular}
              />
            </dl>
          </div>
        )}

        {/* Subir comprobante */}
        {planilla.estado === "en_revision" ? (
          <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4 text-center text-base text-yellow-800">
            Su comprobante está en revisión. La tesorería lo confirmará pronto.
          </div>
        ) : (
          <SubirComprobante planillaId={planilla._id} />
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Subida de comprobante de pago.
// ---------------------------------------------------------------------------

type EstadoSubida = "idle" | "subiendo" | "exito" | "error";

function SubirComprobante({ planillaId }: { planillaId: string }) {
  const generarUrlSubida = useMutation(api.planillas.generarUrlSubida);
  const adjuntarComprobante = useMutation(api.planillas.adjuntarComprobante);

  const [archivo, setArchivo] = useState<File | null>(null);
  const [estado, setEstado] = useState<EstadoSubida>("idle");

  // Inputs de archivo ocultos: los disparan los botones grandes de abajo.
  const camaraRef = useRef<HTMLInputElement>(null);
  const archivoRef = useRef<HTMLInputElement>(null);

  function elegir(e: React.ChangeEvent<HTMLInputElement>) {
    setArchivo(e.target.files?.[0] ?? null);
    if (estado === "error") setEstado("idle");
  }

  async function enviar() {
    if (!archivo) return;
    setEstado("subiendo");
    try {
      const url = await generarUrlSubida();
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": archivo.type },
        body: archivo,
      });
      if (!res.ok) throw new Error("Fallo la subida del archivo");
      const { storageId } = await res.json();
      await adjuntarComprobante({
        planillaId: planillaId as Id<"planillas">,
        storageId,
      });
      setEstado("exito");
      setArchivo(null);
    } catch {
      setEstado("error");
    }
  }

  if (estado === "exito") {
    return (
      <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-center text-base text-green-800">
        Comprobante enviado. Queda en revisión. ✅
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
        disabled={!archivo || deshabilitado}
      >
        {estado === "subiendo" ? "Subiendo…" : "Enviar comprobante"}
      </Button>
      {estado === "error" && (
        <p className="text-center text-base text-red-700">
          No se pudo enviar el comprobante. Intente de nuevo.
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
  planillas,
  tarifa,
}: {
  planillas: Planilla[];
  tarifa: Tarifa | undefined;
}) {
  if (planillas.length === 0) return null;

  // Agrupa por año conservando el orden DESC de la lista de entrada.
  const anios: number[] = [];
  const porAnio = new Map<number, Planilla[]>();
  for (const p of planillas) {
    if (!porAnio.has(p.anio)) {
      porAnio.set(p.anio, []);
      anios.push(p.anio);
    }
    porAnio.get(p.anio)!.push(p);
  }

  return (
    <section className="space-y-3">
      <h2 className="text-2xl font-bold">Historial de pagos</h2>
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
              <FilaHistorial key={p._id} planilla={p} tarifa={tarifa} />
            ))}
          </div>
        </details>
      ))}
    </section>
  );
}

/**
 * Fila de un mes en el historial: se muestra compacta y, al tocarla, se
 * despliega hacia abajo el desglose completo (consumo, lecturas, tarifa,
 * excedente, multas, total y fechas) para el socio.
 */
function FilaHistorial({
  planilla,
  tarifa,
}: {
  planilla: Planilla;
  tarifa: Tarifa | undefined;
}) {
  const consumo = Math.max(0, planilla.consumo);
  const m3Excedente = tarifa
    ? Math.max(0, planilla.consumo - tarifa.consumoIncluido)
    : 0;
  const montoExcedente = tarifa
    ? Math.round((planilla.montoConsumo - tarifa.tarifaBasica) * 100) / 100
    : 0;

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
          {tarifa && (
            <Fila etiqueta="Tarifa básica" valor={dinero(tarifa.tarifaBasica)} />
          )}
          {tarifa && m3Excedente > 0 && (
            <Fila
              etiqueta={`Excedente ${m3Excedente} m³ × ${dinero(
                tarifa.precioExcedente,
              )}`}
              valor={dinero(montoExcedente)}
            />
          )}
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
