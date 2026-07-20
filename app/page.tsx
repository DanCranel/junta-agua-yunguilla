"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
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
import { ESTADO_INFO, dinero, fechaLegible, type Estado } from "@/lib/formato";

export default function ConsultaPage() {
  const [cedula, setCedula] = useState("");
  const [apellido, setApellido] = useState("");
  // Valores "confirmados" al presionar Consultar (dispara la búsqueda).
  const [busqueda, setBusqueda] = useState<{ cedula: string; apellido: string } | null>(null);

  // Solo consulta cuando ya se presionó el botón.
  const resultado = useQuery(api.socios.buscar, busqueda ? busqueda : "skip");

  const cargando = busqueda !== null && resultado === undefined;

  function consultar(e: React.FormEvent) {
    e.preventDefault();
    if (!cedula.trim() || !apellido.trim()) return;
    setBusqueda({ cedula: cedula.trim(), apellido: apellido.trim() });
  }

  return (
    <main className="mx-auto w-full max-w-xl px-4 py-8">
      <header className="mb-8 text-center">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          Junta de Agua de Yunguilla
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

      {/* Resultado de la consulta */}
      {resultado && resultado.encontrado === false && (
        <Card className="mt-6 border-red-200">
          <CardContent className="py-6 text-center text-lg">
            No encontramos datos con esa cédula y apellido. Revise que estén
            bien escritos o acérquese a la junta.
          </CardContent>
        </Card>
      )}

      {resultado && resultado.encontrado === true && (
        <TarjetaDeuda socio={resultado.socio} />
      )}

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

type Socio = {
  nombres: string;
  apellidos: string;
  cedula: string;
  lecturaAnterior: number;
  lecturaActual: number;
  montoDeuda: number;
  mes: string;
  fechaLimite: string;
  estado: Estado;
};

function TarjetaDeuda({ socio }: { socio: Socio }) {
  const consumo = Math.max(0, socio.lecturaActual - socio.lecturaAnterior);
  const info = ESTADO_INFO[socio.estado];

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle className="text-2xl">
          {socio.nombres} {socio.apellidos}
        </CardTitle>
        <CardDescription className="text-base">
          Cobro de {socio.mes}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 text-lg">
        <div
          className={`inline-flex items-center gap-2 rounded-full border px-4 py-1 text-base font-medium ${info.clase}`}
        >
          <span>{info.emoji}</span>
          <span>{info.etiqueta}</span>
        </div>

        <div className="rounded-lg bg-muted p-4 text-center">
          <div className="text-base text-muted-foreground">Debe pagar</div>
          <div className="text-4xl font-bold">{dinero(socio.montoDeuda)}</div>
        </div>

        <dl className="space-y-2">
          <Fila etiqueta="Consumo del mes" valor={`${consumo} m³`} />
          <Fila
            etiqueta="Lectura anterior → actual"
            valor={`${socio.lecturaAnterior} → ${socio.lecturaActual}`}
          />
          <Fila etiqueta="Pagar hasta" valor={fechaLegible(socio.fechaLimite)} />
        </dl>
      </CardContent>
    </Card>
  );
}

function Fila({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="flex justify-between border-b py-2 last:border-b-0">
      <dt className="text-muted-foreground">{etiqueta}</dt>
      <dd className="font-medium">{valor}</dd>
    </div>
  );
}
