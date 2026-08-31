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
import { desgloseConsumo } from "@/convex/lib";

type Multa = { tipo: string; descripcion: string; monto: number };

type Tarifa = {
  tarifaBasica: number;
  consumoIncluido: number;
  precioExcedente?: number;
  tramos?: { hasta: number | null; precio: number }[];
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
    cargos?: { nombre: string; monto: number }[];
    montoTotal: number;
    estado: Estado;
    fechaLimite: string;
    fechaPago?: string;
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

/**
 * Genera y descarga el PDF de una planilla. Se ejecuta en el navegador.
 * Si la planilla está pagada, el documento es un RECIBO DE PAGO (muestra la
 * fecha de pago y omite los datos de transferencia); si no, es la planilla /
 * comprobante de deuda con las instrucciones de pago.
 */
export function descargarPlanillaPDF({ socio, planilla, tarifa, config }: ArgsPDF): void {
  const esRecibo = planilla.estado === "pagado";
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
  const subtitulo = esRecibo ? "Recibo de pago" : "Planilla de agua";
  doc.text(`${subtitulo} — ${periodoLegible(planilla.anio, planilla.mes)}`, margen, y);
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

  const d = desgloseConsumo(planilla.consumo, tarifa);
  const desglose: [string, string][] = [
    [`Tarifa básica (hasta ${tarifa.consumoIncluido} m³)`, dinero(d.basica)],
  ];
  for (const ex of d.excedentes) {
    desglose.push([
      `Excedente ${ex.m3} m³ × ${dinero(ex.precio)}/m³`,
      dinero(ex.monto),
    ]);
  }
  for (const c of planilla.cargos ?? []) {
    desglose.push([c.nombre, dinero(c.monto)]);
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
  doc.text(esRecibo ? "TOTAL PAGADO" : "TOTAL A PAGAR", margen, y);
  doc.text(dinero(planilla.montoTotal), margen + anchoUtil, y, { align: "right" });
  salto(10);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text(`Estado: ${ESTADO_INFO[planilla.estado].etiqueta}`, margen, y);
  salto(6);
  if (esRecibo) {
    if (planilla.fechaPago) {
      doc.text(`Pagado el: ${fechaLegible(planilla.fechaPago)}`, margen, y);
      salto(6);
    }
  } else {
    doc.text(`Pagar hasta: ${fechaLegible(planilla.fechaLimite)}`, margen, y);
    salto(6);
  }
  salto(6);

  // En el recibo no se muestran los datos de transferencia (ya está pagado):
  // solo un cierre de agradecimiento.
  if (esRecibo) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(11);
    doc.text("Gracias por su pago.", margen, y);
  }

  // Datos de pago (solo cuando aún está pendiente).
  if (!esRecibo && config) {
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

  const prefijo = esRecibo ? "recibo" : "planilla";
  const nombreArchivo = `${prefijo}-${socio.apellidos.split(/\s+/)[0].toLowerCase()}-${planilla.anio}-${String(planilla.mes).padStart(2, "0")}.pdf`;
  doc.save(nombreArchivo);
}
