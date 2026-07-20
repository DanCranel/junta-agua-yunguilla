"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useQuery, useMutation } from "convex/react";
import { ConvexError } from "convex/values";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ESTADO_INFO, dinero, type Estado } from "@/lib/formato";

const TOKEN_KEY = "juntaAdminToken";

export default function AdminPage() {
  const [token, setToken] = useState<string | null>(null);
  const [listo, setListo] = useState(false);

  useEffect(() => {
    setToken(localStorage.getItem(TOKEN_KEY));
    setListo(true);
  }, []);

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

  if (!listo || (token && sesionValida === undefined)) {
    return (
      <main className="mx-auto w-full max-w-md px-4 py-16 text-center text-muted-foreground">
        Cargando…
      </main>
    );
  }

  const autenticado = !!token && sesionValida === true;

  if (!autenticado || !token) {
    return <PantallaIngreso onIngreso={guardarToken} />;
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

            <Button type="submit" className="h-14 w-full text-lg" disabled={enviando}>
              {enviando ? "Verificando…" : "Ingresar"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="mt-8 text-center">
        <Link href="/" className="text-sm text-muted-foreground underline underline-offset-4">
          ← Volver a la consulta
        </Link>
      </div>
    </main>
  );
}

/** Panel con la gestión de socios (visible solo tras autenticarse). */
function PanelTesorero({ token, onSalir }: { token: string; onSalir: () => void }) {
  const socios = useQuery(api.socios.listar, { token });
  const sembrar = useMutation(api.socios.sembrarEjemplo);
  const eliminar = useMutation(api.socios.eliminar);
  const confirmarPago = useMutation(api.socios.confirmarPago);
  const rechazarPago = useMutation(api.socios.rechazarPago);
  const [sembrando, setSembrando] = useState(false);

  async function cargarEjemplos() {
    setSembrando(true);
    try {
      await sembrar({ token });
    } finally {
      setSembrando(false);
    }
  }

  async function eliminarSocio(id: Id<"socios">, nombre: string) {
    if (!confirm(`¿Eliminar a ${nombre}? Esta acción no se puede deshacer.`)) return;
    await eliminar({ token, id });
  }

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8">
      <header className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Panel del tesorero</h1>
          <p className="text-muted-foreground">Socios y cobros del mes</p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/" className="text-sm text-muted-foreground underline underline-offset-4">
            ← Volver
          </Link>
          <Button variant="outline" onClick={onSalir} className="h-9">
            Cerrar sesión
          </Button>
        </div>
      </header>

      <div className="mb-4 flex justify-end">
        <FormSocio token={token} triggerLabel="+ Nuevo socio" />
      </div>

      {socios === undefined && <p className="text-muted-foreground">Cargando…</p>}

      {socios && socios.length === 0 && (
        <Card>
          <CardContent className="space-y-4 py-8 text-center">
            <p className="text-lg">Todavía no hay socios registrados.</p>
            <Button onClick={cargarEjemplos} disabled={sembrando} className="h-12 text-base">
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
                  <CardTitle className="flex items-center justify-between gap-2 text-lg">
                    <span>
                      {s.apellidos} {s.nombres}
                    </span>
                    <span
                      className={`shrink-0 rounded-full border px-3 py-0.5 text-sm font-medium ${info.clase}`}
                    >
                      {info.emoji} {info.etiqueta}
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted-foreground">
                    <span>Cédula: {s.cedula}</span>
                    <span>Mes: {s.mes}</span>
                    <span className="font-semibold text-foreground">
                      Debe: {dinero(s.montoDeuda)}
                    </span>
                  </div>

                  {/* Comprobante en revisión: confirmar o rechazar */}
                  {s.estado === "en_revision" && (
                    <div className="flex flex-wrap items-center gap-2 rounded-md bg-yellow-50 p-3">
                      <span className="text-sm text-yellow-800">
                        Comprobante enviado, pendiente de revisión.
                      </span>
                      {s.comprobanteUrl && (
                        <a
                          href={s.comprobanteUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm font-medium underline underline-offset-4"
                        >
                          Ver comprobante
                        </a>
                      )}
                      <div className="ml-auto flex gap-2">
                        <Button
                          size="sm"
                          className="bg-green-600 hover:bg-green-700"
                          onClick={() => confirmarPago({ token, id: s._id })}
                        >
                          Confirmar pago
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => rechazarPago({ token, id: s._id })}
                        >
                          Rechazar
                        </Button>
                      </div>
                    </div>
                  )}

                  <div className="flex gap-2">
                    <FormSocio token={token} socio={s} triggerLabel="Editar" variant="outline" />
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-red-700 hover:text-red-800"
                      onClick={() => eliminarSocio(s._id, `${s.nombres} ${s.apellidos}`)}
                    >
                      Eliminar
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </main>
  );
}

// --- Formulario de crear / editar socio (dentro de un diálogo) ---

type SocioParaEditar = {
  _id: Id<"socios">;
  cedula: string;
  nombres: string;
  apellidos: string;
  direccion?: string;
  lecturaAnterior: number;
  lecturaActual: number;
  montoDeuda: number;
  mes: string;
  fechaLimite: string;
  estado: Estado;
};

function FormSocio({
  token,
  socio,
  triggerLabel,
  variant,
}: {
  token: string;
  socio?: SocioParaEditar;
  triggerLabel: string;
  variant?: "outline";
}) {
  const crear = useMutation(api.socios.crear);
  const actualizar = useMutation(api.socios.actualizar);
  const [abierto, setAbierto] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  // Estado del formulario (los números se manejan como texto y se convierten al guardar).
  const [f, setF] = useState({
    cedula: socio?.cedula ?? "",
    nombres: socio?.nombres ?? "",
    apellidos: socio?.apellidos ?? "",
    direccion: socio?.direccion ?? "",
    lecturaAnterior: String(socio?.lecturaAnterior ?? ""),
    lecturaActual: String(socio?.lecturaActual ?? ""),
    montoDeuda: String(socio?.montoDeuda ?? ""),
    mes: socio?.mes ?? "",
    fechaLimite: socio?.fechaLimite ?? "",
    estado: (socio?.estado ?? "por_pagar") as Estado,
  });

  function set<K extends keyof typeof f>(campo: K, valor: (typeof f)[K]) {
    setF((prev) => ({ ...prev, [campo]: valor }));
  }

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setGuardando(true);
    try {
      const datos = {
        cedula: f.cedula.trim(),
        nombres: f.nombres.trim(),
        apellidos: f.apellidos.trim(),
        direccion: f.direccion.trim() || undefined,
        lecturaAnterior: Number(f.lecturaAnterior) || 0,
        lecturaActual: Number(f.lecturaActual) || 0,
        montoDeuda: Number(f.montoDeuda) || 0,
        mes: f.mes.trim(),
        fechaLimite: f.fechaLimite.trim(),
        estado: f.estado,
      };
      if (socio) {
        await actualizar({ token, id: socio._id, ...datos });
      } else {
        await crear({ token, ...datos });
      }
      setAbierto(false);
    } catch (err) {
      const msg =
        err instanceof ConvexError
          ? (err.data as { mensaje?: string })?.mensaje ?? "Error al guardar."
          : "Error al guardar. Revise los datos.";
      setError(msg);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Dialog open={abierto} onOpenChange={setAbierto}>
      <DialogTrigger
        render={
          <Button variant={variant} size={variant ? "sm" : "default"}>
            {triggerLabel}
          </Button>
        }
      />
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{socio ? "Editar socio" : "Nuevo socio"}</DialogTitle>
          <DialogDescription>
            Complete los datos del socio y su cobro del mes.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={guardar} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Campo label="Cédula" value={f.cedula} onChange={(v) => set("cedula", v)} />
            <div className="space-y-1.5">
              <Label>Estado</Label>
              <select
                value={f.estado}
                onChange={(e) => set("estado", e.target.value as Estado)}
                className="h-10 w-full rounded-md border border-input bg-transparent px-3 text-sm"
              >
                <option value="por_pagar">Por pagar</option>
                <option value="en_revision">En revisión</option>
                <option value="pagado">Pagado</option>
              </select>
            </div>
            <Campo label="Nombres" value={f.nombres} onChange={(v) => set("nombres", v)} />
            <Campo label="Apellidos" value={f.apellidos} onChange={(v) => set("apellidos", v)} />
          </div>

          <Campo label="Dirección (opcional)" value={f.direccion} onChange={(v) => set("direccion", v)} />

          <div className="grid grid-cols-3 gap-3">
            <Campo label="Lectura anterior" type="number" value={f.lecturaAnterior} onChange={(v) => set("lecturaAnterior", v)} />
            <Campo label="Lectura actual" type="number" value={f.lecturaActual} onChange={(v) => set("lecturaActual", v)} />
            <Campo label="Monto ($)" type="number" value={f.montoDeuda} onChange={(v) => set("montoDeuda", v)} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Campo label="Mes (ej. Julio 2026)" value={f.mes} onChange={(v) => set("mes", v)} />
            <Campo label="Fecha límite" type="date" value={f.fechaLimite} onChange={(v) => set("fechaLimite", v)} />
          </div>

          {error && (
            <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
          )}

          <DialogFooter>
            <Button type="submit" disabled={guardando}>
              {guardando ? "Guardando…" : "Guardar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Campo({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input type={type} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
