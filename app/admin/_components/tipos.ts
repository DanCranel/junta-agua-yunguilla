// Tipos derivados de las funciones de Convex, para mantener el panel en sincronía
// con el backend sin duplicar las formas a mano.
import type { FunctionReturnType } from "convex/server";
import { api } from "@/convex/_generated/api";

/** Un socio tal como lo devuelve `api.socios.listar` (incluye su planilla pendiente). */
export type SocioListado = FunctionReturnType<typeof api.socios.listar>[number];

/** Una planilla tal como la devuelve `api.planillas.listarPorSocio`. */
export type Planilla = FunctionReturnType<typeof api.planillas.listarPorSocio>[number];
