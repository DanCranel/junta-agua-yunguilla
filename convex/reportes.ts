import { query } from "./_generated/server";
import { v } from "convex/values";
import { sesionActiva } from "./auth";
import type { Id } from "./_generated/dataModel";

/**
 * Resumen para la directiva (RF futuro §15). Recorre todas las planillas —el
 * volumen de una junta rural es pequeño— y agrega:
 *  - totales del período seleccionado (emitido, recaudado por fecha de pago,
 *    pendiente y consumo en m³),
 *  - el total general pendiente de cobro de toda la junta,
 *  - la lista de morosos (socios con planillas sin pagar), con el total
 *    adeudado y cuántos meses debe, ordenada de mayor a menor deuda.
 * Requiere sesión del tesorero; token inválido -> null.
 */
export const resumen = query({
  args: {
    token: v.union(v.string(), v.null()),
    anio: v.number(),
    mes: v.number(),
  },
  handler: async (ctx, { token, anio, mes }) => {
    if (!(await sesionActiva(ctx, token))) return null;

    const socios = await ctx.db.query("socios").collect();
    const nombrePorId = new Map(
      socios.map((s) => [s._id, s]),
    );

    const planillas = await ctx.db.query("planillas").collect();

    // Prefijo ISO del período (ej. "2026-07") para comparar por fecha de pago.
    const prefijoMes = `${anio}-${String(mes).padStart(2, "0")}`;

    let emitidoMonto = 0;
    let emitidoCount = 0;
    let recaudadoMonto = 0;
    let recaudadoCount = 0;
    let pendienteMesMonto = 0;
    let pendienteMesCount = 0;
    let consumoMes = 0;
    let totalPendiente = 0;

    // Acumulador de deuda por socio (para la lista de morosos).
    const deuda = new Map<
      Id<"socios">,
      { monto: number; meses: number }
    >();

    for (const p of planillas) {
      const esDelPeriodo = p.anio === anio && p.mes === mes;
      const pagada = p.estado === "pagado";

      if (esDelPeriodo) {
        emitidoMonto += p.montoTotal;
        emitidoCount += 1;
        consumoMes += Math.max(0, p.consumo);
        if (!pagada) {
          pendienteMesMonto += p.montoTotal;
          pendienteMesCount += 1;
        }
      }

      // Recaudado en el mes: planillas pagadas cuya fecha de pago cae en el período.
      if (pagada && p.fechaPago && p.fechaPago.startsWith(prefijoMes)) {
        recaudadoMonto += p.montoTotal;
        recaudadoCount += 1;
      }

      // Deuda global (cualquier planilla sin pagar, de cualquier mes).
      if (!pagada) {
        totalPendiente += p.montoTotal;
        const actual = deuda.get(p.socioId) ?? { monto: 0, meses: 0 };
        actual.monto += p.montoTotal;
        actual.meses += 1;
        deuda.set(p.socioId, actual);
      }
    }

    const centavos = (n: number) => Math.round(n * 100) / 100;

    const morosos = [...deuda.entries()]
      .map(([socioId, d]) => {
        const s = nombrePorId.get(socioId);
        return {
          socioId,
          nombre: s ? `${s.apellidos} ${s.nombres}` : "Socio",
          nombres: s?.nombres ?? "",
          telefono: s?.telefono,
          activo: s?.activo ?? true,
          meses: d.meses,
          monto: centavos(d.monto),
        };
      })
      .sort((a, b) => b.monto - a.monto);

    return {
      periodo: { anio, mes },
      emitido: { monto: centavos(emitidoMonto), count: emitidoCount },
      recaudado: { monto: centavos(recaudadoMonto), count: recaudadoCount },
      pendienteMes: { monto: centavos(pendienteMesMonto), count: pendienteMesCount },
      consumoMes,
      totalPendiente: centavos(totalPendiente),
      totalSocios: socios.length,
      morosos,
    };
  },
});
