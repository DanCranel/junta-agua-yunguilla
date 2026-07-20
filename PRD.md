# PRD v2 — Sistema de Consulta y Cobro de Agua
## Junta de Agua de Yunguilla

| | |
|---|---|
| **Versión** | 2.0 (rediseño de cobro e historial) |
| **Fecha** | 2026-07-20 |
| **Etapa** | Prueba / muestra (demo) |
| **Stack** | Next.js + Tailwind + shadcn/ui · Convex · Vercel |
| **Repositorio** | github.com/DanCranel/junta-agua-yunguilla (privado) |

---

## 1. Resumen

Página web sencilla para que los socios de la Junta de Agua de Yunguilla consulten
cuánto deben por el servicio de agua, vean su **historial de pagos** y realicen el
pago por transferencia enviando su comprobante. Incluye un panel de administración
para que el tesorero registre las **lecturas del medidor** de cada mes; el **consumo
y el monto se calculan automáticamente** según una tarifa configurable.

Público objetivo: personas del campo y de edad avanzada → prioridad en simplicidad,
letras grandes y pocos pasos.

### Cambios clave respecto a la v1
- El monto **ya no se escribe a mano**: se calcula con las lecturas y la tarifa.
- El tesorero **solo ingresa la lectura nueva** del medidor.
- Se guarda una **planilla por socio por mes** (antes solo "el mes actual").
- El socio y el tesorero pueden ver el **historial de pagos, dividido por años**.
- Se pueden registrar **multas** (mora / inasistencia a mingas) sobre una planilla.

---

## 2. Estado del proyecto

### Ya construido (v1)
- ✅ Consulta pública por **cédula + apellido**.
- ✅ **Clave de acceso** al panel del tesorero (validada en backend, sesión 8 h).
- ✅ **CRUD de socios** y **confirmar / rechazar** pago.
- ✅ Backend Convex en la nube + repositorio en GitHub.
- ✅ Diseño accesible (letras grandes).

### A rediseñar / agregar (v2)
- 🔄 Separar **identidad del socio** de sus **planillas mensuales** (nuevo modelo).
- 🆕 **Tarifa configurable** (básica + excedente) y cálculo automático del monto.
- 🆕 Registro de **lectura mensual** (solo lectura nueva) que genera la planilla.
- 🆕 **Historial de pagos por año** (socio y tesorero).
- 🆕 **Multas** (mora / mingas) sumadas a la planilla.
- 🔒 El consumo y el monto **no son editables** por el tesorero.

---

## 3. Usuarios y roles

| Rol | Descripción | Nivel técnico |
|---|---|---|
| **Socio** | Persona del campo, muchos de edad avanzada. Consulta deuda e historial, paga. | Bajo |
| **Tesorero (administrador)** | Registra lecturas y confirma pagos. Poco manejo tecnológico. | Bajo |

---

## 4. Reglas de negocio (núcleo de la v2)

### 4.1 Cálculo del monto — Tarifa básica + excedente
La tarifa se define en la configuración (editable por el tesorero):

| Parámetro | Ejemplo (demo) |
|---|---|
| `tarifaBasica` — valor mínimo mensual | $3.00 |
| `consumoIncluido` — m³ que cubre la básica | 15 m³ |
| `precioExcedente` — valor por cada m³ adicional | $0.30 |

**Fórmula:**
```
consumo = lecturaActual − lecturaAnterior
si consumo ≤ consumoIncluido:
    montoConsumo = tarifaBasica
si no:
    montoConsumo = tarifaBasica + (consumo − consumoIncluido) × precioExcedente
montoTotal = montoConsumo + suma(multas)
```

**Ejemplos** (con la tarifa demo):
- Consumo 12 m³ → $3.00
- Consumo 15 m³ → $3.00
- Consumo 20 m³ → $3.00 + (5 × $0.30) = **$4.50**
- Consumo 20 m³ + multa de mora $1.00 → **$5.50**

### 4.2 Lecturas del medidor
- El tesorero ingresa **únicamente la lectura actual** del medidor del mes.
- La **lectura anterior** se toma automáticamente de la planilla del mes previo del
  mismo socio (para la primera planilla se usa una lectura inicial definida al crear
  el socio, por defecto 0).
- El **consumo** = lectura actual − lectura anterior (calculado, no editable).
- Si la lectura actual es menor que la anterior (cambio de medidor, error), el sistema
  avisa y no permite guardar hasta corregir. *(regla a afinar; ver §14)*

### 4.3 Campos NO editables por el tesorero
- **Consumo** y **monto** se muestran como resultado calculado, nunca como campos de
  entrada.
- El tesorero **sí** edita: datos del socio (nombre, cédula, dirección, medidor),
  la lectura nueva, la fecha límite, las multas y la configuración de tarifa.

