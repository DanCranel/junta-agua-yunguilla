# PRD — Sistema de Consulta y Cobro de Agua
## Junta de Agua de Yunguilla

| | |
|---|---|
| **Versión** | 1.0 (borrador para revisión) |
| **Fecha** | 2026-07-20 |
| **Etapa** | Prueba / muestra (demo) |
| **Despliegue** | Vercel |

---

## 1. Resumen

Página web sencilla para que los socios de la Junta de Agua de Yunguilla consulten
cuánto deben por el servicio de agua y realicen el pago por transferencia,
enviando su comprobante para que el tesorero lo verifique. Incluye un panel de
administración simple para que el tesorero gestione los cobros del mes.

El público objetivo son personas del campo y de edad avanzada, por lo que la
prioridad de diseño es la **simplicidad y la facilidad de uso** por encima de
cualquier otra característica.

---

## 2. Objetivos

- **O1.** Que un socio pueda ver cuánto debe en menos de 30 segundos, sin ayuda.
- **O2.** Que el socio obtenga un comprobante de su deuda en PDF.
- **O3.** Que el socio sepa a qué cuenta pagar y pueda enviar su comprobante.
- **O4.** Que el tesorero actualice los cobros del mes y confirme pagos sin
  conocimientos técnicos.
- **O5.** Validar el concepto con una muestra funcional desplegada en Vercel.

### No-objetivos (fuera de alcance de esta versión)
- Pago en línea real (pasarela de pago con tarjeta). El pago se hace por
  transferencia/depósito fuera de la plataforma.
- Facturación electrónica / integración con el SRI.
- Aplicación móvil nativa.
- Múltiples juntas o multi-tenant.
- Notificaciones automáticas por correo o SMS.

---

## 3. Usuarios y roles

| Rol | Descripción | Nivel técnico |
|---|---|---|
| **Socio** | Persona del campo, muchos de edad avanzada. Consulta su deuda y paga. | Bajo |
| **Tesorero (administrador)** | Encargado de los cobros. Señor mayor con poco manejo tecnológico. | Bajo |

---

## 4. Alcance funcional

### 4.1 Lado del Socio (público)

| ID | Requerimiento |
|---|---|
| RF-01 | Ingresar con **número de cédula + apellido** (dato extra de privacidad). |
| RF-02 | Ver una tarjeta clara con: nombre, mes cobrado, lectura anterior y actual, consumo (m³), **monto a pagar**, fecha límite y **estado**. |
| RF-03 | Mensaje claro y amable si la cédula/apellido no coinciden o no hay deuda. |
| RF-04 | **Descargar un PDF** con el detalle de la deuda (comprobante de cobro). |
| RF-05 | Ver la **cuenta bancaria fija de la junta** con instrucciones simples para pagar. |
| RF-06 | **Subir el comprobante** de pago (foto o PDF) desde la misma página. |
| RF-07 | Al subir el comprobante, el estado cambia automáticamente a **"En revisión"**. |

### 4.2 Lado del Tesorero (panel con clave)

| ID | Requerimiento |
|---|---|
| RF-10 | Ingresar al panel con una **clave** de administrador. |
| RF-11 | Ver la **lista de socios** ordenada, con su estado de pago. |
| RF-12 | **Agregar, editar y eliminar** socios. |
| RF-13 | Editar por socio: lecturas del medidor, monto, mes y fecha límite. |
| RF-14 | Ver los socios **"En revisión"** y **abrir el comprobante** que subieron. |
| RF-15 | **Confirmar el pago** (→ "Pagado") o **rechazarlo** (→ "Por pagar", con opción de nota). |
| RF-16 | Editar la **configuración de la cuenta bancaria** que ven los socios. |
| RF-17 | (Deseable) Preparar el mes siguiente: pasar "lectura actual" a "anterior" y reiniciar estados. |

---

## 5. Flujos principales

