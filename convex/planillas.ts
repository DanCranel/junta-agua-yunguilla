import { query, mutation, QueryCtx } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { Id } from "./_generated/dataModel";
import { requerirSesion, sesionActiva } from "./auth";
import { tipoMultaValidator } from "./schema";
import {
  calcularConsumo,
  calcularMontoConsumo,
  calcularMontoTotal,
  coincideApellido,
  fechaHoyISO,
  normalizar,
  soloDigitos,
  ultimoDiaDelMes,
  COMPROBANTE_TIPOS_OK,
  COMPROBANTE_MAX_BYTES,
  TARIFA_POR_DEFECTO,
  type Tarifa,
} from "./lib";

/**
 * Devuelve la tarifa vigente (doc único). Si aún no se configuró, usa la
 * tarifa por defecto de la muestra. Helper interno de este módulo.
 */
async function obtenerTarifa(ctx: QueryCtx): Promise<Tarifa> {
  const doc = await ctx.db.query("tarifa").first();
  return doc
    ? {
        tarifaBasica: doc.tarifaBasica,
        consumoIncluido: doc.consumoIncluido,
        precioExcedente: doc.precioExcedente,
        tramos: doc.tramos,
      }
    : TARIFA_POR_DEFECTO;
}

/**
 * Lectura anterior de un socio para el período (anio, mes):
 * la lecturaActual de la planilla más reciente ESTRICTAMENTE anterior a ese
 * período; si no existe ninguna, la lecturaInicial del socio.
 */
async function lecturaAnteriorDe(
  ctx: QueryCtx,
  socioId: Id<"socios">,
  anio: number,
  mes: number,
): Promise<number> {
  const planillas = await ctx.db
    .query("planillas")
    .withIndex("by_socio", (q) => q.eq("socioId", socioId))
    .collect();

  // Solo períodos estrictamente anteriores a (anio, mes).
  const anteriores = planillas.filter(
    (p) => p.anio < anio || (p.anio === anio && p.mes < mes),
  );
  anteriores.sort((a, b) => b.anio - a.anio || b.mes - a.mes);

  if (anteriores.length > 0) return anteriores[0].lecturaActual;

  const socio = await ctx.db.get(socioId);
  return socio ? socio.lecturaInicial : 0;
}

/**
 * Lista las planillas de un socio (más reciente primero), con la URL del
 * comprobante resuelta. Requiere sesión del tesorero; token inválido -> [].
 */
export const listarPorSocio = query({
  args: { token: v.union(v.string(), v.null()), socioId: v.id("socios") },
  handler: async (ctx, { token, socioId }) => {
    if (!(await sesionActiva(ctx, token))) return [];

    const planillas = await ctx.db
      .query("planillas")
      .withIndex("by_socio", (q) => q.eq("socioId", socioId))
      .collect();
    planillas.sort((a, b) => b.anio - a.anio || b.mes - a.mes);

    return Promise.all(
      planillas.map(async (p) => ({
        ...p,
        comprobanteUrl: p.comprobanteId
          ? await ctx.storage.getUrl(p.comprobanteId)
          : null,
      })),
    );
  },
});

/**
 * Vista previa del cálculo para el tesorero antes de registrar la lectura.
 * No valida ni guarda nada. Requiere sesión; token inválido -> null.
 */
export const previsualizar = query({
  args: {
    token: v.union(v.string(), v.null()),
    socioId: v.id("socios"),
    anio: v.number(),
    mes: v.number(),
    lecturaActual: v.number(),
  },
  handler: async (ctx, { token, socioId, anio, mes, lecturaActual }) => {
    if (!(await sesionActiva(ctx, token))) return null;

    const tarifa = await obtenerTarifa(ctx);
    const lecturaAnterior = await lecturaAnteriorDe(ctx, socioId, anio, mes);
    const consumo = calcularConsumo(lecturaAnterior, lecturaActual);
    const montoConsumo = calcularMontoConsumo(consumo, tarifa);

    return { lecturaAnterior, consumo, montoConsumo, tarifa };
  },
});

