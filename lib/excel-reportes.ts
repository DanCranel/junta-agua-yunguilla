// Exporta el reporte de la directiva a Excel (.xlsx) con tres hojas: Resumen,
// Recaudación del mes y Morosos. La librería xlsx se carga bajo demanda.
import { nombreMes } from "@/lib/formato";

type Reporte = {
  recaudado: { monto: number; count: number };
  emitido: { monto: number; count: number };
  pendienteMes: { monto: number; count: number };
  consumoMes: number;
  totalPendiente: number;
  morosos: {
    nombre: string;
    telefono?: string;
    meses: number;
    monto: number;
    activo: boolean;
  }[];
  recaudadoDetalle: {
    nombre: string;
    anio: number;
    mes: number;
    monto: number;
    fechaPago: string;
  }[];
};

export async function descargarReporteExcel(
  datos: Reporte,
  anio: number,
  mes: number,
): Promise<void> {
  const XLSX = await import("xlsx");
  const libro = XLSX.utils.book_new();
  const etiqueta = `${nombreMes(mes)} ${anio}`;

  // Hoja 1: Resumen (montos como números para poder sumarlos en Excel).
  const resumen = [
    { Concepto: `Recaudado en ${etiqueta}`, Monto: datos.recaudado.monto, Cantidad: datos.recaudado.count },
    { Concepto: `Emitido en ${etiqueta}`, Monto: datos.emitido.monto, Cantidad: datos.emitido.count },
    { Concepto: `Pendiente de ${etiqueta}`, Monto: datos.pendienteMes.monto, Cantidad: datos.pendienteMes.count },
    { Concepto: "Total pendiente (toda la junta)", Monto: datos.totalPendiente, Cantidad: datos.morosos.length },
    { Concepto: `Consumo de ${etiqueta} (m³)`, Monto: datos.consumoMes, Cantidad: "" },
  ];
  const hResumen = XLSX.utils.json_to_sheet(resumen);
  hResumen["!cols"] = [{ wch: 34 }, { wch: 14 }, { wch: 12 }];
  XLSX.utils.book_append_sheet(libro, hResumen, "Resumen");

  // Hoja 2: Recaudación del mes.
  const rec = datos.recaudadoDetalle.map((r) => ({
    Socio: r.nombre,
    "Período": `${nombreMes(r.mes)} ${r.anio}`,
    Monto: r.monto,
    "Fecha de pago": r.fechaPago,
  }));
  const hRec = XLSX.utils.json_to_sheet(
    rec.length ? rec : [{ Socio: "(sin pagos registrados este mes)" }],
  );
  hRec["!cols"] = [{ wch: 28 }, { wch: 16 }, { wch: 12 }, { wch: 14 }];
  XLSX.utils.book_append_sheet(libro, hRec, "Recaudación");

  // Hoja 3: Morosos.
  const mor = datos.morosos.map((m) => ({
    Socio: m.nombre,
    "Teléfono": m.telefono ?? "",
    "Meses adeudados": m.meses,
    "Total adeudado": m.monto,
    Activo: m.activo ? "Sí" : "No",
  }));
  const hMor = XLSX.utils.json_to_sheet(
    mor.length ? mor : [{ Socio: "(ningún socio con deuda)" }],
  );
  hMor["!cols"] = [{ wch: 28 }, { wch: 14 }, { wch: 16 }, { wch: 14 }, { wch: 8 }];
  XLSX.utils.book_append_sheet(libro, hMor, "Morosos");

  XLSX.writeFile(libro, `reporte-${anio}-${String(mes).padStart(2, "0")}.xlsx`);
}