### 5.1 Consulta y pago (socio)
1. Entra a la página principal.
2. Escribe **cédula** y **apellido** → botón "Consultar".
3. Ve su tarjeta de deuda con el estado actual.
4. Descarga el **PDF** si lo desea.
5. Ve la **cuenta bancaria** y realiza la transferencia por su cuenta.
6. **Sube el comprobante** (foto/PDF) → estado pasa a **"En revisión"**.
7. Queda a la espera de que el tesorero confirme.

### 5.2 Gestión y confirmación (tesorero)
1. Entra a `/admin` con su clave.
2. Actualiza lecturas y montos del mes para los socios.
3. Revisa la bandeja de **"En revisión"**.
4. Abre el comprobante, verifica y **marca "Pagado"** (o lo rechaza).

---

## 6. Estados de pago

```
🔴 Por pagar  ──(el socio sube comprobante)──▶  🟡 En revisión  ──(el tesorero confirma)──▶  🟢 Pagado
        ▲                                                         │
        └──────────────(el tesorero rechaza)─────────────────────┘
```

| Estado | Quién lo activa | Significado para el socio |
|---|---|---|
| **Por pagar** | Estado inicial / rechazo | Todavía no ha pagado. |
| **En revisión** | El socio (al subir comprobante) | Ya envió el comprobante; el tesorero lo verifica. |
| **Pagado** | El tesorero (al confirmar) | Pago confirmado. |

---

## 7. Modelo de datos

### Socio
| Campo | Tipo | Notas |
|---|---|---|
| id | texto | Identificador interno. |
| cedula | texto | Se compara solo por dígitos. |
| nombres | texto | |
| apellidos | texto | Usado también para el ingreso (login). |
| direccion | texto | Opcional. |
| lecturaAnterior | número | Lectura del medidor del mes anterior. |
| lecturaActual | número | Lectura del medidor del mes actual. |
| consumo (m³) | número | Calculado: actual − anterior. |
| montoDeuda | número | Valor a pagar en USD. |
| mes | texto | Ej. "Julio 2026". |
| fechaLimite | fecha | Hasta cuándo pagar. |
| estado | enum | por_pagar / en_revision / pagado. |
| comprobante | archivo | Foto o PDF subido por el socio (opcional). |

### Configuración (una sola)
| Campo | Notas |
|---|---|
| banco | Nombre del banco. |
| tipoCuenta | Ahorros / Corriente. |
| numeroCuenta | Número de cuenta de la junta. |
| titular | Nombre del titular. |
| identificacionTitular | Cédula/RUC del titular. |
| claveAdmin | Clave de acceso al panel del tesorero. |

---

## 8. Requerimientos no funcionales

| ID | Requerimiento |
|---|---|
| RNF-01 | **Accesibilidad para adultos mayores:** letras grandes, botones grandes, alto contraste, pasos mínimos, textos en lenguaje claro. |
| RNF-02 | **Móvil primero:** debe verse y funcionar bien en el teléfono. |
| RNF-03 | **Idioma:** español (Ecuador). |
| RNF-04 | **Privacidad:** el acceso a la deuda requiere cédula + apellido; no se exponen datos de otros socios. |
| RNF-05 | **Seguridad del panel:** el área de administración está protegida por clave. |
| RNF-06 | **Rendimiento:** carga rápida incluso con conexión lenta del campo. |
| RNF-07 | **Simplicidad de mantenimiento:** el tesorero opera sin conocimientos técnicos. |

---

## 9. Arquitectura técnica

### 9.1 Stack

| Capa | Tecnología | Rol |
|---|---|---|
| **Frontend** | Next.js (App Router) + TypeScript | Páginas y lógica de interfaz. |
| **Estilos** | Tailwind CSS | Sistema de estilos utilitario. |
| **Componentes** | shadcn/ui | Botones, tarjetas, formularios, diálogos accesibles sobre Tailwind. |
| **Backend + Base de datos** | Convex | Tablas, consultas/mutaciones en tiempo real, lógica de servidor. |
| **Archivos** | Convex File Storage | Guarda los comprobantes de pago (persistente). |
| **PDF** | jsPDF (en el navegador) | Genera el comprobante de deuda descargable. |
| **Despliegue** | Vercel (frontend) + Convex (backend en la nube) | |

### 9.2 Convex — modelo