### 4.4 Multas
- El tesorero puede agregar una o varias multas a una planilla: `tipo`
  (mora / minga / otro), `descripción`, `monto`.
- Las multas **se suman** al monto de la planilla.
- La **mora automática** (interés por atraso) queda como opción futura; por ahora las
  multas se registran manualmente. *(ver §14)*

---

## 5. Alcance funcional

### 5.1 Socio (público)

| ID | Requerimiento |
|---|---|
| RF-01 | Ingresar con **cédula + apellido**. |
| RF-02 | Ver la **planilla pendiente actual**: mes, lecturas, consumo (m³), desglose (básica, excedente, multas), **monto total**, fecha límite y **estado**. |
| RF-03 | Ver su **historial de pagos**, agrupado por **año** (cada año colapsable), con mes, consumo, monto, estado y fecha de pago. |
| RF-04 | Descargar un **PDF** de la planilla (comprobante de deuda). |
| RF-05 | Ver la **cuenta bancaria** de la junta e instrucciones de pago. |
| RF-06 | **Subir el comprobante** de pago de una planilla → estado "En revisión". |
| RF-07 | Mensaje claro si no hay coincidencia o no tiene deudas pendientes. |

### 5.2 Tesorero (panel con clave)

| ID | Requerimiento |
|---|---|
| RF-10 | Ingresar con **clave** (ya implementado). |
| RF-11 | **Crear / editar / eliminar socios** (identidad: nombre, cédula, dirección, n.º de medidor, lectura inicial). |
| RF-12 | **Registrar la lectura del mes** de un socio (solo lectura actual) → genera la planilla con consumo y monto **calculados**. |
| RF-13 | Ver el **consumo y monto calculados** antes de guardar (solo lectura, no editables). |
| RF-14 | Agregar **multas** (mora / minga / otro) a una planilla. |
| RF-15 | Ver planillas **"En revisión"**, abrir el comprobante y **confirmar** (→ Pagado, guarda fecha de pago) o **rechazar** (→ Por pagar). |
| RF-16 | Editar la **configuración de tarifa** (básica, consumo incluido, excedente) y la **cuenta bancaria**. |
| RF-17 | Ver el **historial de planillas** de cada socio, agrupado por año. |

---

## 6. Flujos principales

### 6.1 Cierre de mes (tesorero)
1. Entra al panel.
2. Por cada socio (o socio por socio), abre **"Registrar lectura del mes"**.
3. Escribe **la lectura actual** del medidor.
4. El sistema muestra: lectura anterior (heredada), consumo, básica, excedente y
   **monto** — todo calculado.
5. (Opcional) agrega **multas**.
6. Guarda → se crea la **planilla del mes** en estado "Por pagar".

### 6.2 Consulta y pago (socio)
1. Ingresa **cédula + apellido**.
2. Ve la **planilla pendiente** (con desglose) y su **historial por años**.
3. Descarga el **PDF** si lo desea.
4. Ve la **cuenta bancaria**, paga por transferencia y **sube el comprobante** →
   estado "En revisión".

### 6.3 Confirmación (tesorero)
1. Revisa las planillas **"En revisión"**.
2. Abre el comprobante y **confirma** (→ Pagado) o **rechaza** (→ Por pagar).

---

## 7. Estados de pago (por planilla)

```
🔴 Por pagar ──(socio sube comprobante)──▶ 🟡 En revisión ──(tesorero confirma)──▶ 🟢 Pagado
       ▲                                                      │
       └──────────────(tesorero rechaza)─────────────────────┘
```

---

## 8. Modelo de datos (Convex)

### socios (identidad)
| Campo | Tipo | Notas |
|---|---|---|
| cedula | texto | Se compara solo por dígitos. |
| nombres | texto | |
| apellidos | texto | También usado para el ingreso del socio. |
| direccion | texto? | Opcional. |
| numeroMedidor | texto? | Opcional. |
| lecturaInicial | número | Lectura al registrarse (base de la primera planilla). |
| activo | booleano | Para dar de baja sin borrar historial. |

### planillas (una por socio por mes)
| Campo | Tipo | Notas |
|---|---|---|
| socioId | id(socios) | |
| anio | número | Ej. 2026. Para agrupar el historial. |
| mes | número | 1–12. |
| lecturaAnterior | número | Heredada del mes previo (no editable). |
| lecturaActual | número | **Único dato que ingresa el tesorero.** |
| consumo | número | Calculado = actual − anterior. |
| montoConsumo | número | Calculado (básica + excedente). |
| multas | arreglo | `{ tipo, descripcion, monto }`. |
| montoTotal | número | montoConsumo + suma(multas). |
| estado | enum | por_pagar / en_revision / pagado. |
| fechaLimite | texto | ISO. |
| fechaPago | texto? | Se llena al confirmar. |
| comprobanteId | id(_storage)? | Comprobante subido por el socio. |
| Índices | | `by_socio` (socioId), `by_socio_periodo` (socioId, anio, mes). |

