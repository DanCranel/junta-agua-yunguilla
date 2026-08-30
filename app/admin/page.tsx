"use client";

import { useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
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
import { AvisoError } from "./_components/comunes";
import { CierreMes } from "./_components/cierre-mes";
import { Reportes } from "./_components/reportes";
import { Configuracion } from "./_components/configuracion";
import { FormSocio } from "./_components/form-socio";
import { SocioCard } from "./_components/socio-card";
import { normalizar } from "@/convex/lib";

const TOKEN_KEY = "juntaAdminToken";

// El token del tesorero vive en localStorage (persiste entre recargas y se
// sincroniza entre pestañas). Lo exponemos como "store externo" y lo leemos con
// useSyncExternalStore: así evitamos hidratar estado con setState dentro de un
// efecto (patrón desaconsejado, propenso a parpadeo y a desajustes en SSR).
function suscribirseAlToken(alCambiar: () => void) {
  window.addEventListener("storage", alCambiar);
  window.addEventListener("token-tesorero", alCambiar);
  return () => {
    window.removeEventListener("storage", alCambiar);
    window.removeEventListener("token-tesorero", alCambiar);
  };
}

function leerToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

function escribirToken(token: string | null) {
  if (token === null) localStorage.removeItem(TOKEN_KEY);
  else localStorage.setItem(TOKEN_KEY, token);
  // El evento "storage" solo llega a OTRAS pestañas; avisamos también a esta.
  window.dispatchEvent(new Event("token-tesorero"));
}

/** true una vez que el componente se montó en el cliente (sin setState en efecto). */
function useHidratado(): boolean {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}

export default function AdminPage() {
  const hidratado = useHidratado();
  const token = useSyncExternalStore(suscribirseAlToken, leerToken, () => null);

  const sesionValida = useQuery(
    api.auth.validarSesion,
    hidratado ? { token } : "skip",
  );
  const cerrarSesion = useMutation(api.auth.cerrarSesion);

  async function salir() {
    if (token) await cerrarSesion({ token }).catch(() => {});
    escribirToken(null);
  }

  if (!hidratado || (token && sesionValida === undefined)) {
    return (
      <main className="mx-auto w-full max-w-md px-4 py-16 text-center text-muted-foreground">
        Cargando…
      </main>
    );
  }

  const autenticado = !!token && sesionValida === true;

  if (!autenticado || !token) {
    return <PantallaIngreso onIngreso={(nuevo) => escribirToken(nuevo)} />;
  }

  return <PanelTesorero token={token} onSalir={salir} />;
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
      } else if (r.motivo === "bloqueado") {
        setError(
          `Demasiados intentos fallidos. Espere ${r.segundos} segundos e intente de nuevo.`,
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

            <AvisoError mensaje={error} />

            <Button type="submit" className="h-14 w-full text-lg" disabled={enviando}>
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

type Vista = "socios" | "cierre" | "reportes" | "config";

/** Panel principal del tesorero (visible solo tras autenticarse). */
function PanelTesorero({ token, onSalir }: { token: string; onSalir: () => void }) {
  const [vista, setVista] = useState<Vista>("socios");

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Panel del tesorero</h1>
          <p className="text-muted-foreground">Socios, cobros y configuración</p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="text-sm text-muted-foreground underline underline-offset-4"
          >
            ← Volver
          </Link>
          <Button variant="outline" onClick={onSalir}>
            Cerrar sesión
          </Button>
        </div>
      </header>

      {/* Pestañas simples */}
      <nav className="mb-6 flex flex-wrap gap-2">
        <Button
          size="lg"
          variant={vista === "socios" ? "default" : "outline"}
          onClick={() => setVista("socios")}
        >
          Socios
        </Button>
        <Button
          size="lg"
          variant={vista === "cierre" ? "default" : "outline"}
          onClick={() => setVista("cierre")}
        >
          Cierre de mes
        </Button>
        <Button
          size="lg"
          variant={vista === "reportes" ? "default" : "outline"}
          onClick={() => setVista("reportes")}
        >
          Reportes
        </Button>
        <Button
          size="lg"
          variant={vista === "config" ? "default" : "outline"}
          onClick={() => setVista("config")}
        >
          Configuración
        </Button>
      </nav>

      {vista === "socios" && <SeccionSocios token={token} />}
      {vista === "cierre" && <CierreMes token={token} />}
      {vista === "reportes" && <Reportes token={token} />}
      {vista === "config" && <Configuracion token={token} />}
    </main>
  );
}

/** Listado y gestión de socios. */
function SeccionSocios({ token }: { token: string }) {
  const socios = useQuery(api.socios.listar, { token });
  const sembrar = useMutation(api.seed.sembrarEjemplo);
  const [sembrando, setSembrando] = useState(false);
  const [busqueda, setBusqueda] = useState("");

  async function cargarEjemplos() {
    setSembrando(true);
    try {
      await sembrar({ token });
    } finally {
      setSembrando(false);
    }
  }

  const consulta = normalizar(busqueda);
  const consultaDigitos = busqueda.replace(/\D/g, "");
  const sociosFiltrados =
    socios && consulta
      ? socios.filter((s) => {
          const nombreCompleto = normalizar(`${s.nombres} ${s.apellidos}`);
          const coincideNombre = nombreCompleto.includes(consulta);
          const coincideCedula =
            consultaDigitos.length > 0 && s.cedula.includes(consultaDigitos);
          return coincideNombre || coincideCedula;
        })
      : socios;

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <FormSocio token={token} triggerLabel="+ Nuevo socio" />
      </div>

      {socios === undefined && <p className="text-muted-foreground">Cargando…</p>}

      {socios && socios.length === 0 && (
        <Card>
          <CardContent className="space-y-4 py-8 text-center">
            <p className="text-lg">Todavía no hay socios registrados.</p>
            <Button onClick={cargarEjemplos} disabled={sembrando} size="lg">
              {sembrando ? "Cargando…" : "Cargar datos de ejemplo"}
            </Button>
          </CardContent>
        </Card>
      )}

      {socios && socios.length > 0 && sociosFiltrados && (
        <div className="space-y-3">
          <Input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar socio por nombre o cédula…"
            className="h-14 text-lg"
          />

          <p className="text-muted-foreground">
            {consulta
              ? `${sociosFiltrados.length} de ${socios.length} socios`
              : `${socios.length} socios`}
          </p>

          {sociosFiltrados.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-lg">
                No se encontró ningún socio con ese nombre o cédula.
              </CardContent>
            </Card>
          ) : (
            sociosFiltrados.map((s) => (
              <SocioCard key={s._id} token={token} socio={s} />
            ))
          )}
        </div>
      )}
    </div>
  );
}
