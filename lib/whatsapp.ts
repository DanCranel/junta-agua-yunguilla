// Ayudas para armar enlaces de WhatsApp (recordatorios de pago del tesorero).

/**
 * Normaliza un teléfono ecuatoriano al formato internacional que espera wa.me
 * (solo dígitos, con código de país, sin el "+" ni el "0" inicial).
 *   0991234567   -> 593991234567
 *   0991 234 567 -> 593991234567
 *   593991234567 -> 593991234567 (se respeta)
 *   991234567    -> 593991234567 (celular sin el 0)
 * Devuelve null si no hay dígitos suficientes para un número válido.
 */
export function normalizarTelefonoEc(telefono?: string | null): string | null {
  if (!telefono) return null;
  let d = telefono.replace(/\D/g, "");
  if (!d) return null;

  if (d.startsWith("593")) {
    // Ya viene con código de país.
  } else if (d.startsWith("0")) {
    d = "593" + d.slice(1);
  } else if (d.length === 9 && d.startsWith("9")) {
    d = "593" + d;
  }

  return d.length >= 10 ? d : null;
}

/**
 * Construye el enlace de WhatsApp con el mensaje ya escrito. Si el número no es
 * válido, devuelve el enlace sin destinatario para que el tesorero elija el
 * contacto a mano (así el botón siempre sirve).
 */
export function enlaceWhatsApp(
  telefono: string | null | undefined,
  mensaje: string,
): string {
  const num = normalizarTelefonoEc(telefono);
  const texto = encodeURIComponent(mensaje);
  return num ? `https://wa.me/${num}?text=${texto}` : `https://wa.me/?text=${texto}`;
}

/** Mensaje de recordatorio para una planilla puntual (mes + monto). */
export function mensajeRecordatorioPlanilla(opts: {
  nombre: string;
  nombreJunta: string;
  periodo: string;
  monto: string;
  enlaceConsulta: string;
}): string {
  return (
    `Hola ${opts.nombre}, le saluda ${opts.nombreJunta}. ` +
    `Su planilla de agua de ${opts.periodo} es de ${opts.monto}. ` +
    `Puede consultarla y ver cómo pagar aquí: ${opts.enlaceConsulta}\n\nGracias.`
  );
}

/** Mensaje de recordatorio por deuda acumulada (varios meses). */
export function mensajeRecordatorioDeuda(opts: {
  nombre: string;
  nombreJunta: string;
  meses: number;
  monto: string;
  enlaceConsulta: string;
}): string {
  const detalle =
    opts.meses === 1
      ? "tiene 1 planilla pendiente"
      : `tiene ${opts.meses} planillas pendientes`;
  return (
    `Hola ${opts.nombre}, le saluda ${opts.nombreJunta}. ` +
    `Según nuestros registros ${detalle} por un total de ${opts.monto}. ` +
    `Puede consultarlas y ver cómo pagar aquí: ${opts.enlaceConsulta}\n\nGracias.`
  );
}
