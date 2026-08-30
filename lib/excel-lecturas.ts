// Plantilla e importación de lecturas del mes en Excel (.xlsx) para el cierre.
// La librería `xlsx` (SheetJS) se carga bajo demanda con import() dinámico: solo
// se descarga cuando el tesorero genera la plantilla o sube un archivo, para no
// engordar el bundle principal.
import { soloDigitos } from "@/convex/lib";

const ENCABEZADOS = [
  "Cédula",
  "Nombre",
  "Medidor",
  "Lectura anterior",
  "Lectura actual",
] as const;

export type FilaPlantilla = {
  cedula: string;
  nombre: string;
  numeroMedidor?: string;
  lecturaAnterior: number;
};

/**
 * Genera y descarga la plantilla .xlsx con una fila por socio y la columna
 * "Lectura actual" vacía para que el tesorero (o nosotros) la llene y la vuelva
 * a subir. La cédula va como texto para no perder los ceros a la izquierda.
 */
export async function descargarPlantillaLecturas(
  filas: FilaPlantilla[],
  nombreHoja: string,
  nombreArchivo: string,
): Promise<void> {
  const XLSX = await import("xlsx");
  const datos = filas.map((f) => ({
    "Cédula": f.cedula,
    "Nombre": f.nombre,
    "Medidor": f.numeroMedidor ?? "",
    "Lectura anterior": f.lecturaAnterior,
    "Lectura actual": "",
  }));
  const hoja = XLSX.utils.json_to_sheet(datos, { header: ENCABEZADOS as unknown as string[] });
  hoja["!cols"] = [{ wch: 14 }, { wch: 26 }, { wch: 12 }, { wch: 16 }, { wch: 16 }];
  const libro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(libro, hoja, nombreHoja.slice(0, 31));
  XLSX.writeFile(libro, nombreArchivo);
}

export type LecturaExcel = { cedula: string; lecturaActual: number };

const sinAcentos = (s: string) =>
  s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();

/**
 * Lee un .xlsx/.xls/.csv y devuelve las filas con cédula (solo dígitos) y la
 * lectura actual numérica. Ubica las columnas por su encabezado ("cédula" y
 * "lectura actual"); si no los encuentra, usa la primera columna como cédula y
 * la última como lectura. Ignora filas sin cédula o sin lectura válida.
 */
export async function leerLecturasDeExcel(file: File): Promise<LecturaExcel[]> {
  const XLSX = await import("xlsx");
  const buf = await file.arrayBuffer();
  const libro = XLSX.read(buf, { type: "array" });
  const hoja = libro.Sheets[libro.SheetNames[0]];
  if (!hoja) return [];

  const filas = XLSX.utils.sheet_to_json<Record<string, unknown>>(hoja, {
    defval: "",
  });
  if (filas.length === 0) return [];

  const claves = Object.keys(filas[0]);
  const claveCedula =
    claves.find((k) => sinAcentos(k).includes("cedul")) ?? claves[0];
  const claveLectura =
    claves.find((k) => {
      const n = sinAcentos(k);
      return n.includes("lectura") && n.includes("actual");
    }) ?? claves[claves.length - 1];

  const out: LecturaExcel[] = [];
  for (const fila of filas) {
    const cedula = soloDigitos(String(fila[claveCedula] ?? ""));
    const bruto = String(fila[claveLectura] ?? "").trim().replace(",", ".");
    const lecturaActual = Number(bruto);
    if (!cedula || bruto === "" || !Number.isFinite(lecturaActual)) continue;
    out.push({ cedula, lecturaActual });
  }
  return out;
}
