# Junta de Agua de Yunguilla

Página web para que los socios consulten cuánto deben por el servicio de agua.
Versión inicial (muestra) con todo conectado de punta a punta.

**Stack:** Next.js + Tailwind + shadcn/ui (frontend) · Convex (base de datos y
backend) · Vercel (despliegue).

---

## Cómo levantarlo por primera vez

Necesitas Node.js y una cuenta de Convex (gratuita).

### 1. Conectar Convex (una sola vez)

En una terminal, dentro de la carpeta del proyecto:

```bash
npx convex dev
```

- Te pedirá **iniciar sesión** (abre el navegador) y **crear/elegir un proyecto**.
- Esto genera la carpeta `convex/_generated`, crea el archivo `.env.local` con la
  variable `NEXT_PUBLIC_CONVEX_URL` y queda **escuchando cambios**. Déjalo corriendo.

### 2. Levantar la página web

En **otra** terminal:

```bash
npm run dev
```

Abre http://localhost:3000

### 3. Cargar datos de ejemplo

1. Entra a http://localhost:3000/admin (panel del tesorero).
2. Presiona **"Cargar datos de ejemplo"** (crea 5 socios y la cuenta bancaria).
3. Vuelve a la página principal y consulta, por ejemplo:
   - Cédula **0102030405**, apellido **Guamán** → deuda de María Rosa.
   - Otros: `0203040506` / Quizhpi, `0304050607` / Lema, `0405060708` / Cabrera.

---

## Qué incluye esta versión inicial

- ✅ Consulta pública por **cédula + apellido** con tarjeta de deuda.
- ✅ Estados de pago (Por pagar / En revisión / Pagado).
- ✅ Panel del tesorero con la **lista de socios** (lee de Convex en tiempo real).
- ✅ **Clave de acceso** al panel (validada en el backend, con sesión de 8 horas).
- ✅ Carga de datos de ejemplo.
- ✅ Diseño simple, letras grandes (pensado para adultos mayores).

## Pendiente (siguientes etapas)

- ⏳ Descargar el comprobante de deuda en **PDF**.
- ⏳ Mostrar la **cuenta bancaria** y **subir el comprobante** de pago.
- ⏳ **Editar/crear/eliminar** socios y confirmar pagos desde el panel.
- ⏳ Despliegue en **Vercel** (frontend) + Convex de producción.

Ver el detalle completo de requerimientos en [PRD.md](PRD.md).

---

## Clave del administrador

La clave del panel del tesorero **no se guarda en el código**, sino como variable
de entorno en Convex (`CLAVE_ADMIN`).

- **Clave temporal de la muestra:** `yunguilla2026`
- **Para cambiarla** por una propia, corre en la terminal:
  ```
  npx convex env set CLAVE_ADMIN 'tu-clave-secreta'
  ```
- La sesión del tesorero dura 8 horas; luego pide la clave otra vez.
