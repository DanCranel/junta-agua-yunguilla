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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

type TramoForm = { hasta: string; precio: string };

function FormTarifa({
  token,
  inicial,
}: {
  token: string;
  inicial: {
    tarifaBasica: number;
    consumoIncluido: number;
    precioExcedente?: number;
    tramos?: { hasta: number | null; precio: number }[];
    mora?: {
      activa: boolean;
      tipo: "fijo" | "porcentaje";
      valor: number;
      diasGracia: number;
    };
  };
}) {
  const actualizar = useMutation(api.tarifas.actualizar);
  const [tarifaBasica, setTarifaBasica] = useState(String(inicial.tarifaBasica));
  const [consumoIncluido, setConsumoIncluido] = useState(
    String(inicial.consumoIncluido),
  );
  // Tramos iniciales: los guardados, o uno abierto con el precio único heredado.
  const [tramos, setTramos] = useState<TramoForm[]>(
    inicial.tramos && inicial.tramos.length > 0
      ? inicial.tramos.map((t) => ({
          hasta: t.hasta === null ? "" : String(t.hasta),
          precio: String(t.precio),
        }))
      : [{ hasta: "", precio: String(inicial.precioExcedente ?? 0) }],
  );
  const [moraActiva, setMoraActiva] = useState(inicial.mora?.activa ?? false);
  const [moraTipo, setMoraTipo] = useState<"fijo" | "porcentaje">(
    inicial.mora?.tipo ?? "fijo",
  );
  const [moraValor, setMoraValor] = useState(String(inicial.mora?.valor ?? ""));
  const [moraDiasGracia, setMoraDiasGracia] = useState(
    String(inicial.mora?.diasGracia ?? 0),
  );
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [guardando, setGuardando] = useState(false);

  function setTramo(i: number, campo: keyof TramoForm, valor: string) {
    setTramos((prev) =>
      prev.map((t, j) => (j === i ? { ...t, [campo]: valor } : t)),
    );
    setOk(false);
  }
  function agregarTramo() {
    setTramos((prev) => [...prev, { hasta: "", precio: "" }]);
    setOk(false);
  }
  function quitarTramo(i: number) {
    setTramos((prev) => prev.filter((_, j) => j !== i));
    setOk(false);
  }

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setOk(false);
    setGuardando(true);
    try {
      // "Hasta" vacío = tramo abierto (de ahí en adelante). Se ordena por tope
      // ascendente para que el cálculo escalonado sea correcto.
      const tramosLimpios = tramos
        .map((t) => ({
          hasta: t.hasta.trim() === "" ? null : Number(t.hasta),
          precio: Number(t.precio) || 0,
        }))
        .sort((a, b) => (a.hasta ?? Infinity) - (b.hasta ?? Infinity));
      await actualizar({
        token,
        tarifaBasica: Number(tarifaBasica) || 0,
        consumoIncluido: Number(consumoIncluido) || 0,
        tramos: tramosLimpios,
        mora: {
          activa: moraActiva,
          tipo: moraTipo,
          valor: Number(moraValor) || 0,
          diasGracia: Number(moraDiasGracia) || 0,
        },
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
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Campo
          label="Tarifa básica ($)"
          type="number"
          value={tarifaBasica}
          onChange={(v) => {
            setTarifaBasica(v);
            setOk(false);
          }}
        />
        <Campo
          label="Consumo incluido (m³)"
          type="number"
          value={consumoIncluido}
          onChange={(v) => {
            setConsumoIncluido(v);
            setOk(false);
          }}
        />
      </div>

      <div className="space-y-2">
        <Label className="text-base">Tramos de excedente (por m³ sobre el consumo incluido)</Label>
        <p className="text-sm text-muted-foreground">
          Cada tramo cobra su precio por m³ hasta el tope indicado. Deje “Hasta”
          vacío en el último tramo (cobra de ahí en adelante).
        </p>
        {tramos.map((t, i) => (
          <div key={i} className="flex items-end gap-2">
            <div className="flex-1 space-y-1.5">
              <Label className="text-sm">Hasta (m³)</Label>
              <Input
                type="number"
                value={t.hasta}
                onChange={(e) => setTramo(i, "hasta", e.target.value)}
                placeholder="en adelante"
                className="h-11 text-base"
              />
            </div>
            <div className="flex-1 space-y-1.5">
              <Label className="text-sm">Precio ($/m³)</Label>
              <Input
                type="number"
                value={t.precio}
                onChange={(e) => setTramo(i, "precio", e.target.value)}
                className="h-11 text-base"
              />
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-11 text-red-700 hover:text-red-800"
              onClick={() => quitarTramo(i)}
              disabled={tramos.length === 1}
            >
              Quitar
            </Button>
          </div>
        ))}
        <Button type="button" variant="outline" size="sm" onClick={agregarTramo}>
          + Agregar tramo
        </Button>
      </div>

      <div className="space-y-3 rounded-lg border border-input p-3">
        <label className="flex items-center gap-3">
          <input
            type="checkbox"
            checked={moraActiva}
            onChange={(e) => {
              setMoraActiva(e.target.checked);
              setOk(false);
            }}
            className="size-5"
          />
          <span className="text-base font-medium">
            Cobrar mora por pago atrasado
          </span>
        </label>

        {moraActiva && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label className="text-sm">Tipo</Label>
              <select
                value={moraTipo}
                onChange={(e) => {
                  setMoraTipo(e.target.value as "fijo" | "porcentaje");
                  setOk(false);
                }}
                className="h-11 w-full rounded-lg border border-input bg-transparent px-3 text-base"
              >
                <option value="fijo">Monto fijo ($)</option>
                <option value="porcentaje">Porcentaje (%)</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">
                {moraTipo === "porcentaje" ? "Valor (%)" : "Valor ($)"}
              </Label>
              <Input
                type="number"
                value={moraValor}
                onChange={(e) => {
                  setMoraValor(e.target.value);
                  setOk(false);
                }}
                className="h-11 text-base"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">Días de gracia</Label>
              <Input
                type="number"
                value={moraDiasGracia}
                onChange={(e) => {
                  setMoraDiasGracia(e.target.value);
                  setOk(false);
                }}
                className="h-11 text-base"
              />
            </div>
          </div>
        )}

        <p className="text-sm text-muted-foreground">
          {moraActiva
            ? "La mora se aplica a las planillas vencidas con el botón “Aplicar mora” en Reportes."
            : "Desactivada: no se cobra mora (para juntas que no la usan)."}
        </p>
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
    whatsappTesorero?: string;
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
  const [whatsappTesorero, setWhatsappTesorero] = useState(
    inicial?.whatsappTesorero ?? "",
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
        whatsappTesorero: whatsappTesorero.trim() || undefined,
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
      <Campo
        label="WhatsApp del tesorero (para recibir comprobantes)"
        type="tel"
        value={whatsappTesorero}
        onChange={setWhatsappTesorero}
        placeholder="Ej. 0991234567"
      />
      <AvisoError mensaje={error} />
      {ok && <p className="text-base font-medium text-green-700">Cuenta guardada.</p>}
      <Button type="submit" size="lg" disabled={guardando}>
        {guardando ? "Guardando…" : "Guardar cuenta"}
      </Button>
    </form>
  );
}