/**
 * Registra la lectura de un mes y crea la planilla (estado por_pagar).
 * Rechaza duplicados por período y lecturas menores a la anterior.
 * Devuelve el id de la planilla creada.
 */
export const registrarLectura = mutation({
  args: {
    token: v.string(),
    socioId: v.id("socios"),
    anio: v.number(),
    mes: v.number(),
    lecturaActual: v.number(),
    fechaLimite: v.optional(v.string()),
  },
  handler: async (ctx, { token, socioId, anio, mes, lecturaActual, fechaLimite }) => {
    await requerirSesion(ctx, token);

    // No debe existir ya una planilla para ese socio y período.
    const existente = await ctx.db
      .query("planillas")
      .withIndex("by_socio_periodo", (q) =>
        q.eq("socioId", socioId).eq("anio", anio).eq("mes", mes),
      )
      .first();
    if (existente) {
      throw new ConvexError({
        codigo: "planilla_duplicada",
        mensaje: "Ya existe una planilla para ese mes.",
      });
    }

    const lecturaAnterior = await lecturaAnteriorDe(ctx, socioId, anio, mes);
    if (lecturaActual < lecturaAnterior) {
      throw new ConvexError({
        codigo: "lectura_invalida",
        mensaje: `La lectura actual (${lecturaActual}) no puede ser menor que la anterior (${lecturaAnterior}). Revise el medidor.`,
      });
    }

    const tarifa = await obtenerTarifa(ctx);
    const consumo = calcularConsumo(lecturaAnterior, lecturaActual);
    const montoConsumo = calcularMontoConsumo(consumo, tarifa);
    const multas: never[] = [];
    const montoTotal = montoConsumo;

    return await ctx.db.insert("planillas", {
      socioId,
      anio,
      mes,
      lecturaAnterior,
      lecturaActual,
      consumo,
      montoConsumo,
      multas,
      montoTotal,
      estado: "por_pagar",
      fechaLimite: fechaLimite ?? ultimoDiaDelMes(anio, mes),
    });
  },
});

/**
 * Resumen para el cierre de mes por lote: por cada socio ACTIVO devuelve su
 * lectura anterior heredada para (anio, mes) y si ya tiene planilla ese período.
 * Una sola query para toda la pantalla (evita disparar N previsualizaciones).
 * Requiere sesión; token inválido -> null.
 */
export const resumenCierre = query({
  args: {
    token: v.union(v.string(), v.null()),
    anio: v.number(),
    mes: v.number(),
  },
  handler: async (ctx, { token, anio, mes }) => {
    if (!(await sesionActiva(ctx, token))) return null;

    const tarifa = await obtenerTarifa(ctx);

    const socios = (await ctx.db.query("socios").collect()).filter(
      (s) => s.activo,
    );
    socios.sort((a, b) =>
      normalizar(a.apellidos).localeCompare(normalizar(b.apellidos)),
    );

    const filas = await Promise.all(
      socios.map(async (s) => {
        const existente = await ctx.db
          .query("planillas")
          .withIndex("by_socio_periodo", (q) =>
            q.eq("socioId", s._id).eq("anio", anio).eq("mes", mes),
          )
          .first();
        const lecturaAnterior = await lecturaAnteriorDe(ctx, s._id, anio, mes);
        return {
          socioId: s._id,
          nombre: `${s.nombres} ${s.apellidos}`,
          cedula: s.cedula,
          numeroMedidor: s.numeroMedidor,
          lecturaAnterior,
          yaRegistrada: existente !== null,
          estado: existente?.estado ?? null,
        };
      }),
    );

    return { tarifa, filas };
  },
});

/**
 * Registra varias lecturas del mismo período de una sola vez (cierre de mes).
 * Cada fila se valida de forma independiente: un error en una (lectura menor a
 * la anterior, período duplicado) NO impide guardar las demás. Requiere sesión.
 * Devuelve un resumen { creadas, omitidas, errores: [{ nombre, mensaje }] }.
 */
