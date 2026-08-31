"use client";

import { useRef, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  descargarPlantillaPadron,
  leerPadronDeExcel,
  type SocioImportado,
} from "@/lib/excel-padron";
import { AvisoError, mensajeError } from "./comunes";

type Resultado = {
  creados: number;
  errores: { fila: number; cedula: string; mensaje: string }[];
};

/**
 * Importar el padrón de socios desde Excel: descargar plantilla, llenarla y
 * subirla. Muestra una vista previa antes de crear los socios de una vez.
 */
export function ImportarPadron({ token }: { token: string }) {
  const importar = useMutation(api.socios.importar);
  const archivoRef = useRef<HTMLInputElement>(null);

  const [leidos, setLeidos] = useState<SocioImportado[] | null>(null);
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [importando, setImportando] = useState(false);

  async function descargar() {
    setError(null);
    try {
      await descargarPlantillaPadron();
    } catch {
      setError("No se pudo generar la plantilla de Excel.");
    }
  }

  async function alSubir(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError(null);
    setResultado(null);
    try {
      const socios = await leerPadronDeExcel(file);
      if (socios.length === 0) {
        setError("El archivo no tiene filas con datos. Revise la plantilla.");
        return;
      }
      setLeidos(socios);
    } catch (err) {
      setError(
        mensajeError(err, "No se pudo leer el archivo. Verifique que sea un Excel válido."),
      );
    }
  }

  async function confirmar() {
    if (!leidos) return;
    setImportando(true);
    setError(null);
    try {
      const r = await importar({ token, socios: leidos });
      setResultado(r);
      setLeidos(null);
    } catch (err) {
      setError(mensajeError(err, "No se pudo importar el padrón."));
    } finally {
      setImportando(false);
    }
  }

  // Filas sin cédula o sin nombres (se marcarán como error al importar).
  const incompletos = leidos
    ? leidos.filter((s) => !s.cedula || !s.nombres.trim()).length
    : 0;

  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardHeader>
        <CardTitle className="text-lg">Importar padrón desde Excel</CardTitle>
        <CardDescription className="text-base">
          Descargue la plantilla, escriba (o pegue) sus socios y vuelva a
          subirla. Se crean todos de una vez.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={descargar}>
            📄 Descargar plantilla
          </Button>
          <Button variant="outline" onClick={() => archivoRef.current?.click()}>
            📤 Subir padrón lleno
          </Button>
          <input
            ref={archivoRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={alSubir}
          />
        </div>

        {/* Vista previa antes de crear */}
        {leidos && (
          <div className="space-y-3 rounded-md border bg-background p-3">
            <p className="text-base">
              Se leyeron <strong>{leidos.length}</strong>{" "}
              {leidos.length === 1 ? "socio" : "socios"} en el archivo.
              {incompletos > 0 && (
                <span className="text-red-700">
                  {" "}
                  {incompletos} sin cédula o nombre (se omitirán).
                </span>
              )}
            </p>
            <ul className="max-h-40 space-y-1 overflow-y-auto text-sm text-muted-foreground">
              {leidos.slice(0, 8).map((s, i) => (
                <li key={i}>
                  {s.cedula || "—"} · {s.apellidos} {s.nombres}
                </li>
              ))}
              {leidos.length > 8 && <li>… y {leidos.length - 8} más</li>}
            </ul>
            <div className="flex flex-wrap gap-2">
              <Button onClick={confirmar} disabled={importando}>
                {importando ? "Importando…" : `Crear ${leidos.length} socios`}
              </Button>
              <Button
                variant="outline"
                onClick={() => setLeidos(null)}
                disabled={importando}
              >
                Cancelar
              </Button>
            </div>
          </div>
        )}

        {/* Resultado de la importación */}
        {resultado && (
          <div className="rounded-md border border-green-200 bg-green-50 p-3 text-base">
            <p className="font-medium text-green-800">
              Se crearon {resultado.creados}{" "}
              {resultado.creados === 1 ? "socio" : "socios"}.
            </p>
            {resultado.errores.length > 0 && (
              <div className="mt-2 rounded-md bg-red-50 p-2 text-sm text-red-800">
                <p className="font-medium">
                  {resultado.errores.length} fila(s) con problema:
                </p>
                <ul className="mt-1 max-h-40 list-disc space-y-0.5 overflow-y-auto pl-5">
                  {resultado.errores.slice(0, 20).map((e, i) => (
                    <li key={i}>
                      Fila {e.fila} ({e.cedula || "sin cédula"}): {e.mensaje}
                    </li>
                  ))}
                  {resultado.errores.length > 20 && (
                    <li>… y {resultado.errores.length - 20} más</li>
                  )}
                </ul>
              </div>
            )}
          </div>
        )}

        <AvisoError mensaje={error} />
      </CardContent>
    </Card>
  );
}