- Tablas: **`socios`** y **`config`** (cuenta bancaria y clave del panel).
- **Consultas (queries):** buscar socio por cédula + apellido, listar socios,
  leer configuración.
- **Mutaciones (mutations):** crear/editar/eliminar socio, cambiar estado,
  registrar comprobante, actualizar configuración.
- **Almacenamiento de archivos:** el comprobante subido por el socio se guarda
  en Convex File Storage y se referencia desde el socio.
- **Tiempo real:** el panel del tesorero se actualiza solo cuando un socio sube
  un comprobante (aparece en "En revisión" sin recargar).

### 9.3 Persistencia

- Con Convex, **los datos y los comprobantes se guardan en la nube y persisten**,
  tanto al correr en local como al desplegar en Vercel. Se elimina la limitación
  de la versión anterior basada en archivos locales.
- **Requisito de configuración:** el proyecto necesita una cuenta de Convex
  (plan gratuito) y ejecutar `npx convex dev` para provisionar el backend. La URL
  del backend se expone como variable de entorno `NEXT_PUBLIC_CONVEX_URL`.
- **Camino a producción:** al pasar de la muestra a uso real, básicamente se usa
  un *deployment* de producción de Convex; el modelo de datos y las funciones no
  cambian.

---

## 10. Seguridad y privacidad

- El ingreso del socio con **cédula + apellido** ofrece una privacidad básica
  (no cualquiera adivina ambos), suficiente para una comunidad pequeña, pero
  **no es un mecanismo de seguridad fuerte**. Se documenta como decisión
  consciente.
- El panel del tesorero se protege con **clave**, validada en el backend
  (Convex), no en el navegador. Para la muestra, la clave y los datos sensibles
  no se publican en el repositorio (se usan variables de entorno de Convex).
- No se solicitan ni almacenan contraseñas bancarias ni datos de tarjetas.

---

## 11. Datos de ejemplo (para la muestra)

- **1 cuenta bancaria ficticia** de la junta.
- **5–8 socios de ejemplo** con datos inventados, en distintos estados
  (por pagar, en revisión, pagado) para poder probar todos los flujos.
- Una **clave de administrador** de ejemplo documentada para pruebas.

---

## 12. Criterios de aceptación

- [ ] Un socio puede consultar su deuda con cédula + apellido y ver todos los datos.
- [ ] Se puede descargar el PDF de la deuda.
- [ ] Se muestra la cuenta bancaria de la junta.
- [ ] El socio puede subir un comprobante y su estado pasa a "En revisión".
- [ ] El tesorero entra con clave y ve la lista de socios.
- [ ] El tesorero puede crear, editar y eliminar socios y sus montos.
- [ ] El tesorero ve el comprobante subido y puede marcar "Pagado" o rechazar.
- [ ] El tesorero puede editar la cuenta bancaria mostrada a los socios.
- [ ] La página se ve bien y es usable en un teléfono, con letras grandes.
- [ ] La aplicación se despliega correctamente en Vercel.

---

## 13. Supuestos y decisiones tomadas

- Login del socio = **cédula + apellido** (no número de socio ni PIN).
- Comprobante = **subida de archivo en la web** (no WhatsApp).
- Confirmación de pago = **el socio avisa (sube comprobante) y el tesorero confirma**.
- Cuenta bancaria = **una sola, fija** para toda la junta.
- Datos de ejemplo = **inventados** por el equipo de desarrollo.
- Estilo = **sencillo y grande**, sin logo/colores de marca por ahora.
- Stack = **Next.js + Tailwind + shadcn/ui** (frontend), **Convex** (backend,
  base de datos y almacenamiento de comprobantes), **Vercel** (despliegue).

## 14. Preguntas abiertas / futuro

- ¿Se necesita historial de meses anteriores por socio? (por ahora, solo el mes actual)
- ¿Multa o interés por mora tras la fecha límite?
- ¿Reporte/exportación para la junta (total recaudado, morosos)?
- Migración a base de datos y almacenamiento persistente para producción.
- Notificaciones (correo/WhatsApp) cuando cambia el estado.
