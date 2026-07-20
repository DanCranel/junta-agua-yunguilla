"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ESTADO_INFO, dinero, type Estado } from "@/lib/formato";

export default function AdminPage() {
  const socios = useQuery(api.socios.listar);
  const sembrar = useMutation(api.socios.sembrarEjemplo);
  const [sembrando, setSembrando] = useState(false);

  async function cargarEjemplos() {
    setSembrando(true);
    try {
      await sembrar({});
    } finally {
      setSembrando(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Panel del tesorero</h1>
          <p className="text-muted-foreground">Socios y cobros del mes</p>
        </div>
        <Link
          href="/"
          className="text-sm text-muted-foreground underline underline-offset-4"
        >
          ← Volver
        </Link>
      </header>

      {/* Estado de carga */}
      {socios === undefined && (
        <p className="text-muted-foreground">Cargando…</p>
      )}

      {/* Sin datos todavía: ofrecer cargar ejemplos */}
      {socios && socios.length === 0 && (
        <Card>
          <CardContent className="space-y-4 py-8 text-center">
            <p className="text-lg">Todavía no hay socios registrados.</p>
            <Button
              onClick={cargarEjemplos}
              disabled={sembrando}
              className="h-12 text-base"
            >
              {sembrando ? "Cargando…" : "Cargar datos de ejemplo"}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Lista de socios */}
      {socios && socios.length > 0 && (
        <div className="space-y-3">
          {socios.map((s) => {
            const info = ESTADO_INFO[s.estado as Estado];
            return (
              <Card key={s._id}>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center justify-between text-lg">
                    <span>
                      {s.apellidos} {s.nombres}
                    </span>
                    <span
                      className={`rounded-full border px-3 py-0.5 text-sm font-medium ${info.clase}`}
                    >
                      {info.emoji} {info.etiqueta}
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted-foreground">
                  <span>Cédula: {s.cedula}</span>
                  <span>Mes: {s.mes}</span>
                  <span className="font-semibold text-foreground">
                    Debe: {dinero(s.montoDeuda)}
                  </span>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </main>
  );
}
