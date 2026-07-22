// Generación del PDF de una planilla (comprobante de deuda) con jsPDF.
import { jsPDF } from "jspdf";
import {
  dinero,
  fechaLegible,
  nombreJuntaMostrar,
  periodoLegible,
  ESTADO_INFO,
  TIPO_MULTA,
} from "./formato";
import type { Estado, TipoMulta } from "./formato";

type Multa = { tipo: string; descripcion: string; monto: number };

type Tarifa = {
  tarifaBasica: number;
  consumoIncluido: number;
  precioExcedente: number;
};

type ArgsPDF = {
  socio: {
    nombres: string;
    apellidos: string;
    cedula: string;
    direccion?: string;
    numeroMedidor?: string;
  };
  planilla: {
    anio: number;
    mes: number;
    lecturaAnterior: number;
    lecturaActual: number;
    consumo: number;
    montoConsumo: number;
    multas: Multa[];
    montoTotal: number;
    estado: Estado;
    fechaLimite: string;
  };
  tarifa: Tarifa;
  config: {
    nombreJunta?: string;
    banco: string;
    tipoCuenta: string;
    numeroCuenta: string;
    titular: string;
  } | null;
};

/** Genera y descarga el PDF de una planilla. Se ejecuta en el navegador. */
export function descargarPlanillaPDF({ socio, planilla, tarifa, config }: ArgsPDF): void {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const margen = 20;
  let y = margen;
  const anchoUtil = 210 - margen * 2;

  const salto = (mm: number) => {
    y += mm;
  };

  // Encabezado.
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text(nombreJuntaMostrar(config?.nombreJunta), margen, y);
  salto(8);
  doc.setFontSize(13);
  doc.setFont("helvetica", "normal");
  doc.text(`Planilla de agua — ${periodoLegible(planilla.anio, planilla.mes)}`, margen, y);
  salto(4);
  doc.setDrawColor(200);
  doc.line(margen, y, margen + anchoUtil, y);
  salto(10);

  // Datos del socio.
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Socio", margen, y);
  salto(6);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  const lineasSocio = [
    `Nombre: ${socio.nombres} ${socio.apellidos}`,
    `Cédula: ${socio.cedula}`,
  ];
  if (socio.direccion) lineasSocio.push(`Dirección: ${socio.direccion}`);
  if (socio.numeroMedidor) lineasSocio.push(`Medidor: ${socio.numeroMedidor}`);
  for (const l of lineasSocio) {
    doc.text(l, margen, y);
    salto(6);
  }
  salto(4);

  // Lecturas y consumo.
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Consumo del mes", margen, y);
  salto(6);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  const filas: [string, string][] = [
    ["Lectura anterior", `${planilla.lecturaAnterior} m³`],
    ["Lectura actual", `${planilla.lecturaActual} m³`],
    ["Consumo", `${Math.max(0, planilla.consumo)} m³`],
  ];
  for (const [k, v] of filas) {
    doc.text(k, margen, y);
    doc.text(v, margen + anchoUtil, y, { align: "right" });
    salto(6);
  }
  salto(4);

  // Desglose del monto.
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Desglose", margen, y);
  salto(6);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);

  const consumoReal = Math.max(0, planilla.consumo);
  const m3Excedente = Math.max(0, consumoReal - tarifa.consumoIncluido);
  const montoExcedente = Math.round((planilla.montoConsumo - tarifa.tarifaBasica) * 100) / 100;

  const desglose: [string, string][] = [
    [`Tarifa básica (hasta ${tarifa.consumoIncluido} m³)`, dinero(tarifa.tarifaBasica)],
  ];
  if (m3Excedente > 0) {
    desglose.push([
      `Excedente ${m3Excedente} m³ × ${dinero(tarifa.precioExcedente)}`,
      dinero(montoExcedente),
    ]);
  }
  for (const m of planilla.multas) {
    const etiqueta = TIPO_MULTA[m.tipo as TipoMulta] ?? m.tipo;
    desglose.push([`Multa: ${etiqueta}${m.descripcion ? ` — ${m.descripcion}` : ""}`, dinero(m.monto)]);
  }
  for (const [k, v] of desglose) {
    const lineas = doc.splitTextToSize(k, anchoUtil - 30) as string[];
    doc.text(lineas, margen, y);
    doc.text(v, margen + anchoUtil, y, { align: "right" });
    salto(6 * lineas.length);
  }

  salto(2);
  doc.setDrawColor(200);
  doc.line(margen, y, margen + anchoUtil, y);
  salto(8);

  // Total.
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("TOTAL A PAGAR", margen, y);
  doc.text(dinero(planilla.montoTotal), margen + anchoUtil, y, { align: "right" });
  salto(10);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text(`Estado: ${ESTADO_INFO[planilla.estado].etiqueta}`, margen, y);
  salto(6);
  doc.text(`Pagar hasta: ${fechaLegible(planilla.fechaLimite)}`, margen, y);
  salto(12);

  // Datos de pago.
  if (config) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text("Pago por transferencia", margen, y);
    salto(6);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    const pago = [
      `Banco: ${config.banco}`,
      `Cuenta ${config.tipoCuenta}: ${config.numeroCuenta}`,
      `Titular: ${config.titular}`,
    ];
    for (const l of pago) {
      doc.text(l, margen, y);
      salto(6);
    }
  }

  const nombreArchivo = `planilla-${socio.apellidos.split(/\s+/)[0].toLowerCase()}-${planilla.anio}-${String(planilla.mes).padStart(2, "0")}.pdf`;
  doc.save(nombreArchivo);
}
