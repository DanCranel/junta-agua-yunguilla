"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { calcularConsumo, calcularMontoConsumo } from "@/convex/lib";
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
import { dinero, nombreMes, periodoLegible } from "@/lib/formato";
import { AvisoError, mensajeError } from "./comunes";

const ANIO_POR_DEFECTO = 2026;
const MES_POR_DEFECTO = 7;

type Resultado = {
  creadas: number;
  omitidas: number;
  errores: { nombre: string; mensaje: string }[];
};

/**
 * Cierre de mes por lote: el tesorero elige año + mes, ve a todos los socios
 * activos con su lectura anterior heredada, escribe la lectura nueva de cada
 * uno (con el monto calculado en vivo) y guarda todas las planillas de una vez.
 * Solo lectura: las multas se agregan luego por planilla.
 */
export function CierreMes({ token }: { token: string }) {
  const [anio, setAnio] = useState(String(ANIO_POR_DEFECTO));
  const [mes, setMes] = useState(String(MES_POR_DEFECTO));
  const [fechaLimite, setFechaLimite] = useState("");
  // Lecturas tecleadas, por socioId.
  const [lecturas, setLecturas] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [resultado, setResultado] = useState<Resultado | null>(null);

  const anioN = Number(anio);
  const mesN = Number(mes);
  const periodoValido = Number.isFinite(anioN) && Number.isFinite(mesN);

  const resumen = useQuery(
    api.planillas.resumenCierre,
    periodoValido ? { token, anio: anioN, mes: mesN } : "skip",
  );
  const registrarLote = useMutation(api.planillas.registrarLecturasLote);

  // Filas con una lectura válida lista para guardar: número finito y no menor
  // que la lectura anterior (las menores se marcan en rojo y no se envían).
  const pendientes = useMemo(() => {
    if (!resumen) return [];
    return resumen.filas
      .filter((f) => !f.yaRegistrada)
      .map((f) => ({ f, texto: lecturas[f.socioId] ?? "" }))
      .filter(
        ({ f, texto }) =>
          texto.trim() !== "" &&
          Number.isFinite(Number(texto)) &&
          Number(texto) >= f.lecturaAnterior,
      )
      .map(({ f, texto }) => ({
        socioId: f.socioId as Id<"socios">,
        lecturaActual: Number(texto),
      }));
  }, [resumen, lecturas]);

  function cambiarPeriodo(nuevoAnio: string, nuevoMes: string) {
    setAnio(nuevoAnio);
    setMes(nuevoMes);
    // Cambiar de período invalida las lecturas tecleadas y el resultado previo.
    setLecturas({});
    setResultado(null);
    setError(null);
  }

  async function guardar() {
    if (pendientes.length === 0) return;
    setError(null);
    setGuardando(true);
    setResultado(null);
    try {
      const r = await registrarLote({
        token,
        anio: anioN,
        mes: mesN,
        ...(fechaLimite ? { fechaLimite } : {}),
        lecturas: pendientes,
      });
      setResultado(r);
      // Las filas guardadas ya aparecerán como "yaRegistrada" al refrescar la
      // query; limpiamos las lecturas tecleadas para no re-enviarlas.
      setLecturas({});
    } catch (err) {
      setError(mensajeError(err, "No se pudieron guardar las lecturas."));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Cierre de mes</CardTitle>
          <CardDescription className="text-base">
            Registre la lectura de todos los socios de un mes a la vez. El monto
            se calcula solo. Deje vacío a quien no tenga lectura este mes.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-base">Año</Label>
              <Input
                type="number"
                value={anio}
                onChange={(e) => cambiarPeriodo(e.target.value, mes)}
                className="h-12 text-base"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-base">Mes</Label>
              <select
                value={mes}
                onChange={(e) => cambiarPeriodo(anio, e.target.value)}
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
            <Label className="text-base">Fecha límite (opcional)</Label>
            <Input
              type="date"
              value={fechaLimite}
              onChange={(e) => setFechaLimite(e.target.value)}
              className="h-12 text-base"
            />
            <p className="text-sm text-muted-foreground">
              Se aplica a todas. Si la deja vacía, se usa el último día del mes.
            </p>
          </div>
        </CardContent>
      </Card>

      {resultado && (
        <ResumenGuardado resultado={resultado} periodo={periodoLegible(anioN, mesN)} />
      )}

      <AvisoError mensaje={error} />

      {resumen === undefined && (
        <p className="text-muted-foreground">Cargando socios…</p>
      )}

      {resumen && resumen.filas.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center text-lg">
            No hay socios activos para registrar.
          </CardContent>
        </Card>
      )}

      {resumen && resumen.filas.length > 0 && (
        <div className="space-y-3">
          {resumen.filas.map((f) => (
            <FilaSocio
              key={f.socioId}
              nombre={f.nombre}
              numeroMedidor={f.numeroMedidor}
              lecturaAnterior={f.lecturaAnterior}
              yaRegistrada={f.yaRegistrada}
              tarifa={resumen.tarifa}
              valor={lecturas[f.socioId] ?? ""}
              onChange={(v) =>
                setLecturas((prev) => ({ ...prev, [f.socioId]: v }))
              }
            />
          ))}
        </div>
      )}

      {resumen && resumen.filas.length > 0 && (
        <div className="sticky bottom-0 -mx-4 border-t bg-background/95 px-4 py-3 backdrop-blur">
          <Button
            size="lg"
            className="h-14 w-full text-lg"
            onClick={guardar}
            disabled={guardando || pendientes.length === 0}
          >
            {guardando
              ? "Guardando…"
              : pendientes.length === 0
                ? "Escriba al menos una lectura"
                : `Guardar ${pendientes.length} ${
                    pendientes.length === 1 ? "lectura" : "lecturas"
                  }`}
          </Button>
        </div>
      )}
    </div>
  );
}

