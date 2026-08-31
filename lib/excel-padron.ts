// Plantilla e importación del padrón de socios en Excel (.xlsx). La librería
// `xlsx` (SheetJS) se carga bajo demanda para no engordar el bundle.
import { soloDigitos } from "@/convex/lib";

const ENCABEZADOS = [
  "Cédula",
  "Nombres",
  "Apellidos",
  "Dirección",
  "Teléfono",
  "Medidor",
  "Lectura inicial",
] as const;

export type SocioImportado = {
  cedula: string;
  nombres: string;
  apellidos: string;
  direccion?: string;
  telefono?: string;
  numeroMedidor?: string;
  lecturaInicial: number;
};

/**
 * Genera y descarga una plantilla .xlsx vacía (con una fila de ejemplo) para
 * que la junta escriba su padrón y lo vuelva a subir. La cédula va como texto.
 */
export async function descargarPlantillaPadron(): Promise<void> {
  const XLSX = await import("xlsx");
  const ejemplo = {
    "Cédula": "0102030405",
    "Nombres": "María Rosa",
    "Apellidos": "Guamán Pineda",
    "Dirección": "Sector La Loma",
    "Teléfono": "0991234567",
    "Medidor": "MED-001",
    "Lectura inicial": 100,
  };
  const hoja = XLSX.utils.json_to_sheet([ejemplo], {
    header: ENCABEZADOS as unknown as string[],
  });
  hoja["!cols"] = [
    { wch: 14 },
    { wch: 18 },
    { wch: 20 },
    { wch: 22 },
    { wch: 14 },
    { wch: 12 },
    { wch: 14 },
  ];
  const libro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(libro, hoja, "Padrón");
  XLSX.writeFile(libro, "plantilla-padron-socios.xlsx");
}

const sinAcentos = (s: string) =>
  s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();

/**
 * Lee un .xlsx/.xls/.csv del padrón y devuelve los socios. Ubica cada columna
 * por su encabezado (cédula, nombres, apellidos, dirección, teléfono, medidor,
 * lectura). Ignora filas sin cédula ni nombres.
 */
export async function leerPadronDeExcel(file: File): Promise<SocioImportado[]> {
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
  const buscar = (...terminos: string[]) =>
    claves.find((k) => {
      const n = sinAcentos(k);
      return terminos.every((t) => n.includes(t));
    });

  const cCedula = buscar("cedul") ?? claves[0];
  const cNombres = buscar("nombre");
  const cApellidos = buscar("apellido");
  const cDireccion = buscar("direcc");
  const cTelefono = buscar("telef") ?? buscar("whats") ?? buscar("celular");
  const cMedidor = buscar("medidor");
  const cLectura = buscar("lectura");

  const texto = (fila: Record<string, unknown>, clave?: string) =>
    clave ? String(fila[clave] ?? "").trim() : "";

  const out: SocioImportado[] = [];
  for (const fila of filas) {
    const cedula = soloDigitos(texto(fila, cCedula));
    const nombres = texto(fila, cNombres);
    if (!cedula && !nombres) continue; // fila vacía

    const lecturaBruta = texto(fila, cLectura).replace(",", ".");
    const lecturaInicial = Number(lecturaBruta);

    out.push({
      cedula,
      nombres,
      apellidos: texto(fila, cApellidos),
      direccion: texto(fila, cDireccion) || undefined,
      telefono: texto(fila, cTelefono) || undefined,
      numeroMedidor: texto(fila, cMedidor) || undefined,
      lecturaInicial: Number.isFinite(lecturaInicial) ? lecturaInicial : 0,
    });
  }
  return out;
}