export const registrarLecturasLote = mutation({
  args: {
    token: v.string(),
    anio: v.number(),
    mes: v.number(),
    fechaLimite: v.optional(v.string()),
    lecturas: v.array(
      v.object({ socioId: v.id("socios"), lecturaActual: v.number() }),
    ),
  },
  handler: async (ctx, { token, anio, mes, fechaLimite, lecturas }) => {
    await requerirSesion(ctx, token);

    const tarifa = await obtenerTarifa(ctx);
    let creadas = 0;
    let omitidas = 0;
    const errores: { nombre: string; mensaje: string }[] = [];

    for (const { socioId, lecturaActual } of lecturas) {
      const socio = await ctx.db.get(socioId);
      const nombre = socio
        ? `${socio.nombres} ${socio.apellidos}`
        : "Socio desconocido";

      // Ya existe planilla para ese período: se omite (idempotente).
      const existente = await ctx.db
        .query("planillas")
        .withIndex("by_socio_periodo", (q) =>
          q.eq("socioId", socioId).eq("anio", anio).eq("mes", mes),
        )
        .first();
      if (existente) {
        omitidas++;
        continue;
      }

      const lecturaAnterior = await lecturaAnteriorDe(ctx, socioId, anio, mes);
      if (lecturaActual < lecturaAnterior) {
        errores.push({
          nombre,
          mensaje: `Lectura ${lecturaActual} menor que la anterior (${lecturaAnterior}).`,
        });
        continue;
      }

      const consumo = calcularConsumo(lecturaAnterior, lecturaActual);
      const montoConsumo = calcularMontoConsumo(consumo, tarifa);
      await ctx.db.insert("planillas", {
        socioId,
        anio,
        mes,
        lecturaAnterior,
        lecturaActual,
        consumo,
        montoConsumo,
        multas: [],
        montoTotal: montoConsumo,
        estado: "por_pagar",
        fechaLimite: fechaLimite ?? ultimoDiaDelMes(anio, mes),
      });
      creadas++;
    }

    return { creadas, omitidas, errores };
  },
});

/**
 * Corrige la lectura actual de una planilla existente y recalcula los montos
 * (conservando las multas). Requiere sesión.
 */
export const editarLectura = mutation({
  args: {
    token: v.string(),
    planillaId: v.id("planillas"),
    lecturaActual: v.number(),
  },
  handler: async (ctx, { token, planillaId, lecturaActual }) => {
    await requerirSesion(ctx, token);

    const planilla = await ctx.db.get(planillaId);
    if (!planilla) {
      throw new ConvexError({
        codigo: "planilla_inexistente",
        mensaje: "No se encontró la planilla.",
      });
    }

    if (lecturaActual < planilla.lecturaAnterior) {
      throw new ConvexError({
        codigo: "lectura_invalida",
        mensaje: `La lectura actual (${lecturaActual}) no puede ser menor que la anterior (${planilla.lecturaAnterior}). Revise el medidor.`,
      });
    }

    const tarifa = await obtenerTarifa(ctx);
    const consumo = calcularConsumo(planilla.lecturaAnterior, lecturaActual);
    const montoConsumo = calcularMontoConsumo(consumo, tarifa);
    const montoTotal = calcularMontoTotal(montoConsumo, planilla.multas);

    await ctx.db.patch(planillaId, { lecturaActual, consumo, montoConsumo, montoTotal });
    return null;
  },
});

/** Agrega una multa a la planilla y recalcula el total. Requiere sesión. */
export const agregarMulta = mutation({
  args: {
    token: v.string(),
    planillaId: v.id("planillas"),
    tipo: tipoMultaValidator,
    descripcion: v.string(),
    monto: v.number(),
  },
  handler: async (ctx, { token, planillaId, tipo, descripcion, monto }) => {
    await requerirSesion(ctx, token);

    const planilla = await ctx.db.get(planillaId);
    if (!planilla) {
      throw new ConvexError({
        codigo: "planilla_inexistente",
        mensaje: "No se encontró la planilla.",
      });
    }

    const multas = [...planilla.multas, { tipo, descripcion, monto }];
    const montoTotal = calcularMontoTotal(planilla.montoConsumo, multas);

    await ctx.db.patch(planillaId, { multas, montoTotal });
    return null;
  },
});