/** Una fila del cierre: nombre, lectura anterior, campo de lectura y monto vivo. */
function FilaSocio({
  nombre,
  numeroMedidor,
  lecturaAnterior,
  yaRegistrada,
  tarifa,
  valor,
  onChange,
}: {
  nombre: string;
  numeroMedidor?: string;
  lecturaAnterior: number;
  yaRegistrada: boolean;
  tarifa: { tarifaBasica: number; consumoIncluido: number; precioExcedente: number };
  valor: string;
  onChange: (v: string) => void;
}) {
  const lecturaN = Number(valor);
  const lecturaValida = valor.trim() !== "" && Number.isFinite(lecturaN);
  const menor = lecturaValida && lecturaN < lecturaAnterior;

  const consumo = lecturaValida ? calcularConsumo(lecturaAnterior, lecturaN) : 0;
  const monto = lecturaValida ? calcularMontoConsumo(consumo, tarifa) : 0;

  return (
    <Card className={yaRegistrada ? "opacity-60" : undefined}>
      <CardContent className="flex flex-wrap items-center gap-4 py-4">
        <div className="min-w-0 flex-1">
          <div className="text-lg font-medium">{nombre}</div>
          <div className="text-sm text-muted-foreground">
            {numeroMedidor ? `Medidor ${numeroMedidor} · ` : ""}
            Lectura anterior: {lecturaAnterior} m³
          </div>
        </div>

        {yaRegistrada ? (
          <div className="text-base font-medium text-green-700">
            Ya registrado ✓
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <div className="w-28">
              <Input
                type="number"
                inputMode="numeric"
                value={valor}
                onChange={(e) => onChange(e.target.value)}
                placeholder="Lectura"
                className="h-12 text-base"
                aria-invalid={menor}
              />
            </div>
            <div className="w-24 text-right">
              {menor ? (
                <span className="text-sm font-medium text-red-700">
                  &lt; anterior
                </span>
              ) : lecturaValida ? (
                <>
                  <div className="text-lg font-bold">{dinero(monto)}</div>
                  <div className="text-sm text-muted-foreground">
                    {consumo} m³
                  </div>
                </>
              ) : (
                <span className="text-sm text-muted-foreground">—</span>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/** Resumen tras guardar el lote: creadas, omitidas y errores por socio. */
function ResumenGuardado({
  resultado,
  periodo,
}: {
  resultado: Resultado;
  periodo: string;
}) {
  const { creadas, omitidas, errores } = resultado;
  return (
    <Card className="border-green-200 bg-green-50">
      <CardContent className="space-y-2 py-4 text-base">
        <p className="text-lg font-semibold text-green-800">
          Cierre de {periodo}
        </p>
        <p>
          Se crearon <strong>{creadas}</strong>{" "}
          {creadas === 1 ? "planilla" : "planillas"}.
          {omitidas > 0 && ` Se omitieron ${omitidas} (ya registradas).`}
        </p>
        {errores.length > 0 && (
          <div className="rounded-md bg-red-50 p-3 text-red-800">
            <p className="font-medium">No se pudieron guardar:</p>
            <ul className="mt-1 list-disc space-y-0.5 pl-5">
              {errores.map((e, i) => (
                <li key={i}>
                  <strong>{e.nombre}:</strong> {e.mensaje}
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
