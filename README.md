# Sistema de Consulta y Cobro de Agua

Aplicación web para **juntas de agua comunitarias**: los socios consultan cuánto
deben, ven su historial de pagos y suben el comprobante de su transferencia; el
tesorero registra las lecturas del medidor y confirma los pagos desde un panel
protegido. El **consumo y el monto se calculan automáticamente** a partir de una
tarifa configurable — el tesorero nunca escribe el valor a mano.

Está pensada como producto **reutilizable (white-label)**: cada junta cambia su
nombre, tarifa y cuenta bancaria desde el propio panel, sin tocar el código.

**Demo en vivo:** https://junta-agua-yunguilla.vercel.app

> Público objetivo: comunidades rurales, muchos usuarios de edad avanzada. Por eso
> la interfaz prioriza **simplicidad, letras grandes, alto contraste y pocos pasos**.

---

## Características

**Para el socio (público)**
- Consulta por **cédula + apellido**.
- Planilla del mes con **desglose** (tarifa básica, excedente, multas) y monto total.
- **Historial de pagos por año**, con cada mes desplegable para ver su detalle.
- Descarga de la planilla en **PDF**.
- Datos de la cuenta bancaria y **subida del comprobante** (foto o archivo) → queda "En revisión".

**Para el tesorero (panel con clave)**
- **Registro de lectura** del medidor: solo ingresa la lectura nueva; el sistema calcula el consumo y el monto.
- **Cierre de mes por lote**: registra la lectura de todos los socios activos de una vez.
- Alta, edición y baja de **socios**.
- **Multas** (mora / minga / otro) sumadas a una planilla.
- **Confirmar / rechazar** pagos revisando el comprobante.
- **Configuración**: nombre de la junta, tarifa (básica + excedente) y cuenta bancaria.

---

## Stack

| Capa | Tecnología |
|---|---|
| Frontend | Next.js (App Router) + TypeScript + Tailwind CSS + shadcn/ui |
| Backend / Base de datos / Archivos | [Convex](https://convex.dev) (funciones, datos reactivos y File Storage) |
| PDF | jsPDF (generado en el navegador) |
| Despliegue | Vercel (frontend) + Convex (nube) |

**Puntos de diseño destacables**
- **Integridad del cobro:** el consumo y el monto siempre se calculan en el backend; nunca son campos editables (menos errores, más transparencia).
- **Datos reactivos:** las pantallas se actualizan solas cuando cambian los datos, sin recargar.
- **Seguridad del panel:** cada acción del tesorero se valida contra una sesión en el backend; la clave vive fuera del repositorio.

---

## Puesta en marcha

Requiere Node.js y una cuenta de Convex (gratuita).

```bash
# 1. Instalar dependencias
npm install

# 2. Conectar Convex (una sola vez): inicia sesión, crea el proyecto,
#    genera convex/_generated y el .env.local. Déjalo corriendo.
npx convex dev

# 3. En otra terminal, levantar la web
npm run dev            # http://localhost:3000
```

Luego, en `http://localhost:3000/admin`, presiona **"Cargar datos de ejemplo"**
para crear socios, tarifa y cuenta de muestra con varios meses de historial.

---

## Configuración

Todo se ajusta desde el panel del tesorero (pestaña **Configuración**), sin tocar código:

- **Nombre de la junta** — aparece en la página, el título y el PDF.
- **Tarifa** — valor básico, m³ incluidos y precio del excedente.
- **Cuenta bancaria** — banco, número, titular e identificación.

La **clave del tesorero** no se guarda en el código, sino como variable de entorno
de Convex:

```bash
npx convex env set CLAVE_ADMIN 'tu-clave-secreta'
```

La sesión dura 8 horas. En la demo pública la clave es `yunguilla2026`.

---

## Estructura

```
app/            Next.js App Router
  page.tsx      Consulta pública del socio
  admin/        Panel del tesorero (socios, cierre de mes, configuración)
convex/         Esquema, funciones de servidor y almacenamiento
  schema.ts     Tablas e índices
  socios.ts     Identidad de socios
  planillas.ts  Motor de cobro (lecturas, cálculo, multas, comprobantes)
  ...
lib/            Utilidades de presentación y generación de PDF
```

El detalle completo de requerimientos está en [PRD.md](PRD.md).