### tarifa (configuración única)
| Campo | Notas |
|---|---|
| tarifaBasica | Valor mínimo mensual. |
| consumoIncluido | m³ que cubre la básica. |
| precioExcedente | Valor por m³ adicional. |

### config (cuenta bancaria) — ya existe
banco · tipoCuenta · numeroCuenta · titular · identificacionTitular

### sesiones — ya existe
token · expiraEn

---

## 9. Requerimientos no funcionales

| ID | Requerimiento |
|---|---|
| RNF-01 | **Accesibilidad:** letras y botones grandes, alto contraste, pasos mínimos, lenguaje claro. |
| RNF-02 | **Móvil primero.** |
| RNF-03 | **Idioma:** español (Ecuador). |
| RNF-04 | **Privacidad:** consulta requiere cédula + apellido; no se exponen datos de otros socios. |
| RNF-05 | **Integridad del cobro:** consumo y monto siempre calculados; el tesorero no los altera a mano (transparencia y menos errores). |
| RNF-06 | **Seguridad del panel:** acciones protegidas por sesión en el backend. |
| RNF-07 | **Historial no destructivo:** dar de baja un socio no borra sus planillas. |

---

## 10. Arquitectura

- **Frontend:** Next.js (App Router) + TypeScript + Tailwind + shadcn/ui.
- **Backend/BD/archivos:** Convex (tablas, funciones, File Storage para comprobantes).
- **PDF:** jsPDF en el navegador.
- **Despliegue:** Vercel (frontend) + Convex (nube).
- **Migración v1→v2:** se rehace el esquema (socios + planillas + tarifa) y los datos
  de ejemplo. Al ser una muestra, no hay datos reales que preservar.

---

## 11. Seguridad y privacidad
- Ingreso del socio con cédula + apellido: privacidad básica, no seguridad fuerte
  (decisión consciente para una comunidad pequeña).
- Clave del tesorero validada en el backend; guardada como variable de entorno de
  Convex (`CLAVE_ADMIN`), fuera del repositorio.
- No se piden ni guardan contraseñas bancarias ni datos de tarjeta.

---

## 12. Datos de ejemplo (muestra)
- Tarifa demo: básica **$3.00** hasta **15 m³**, excedente **$0.30/m³**.
- Cuenta bancaria ficticia de la junta.
- 5–6 socios con **varias planillas** (varios meses / 2 años) en distintos estados,
  para poder ver el historial y probar los flujos.

---

## 13. Criterios de aceptación
- [ ] El tesorero registra una lectura y el sistema **calcula** consumo y monto (básica + excedente); no puede escribir el monto a mano.
- [ ] La lectura anterior se hereda automáticamente del mes previo.
- [ ] El tesorero puede agregar una multa y el monto total la incluye.
- [ ] El socio consulta y ve su planilla pendiente con desglose.
- [ ] El socio ve su **historial de pagos agrupado por año**.
- [ ] El tesorero ve el historial por año de cada socio.
- [ ] Descarga de PDF de la planilla.
- [ ] Cuenta bancaria visible; el socio sube comprobante (→ En revisión); el tesorero confirma (→ Pagado, con fecha) o rechaza.
- [ ] Crear/editar/eliminar socios (identidad) sigue funcionando.
- [ ] Usable en teléfono, con letras grandes.
- [ ] Desplegado en Vercel + Convex de producción.

---

## 14. Preguntas abiertas / a decidir
- **Mora automática:** ¿calcular interés/multa automáticamente al pasar la fecha
  límite, o siempre registrarla a mano? (por ahora: manual)
- **Lectura menor a la anterior:** ¿bloquear, permitir con confirmación, o manejar
  cambio de medidor? (por ahora: bloquear con aviso)
- **Registro por lote:** ¿generar la planilla de todos los socios de un mes de una
  sola vez, además de socio por socio? (futuro)
- **Formato del período:** confirmar si el "mes" se maneja por mes calendario o por
  ciclo de lectura.

## 15. Futuro (fuera del alcance actual)
- Reportes para la directiva (recaudación por mes, morosos, resumen anual).
- Cargos adicionales configurables (alcantarillado, cargo fijo, aportes).
- Corte y reconexión del servicio.
- Mora automática por atraso.
- Notificaciones (correo / WhatsApp) al cambiar de estado.
- Pago en línea real (pasarela).