/** Quita la multa en la posición indicada y recalcula el total. Requiere sesión. */
export const quitarMulta = mutation({
  args: {
    token: v.string(),
    planillaId: v.id("planillas"),
    indice: v.number(),
  },
  handler: async (ctx, { token, planillaId, indice }) => {
    await requerirSesion(ctx, token);

    const planilla = await ctx.db.get(planillaId);
    if (!planilla) {
      throw new ConvexError({
        codigo: "planilla_inexistente",
        mensaje: "No se encontró la planilla.",
      });
    }

    const multas = planilla.multas.filter((_, i) => i !== indice);
    const montoTotal = calcularMontoTotal(planilla.montoConsumo, multas);

    await ctx.db.patch(planillaId, { multas, montoTotal });
    return null;
  },
});

/** Confirma el pago de una planilla (estado pagado + fecha). Requiere sesión. */
export const confirmarPago = mutation({
  args: { token: v.string(), planillaId: v.id("planillas") },
  handler: async (ctx, { token, planillaId }) => {
    await requerirSesion(ctx, token);
    await ctx.db.patch(planillaId, {
      estado: "pagado",
      fechaPago: fechaHoyISO(Date.now()),
    });
    return null;
  },
});

/**
 * Confirma el pago de varias planillas a la vez (una misma fecha de pago).
 * Útil cuando el socio paga varios meses juntos o manda el comprobante por otro
 * medio (WhatsApp) y el tesorero registra el pago a mano. Salta las que ya están
 * pagadas o no existen. Requiere sesión. Devuelve cuántas se confirmaron.
 */
export const confirmarPagos = mutation({
  args: { token: v.string(), planillaIds: v.array(v.id("planillas")) },
  handler: async (ctx, { token, planillaIds }) => {
    await requerirSesion(ctx, token);
    const fechaPago = fechaHoyISO(Date.now());
    let confirmadas = 0;
    for (const id of planillaIds) {
      const p = await ctx.db.get(id);
      if (p && p.estado !== "pagado") {
        await ctx.db.patch(id, { estado: "pagado", fechaPago });
        confirmadas++;
      }
    }
    return { confirmadas };
  },
});

/** Rechaza el pago: vuelve la planilla a por_pagar. Requiere sesión. */
export const rechazarPago = mutation({
  args: { token: v.string(), planillaId: v.id("planillas") },
  handler: async (ctx, { token, planillaId }) => {
    await requerirSesion(ctx, token);
    await ctx.db.patch(planillaId, { estado: "por_pagar" });
    return null;
  },
});

/**
 * Busca al socio por cédula + apellido (misma regla que la consulta pública).
 * Devuelve el socio si la identidad coincide, o null. Sirve para autorizar las
 * acciones "públicas" del socio (subida de comprobante) sin sesión de tesorero.
 */
async function socioPorIdentidad(
  ctx: QueryCtx,
  cedula: string,
  apellido: string,
) {
  const ced = soloDigitos(cedula);
  if (!ced) return null;
  const socio = await ctx.db
    .query("socios")
    .withIndex("by_cedula", (q) => q.eq("cedula", ced))
    .first();
  if (!socio) return null;
  return coincideApellido(apellido, socio.apellidos) ? socio : null;
}

/**
 * Genera una URL para que el socio suba su comprobante. No requiere sesión de
 * tesorero, pero sí verifica la identidad del socio (cédula + apellido) para no
 * exponer la subida de archivos de forma anónima.
 */
export const generarUrlSubida = mutation({
  args: { cedula: v.string(), apellido: v.string() },
  handler: async (ctx, { cedula, apellido }) => {
    const socio = await socioPorIdentidad(ctx, cedula, apellido);
    if (!socio) {
      throw new ConvexError({
        codigo: "no_autorizado",
        mensaje: "No se pudo verificar su identidad.",
      });
    }
    return await ctx.storage.generateUploadUrl();
  },
});

