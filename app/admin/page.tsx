"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useQuery, useMutation } from "convex/react";
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
import { ESTADO_INFO, dinero, type Estado } from "@/lib/formato";

// Clave donde guardamos el token de sesión en el navegador.
const TOKEN_KEY = "juntaAdminToken";

export default function AdminPage() {
  const [token, setToken] = useState<string | null>(null);
  const [listo, setListo] = useState(false); // ¿ya leímos localStorage?

  // Leemos el token guardado solo en el cliente (evita desajustes de hidratación).
  useEffect(() => {
    setToken(localStorage.getItem(TOKEN_KEY));
    setListo(true);
  }, []);

  // Validamos el token contra el backend.
  const sesionValida = useQuery(
    api.auth.validarSesion,
    listo ? { token } : "skip",
  );

  const cerrarSesion = useMutation(api.auth.cerrarSesion);

  function guardarToken(nuevo: string) {
    localStorage.setItem(TOKEN_KEY, nuevo);
    setToken(nuevo);
  }

  async function salir() {
    if (token) await cerrarSesion({ token }).catch(() => {});
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
  }

  // Mientras no sepamos el estado, no mostramos nada (evita parpadeo).
  if (!listo || (token && sesionValida === undefined)) {
    return (
      <main className="mx-auto w-full max-w-md px-4 py-16 text-center text-muted-foreground">
        Cargando…
      </main>
    );
  }

  const autenticado = !!token && sesionValida === true;

  if (!autenticado) {
    return <PantallaIngreso onIngreso={guardarToken} />;
  }

  return <PanelTesorero onSalir={salir} />;
}

/** Pantalla de ingreso: pide la clave del administrador. */
function PantallaIngreso({ onIngreso }: { onIngreso: (token: string) => void }) {
  const iniciarSesion = useMutation(api.auth.iniciarSesion);
  const [clave, setClave] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function ingresar(e: React.FormEvent) {
    e.preventDefault();
    if (!clave.trim()) return;
    setEnviando(true);
    setError(null);
    try {
      const r = await iniciarSesion({ clave });
      if (r.ok) {
        onIngreso(r.token);
      } else if (r.motivo === "no_configurada") {
        setError(
          "La clave aún no está configurada en el servidor. Contacte al administrador del sistema.",
        );
      } else {
        setError("Clave incorrecta. Intente de nuevo.");
      }
    } catch {
      setError("Ocurrió un error. Intente de nuevo.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-md px-4 py-12">
      <header className="mb-6 text-center">
        <h1 className="text-2xl font-bold">Panel del tesorero</h1>
        <p className="text-muted-foreground">Acceso restringido</p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Ingresar</CardTitle>
          <CardDescription className="text-base">
            Escriba la clave de acceso.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={ingresar} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="clave" className="text-lg">
                Clave
              </Label>
              <Input
                id="clave"
                type="password"
                value={clave}
                onChange={(e) => setClave(e.target.value)}
                className="h-14 text-lg"
                autoFocus
              />
            </div>

            {error && (
              <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </p>
            )}

            <Button
              type="submit"
              className="h-14 w-full text-lg"
              disabled={enviando}
            >
              {enviando ? "Verificando…" : "Ingresar"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="mt-8 text-center">
        <Link
          href="/"
          className="text-sm text-muted-foreground underline underline-offset-4"
        >
          ← Volver a la consulta
        </Link>
      </div>
    </main>
  );
}

/** Panel con la lista de socios (visible solo tras autenticarse). */
function PanelTesorero({ onSalir }: { onSalir: () => void }) {
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
        <div className="flex items-center gap-4">
          <Link
            href="/"
            className="text-sm text-muted-foreground underline underline-offset-4"
          >
            ← Volver
          </Link>
          <Button variant="outline" onClick={onSalir} className="h-9">
            Cerrar sesión
          </Button>
        </div>
      </header>

      {socios === undefined && (
        <p className="text-muted-foreground">Cargando…</p>
      )}

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
