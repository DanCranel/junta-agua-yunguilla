"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { NOMBRE_JUNTA_POR_DEFECTO } from "@/lib/formato";
import { AvisoError, Campo, mensajeError } from "./comunes";

/** Sección de configuración: tarifa del agua y cuenta bancaria de la junta. */
export function Configuracion({ token }: { token: string }) {
  const tarifa = useQuery(api.tarifas.obtener, {});
  const config = useQuery(api.config.obtener, {});

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Nombre de la junta</CardTitle>
          <CardDescription className="text-base">
            Este nombre aparece en la página, el título y el PDF. Cámbielo por el
            de su junta de agua.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {config === undefined ? (
            <p className="text-muted-foreground">Cargando…</p>
          ) : (
            <FormNombre token={token} inicial={config?.nombreJunta ?? ""} />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Tarifa del agua</CardTitle>
          <CardDescription className="text-base">
            Con estos valores se calculan todas las planillas nuevas.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {tarifa === undefined ? (
            <p className="text-muted-foreground">Cargando…</p>
          ) : (
            <FormTarifa token={token} inicial={tarifa} />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Cuenta bancaria</CardTitle>
          <CardDescription className="text-base">
            Es la cuenta a la que los socios transfieren sus pagos.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {config === undefined ? (
            <p className="text-muted-foreground">Cargando…</p>
          ) : (
            <FormBanco token={token} inicial={config} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function FormNombre({ token, inicial }: { token: string; inicial: string }) {
  const actualizar = useMutation(api.config.actualizarNombre);
  const [nombreJunta, setNombreJunta] = useState(inicial);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [guardando, setGuardando] = useState(false);

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setOk(false);
    setGuardando(true);
    try {
      await actualizar({ token, nombreJunta: nombreJunta.trim() });
      setOk(true);
    } catch (err) {
      setError(mensajeError(err, "No se pudo guardar el nombre."));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <form onSubmit={guardar} className="space-y-4">
      <Campo
        label="Nombre de la junta"
        value={nombreJunta}
        onChange={setNombreJunta}
        placeholder={NOMBRE_JUNTA_POR_DEFECTO}
      />
      <AvisoError mensaje={error} />
      {ok && <p className="text-base font-medium text-green-700">Nombre guardado.</p>}
      <Button type="submit" size="lg" disabled={guardando}>
        {guardando ? "Guardando…" : "Guardar nombre"}
      </Button>
    </form>
  );
}

function FormTarifa({
  token,
  inicial,
}: {
  token: string;
  inicial: { tarifaBasica: number; consumoIncluido: number; precioExcedente: number };
}) {
  const actualizar = useMutation(api.tarifas.actualizar);
  const [tarifaBasica, setTarifaBasica] = useState(String(inicial.tarifaBasica));
  const [consumoIncluido, setConsumoIncluido] = useState(String(inicial.consumoIncluido));
  const [precioExcedente, setPrecioExcedente] = useState(String(inicial.precioExcedente));
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [guardando, setGuardando] = useState(false);

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setOk(false);
    setGuardando(true);
    try {
      await actualizar({
        token,
        tarifaBasica: Number(tarifaBasica) || 0,
        consumoIncluido: Number(consumoIncluido) || 0,
        precioExcedente: Number(precioExcedente) || 0,
      });
      setOk(true);
    } catch (err) {
      setError(mensajeError(err, "No se pudo guardar la tarifa."));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <form onSubmit={guardar} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Campo
          label="Tarifa básica ($)"
          type="number"
          value={tarifaBasica}
          onChange={setTarifaBasica}
        />
        <Campo
          label="Consumo incluido (m³)"
          type="number"
          value={consumoIncluido}
          onChange={setConsumoIncluido}
        />
        <Campo
          label="Precio excedente ($/m³)"
          type="number"
          value={precioExcedente}
          onChange={setPrecioExcedente}
        />
      </div>
      <AvisoError mensaje={error} />
      {ok && <p className="text-base font-medium text-green-700">Tarifa guardada.</p>}
      <Button type="submit" size="lg" disabled={guardando}>
        {guardando ? "Guardando…" : "Guardar tarifa"}
      </Button>
    </form>
  );
}

function FormBanco({
  token,
  inicial,
}: {
  token: string;
  inicial: {
    banco: string;
    tipoCuenta: string;
    numeroCuenta: string;
    titular: string;
    identificacionTitular: string;
  } | null;
}) {
  const actualizar = useMutation(api.config.actualizar);
  const [banco, setBanco] = useState(inicial?.banco ?? "");
  const [tipoCuenta, setTipoCuenta] = useState(inicial?.tipoCuenta ?? "");
  const [numeroCuenta, setNumeroCuenta] = useState(inicial?.numeroCuenta ?? "");
  const [titular, setTitular] = useState(inicial?.titular ?? "");
  const [identificacionTitular, setIdentificacionTitular] = useState(
    inicial?.identificacionTitular ?? "",
  );
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [guardando, setGuardando] = useState(false);

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setOk(false);
    setGuardando(true);
    try {
      await actualizar({
        token,
        banco: banco.trim(),
        tipoCuenta: tipoCuenta.trim(),
        numeroCuenta: numeroCuenta.trim(),
        titular: titular.trim(),
        identificacionTitular: identificacionTitular.trim(),
      });
      setOk(true);
    } catch (err) {
      setError(mensajeError(err, "No se pudo guardar la cuenta."));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <form onSubmit={guardar} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Campo label="Banco" value={banco} onChange={setBanco} />
        <Campo
          label="Tipo de cuenta"
          value={tipoCuenta}
          onChange={setTipoCuenta}
          placeholder="Ahorros / Corriente"
        />
        <Campo label="Número de cuenta" value={numeroCuenta} onChange={setNumeroCuenta} />
        <Campo label="Titular" value={titular} onChange={setTitular} />
      </div>
      <Campo
        label="Identificación del titular (cédula/RUC)"
        value={identificacionTitular}
        onChange={setIdentificacionTitular}
      />
      <AvisoError mensaje={error} />
      {ok && <p className="text-base font-medium text-green-700">Cuenta guardada.</p>}
      <Button type="submit" size="lg" disabled={guardando}>
        {guardando ? "Guardando…" : "Guardar cuenta"}
      </Button>
    </form>
  );
}