/**
 * Adjunta el comprobante subido por el socio y pasa la planilla a en_revision.
 * La usa el socio (sin sesión de tesorero), por eso valida en el servidor:
 *  - la identidad (cédula + apellido) y que la planilla sea suya,
 *  - que el archivo sea una imagen o PDF dentro del tamaño permitido,
 *  - que la planilla no esté ya pagada.
 * Si algo falla, borra el archivo recién subido para no dejar huérfanos.
 */
export const adjuntarComprobante = mutation({
  args: {
    planillaId: v.id("planillas"),
    storageId: v.id("_storage"),
    cedula: v.string(),
    apellido: v.string(),
  },
  handler: async (ctx, { planillaId, storageId, cedula, apellido }) => {
    // Borra el archivo recién subido y devuelve el rechazo. Importante: NO se
    // lanza un error, porque una mutation de Convex es transaccional y un throw
    // revertiría también el `storage.delete`, dejando el archivo huérfano.
    // Devolver un resultado confirma la transacción (y con ella, el borrado).
    async function rechazar(mensaje: string) {
      await ctx.storage.delete(storageId);
      return { ok: false as const, mensaje };
    }

    // 1) Validar el archivo subido (tipo y tamaño) contra su metadato real,
    //    no contra lo que diga el cliente.
    const meta = await ctx.db.system.get(storageId);
    if (!meta) {
      // No hay archivo almacenado que borrar.
      return { ok: false as const, mensaje: "No se encontró el archivo subido." };
    }
    if (!meta.contentType || !COMPROBANTE_TIPOS_OK.includes(meta.contentType)) {
      return await rechazar(
        "El comprobante debe ser una imagen (JPG, PNG) o un PDF.",
      );
    }
    if (meta.size > COMPROBANTE_MAX_BYTES) {
      return await rechazar(
        "El comprobante es demasiado grande (máximo 5 MB).",
      );
    }

    // 2) Verificar identidad del socio y que la planilla le pertenezca.
    const socio = await socioPorIdentidad(ctx, cedula, apellido);
    const planilla = await ctx.db.get(planillaId);
    if (!socio || !planilla || planilla.socioId !== socio._id) {
      return await rechazar(
        "No se pudo verificar su identidad para esta planilla.",
      );
    }

    // 3) No permitir alterar una planilla ya confirmada como pagada.
    if (planilla.estado === "pagado") {
      return await rechazar(
        "Esta planilla ya está pagada. No hace falta subir comprobante.",
      );
    }

    // 4) Reemplazar el comprobante anterior sin dejar archivos huérfanos.
    if (planilla.comprobanteId) {
      await ctx.storage.delete(planilla.comprobanteId);
    }

    await ctx.db.patch(planillaId, {
      comprobanteId: storageId,
      estado: "en_revision",
      comprobantePorWhatsApp: false, // ahora hay archivo subido; se limpia la marca de WhatsApp
    });
    return { ok: true as const };
  },
});

/**
 * El socio indica que envió el comprobante por WhatsApp (no lo subió a la app).
 * Marca las planillas seleccionadas como en_revision y deja constancia de que
 * llegó por WhatsApp, para que el tesorero lo busque ahí. Verifica identidad
 * (cédula + apellido) como el resto de acciones públicas del socio.
 */
export const marcarComprobanteWhatsApp = mutation({
  args: {
    cedula: v.string(),
    apellido: v.string(),
    planillaIds: v.array(v.id("planillas")),
  },
  handler: async (ctx, { cedula, apellido, planillaIds }) => {
    const socio = await socioPorIdentidad(ctx, cedula, apellido);
    if (!socio) {
      return { ok: false as const, mensaje: "No se pudo verificar su identidad." };
    }
    let marcadas = 0;
    for (const id of planillaIds) {
      const p = await ctx.db.get(id);
      if (p && p.socioId === socio._id && p.estado !== "pagado") {
        await ctx.db.patch(id, {
          estado: "en_revision",
          comprobantePorWhatsApp: true,
        });
        marcadas++;
      }
    }
    return { ok: true as const, marcadas };
  },
});
