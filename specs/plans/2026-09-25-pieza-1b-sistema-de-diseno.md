# Pieza 1b — Sistema de diseño · Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Crear `packages/ui`, compartido por web, admin y dashboard, con los tokens y la tipografía de LUMIA, los componentes base y el armazón de las apps, y dejar el admin y el dashboard con el aspecto de los bocetos aprobados sin cambiar nada visible en la web.

**Architecture:** Un paquete `@clinicalumia/ui` que exporta dos CSS de Tailwind v4 (`brand.css` con la marca, `app.css` con la escala de las apps), la fuente Neue Haas Display lista para `next/font`, el logo y componentes React al estilo de shadcn/ui (Radix + `class-variance-authority` + `cn`), escritos a mano para que el resultado no dependa de la versión de la CLI. Cada app importa los CSS y declara `@source` hacia el paquete para que Tailwind genere sus clases, y lo transpila con `transpilePackages`.

**Tech Stack:** Next.js 16 · React 19 · Tailwind CSS v4 · Radix (`radix-ui`) · class-variance-authority · clsx · tailwind-merge · Vitest + Testing Library (jsdom) · Playwright.

**Spec:** `specs/2026-09-25-plataforma-lumia-v1-design.md` (secciones 4.4, 4.5 en lo visual de Especialidades y Equipo, 6 Bocetos). Bocetos: `specs/bocetos/admin-facturas.png`, `specs/bocetos/dashboard-agenda.png`, `specs/bocetos/sistema-de-diseno.png`.

**Plan anterior:** `specs/plans/2026-09-25-pieza-1a-entorno-migraciones-y-acceso.md` (Makefile, e2e con Playwright, admin y dashboard con login e invitación).

## Global Constraints

- Paleta y formas de los bocetos: sage 500 `#a1a791`, sage 800 `#5c6151`, crema `#f1ede8`, superficie `#faf8f5`, línea `#e0dbd3`, tinta `#3a3a3a`, tinta 2 `#5f5f5f`, tierra `#5b483a`; botones píldora; paneles de app con radio 24px; campos con radio 14px; sin sombras.
- Contraste en las apps: texto y botones en sage 800 o más oscuro; el sage de marca solo en superficies grandes o texto de 24px o más. Texto pequeño (12–13px) nunca en sage 700 ni más claro sobre crema.
- Tipografía: Neue Haas Display (Roman 400, Medium 500, Bold 700; la web usa también Light 300 y Black 900).
- La web no cambia visualmente: las capturas de referencia de la Tarea 1 deben seguir pasando.
- Los `data-testid` existentes se conservan (los usan los e2e de 1a).
- Sin comentarios en el código. Selectores de test: `data-testid` > rol accesible > texto; nunca clases CSS.
- Commits pequeños: un cambio por commit, título descriptivo en español, sin cuerpo ni prefijos. Nunca `--no-verify`.
- `make lint`, `make typecheck`, `make test` y `make test.e2e` en verde antes de cada commit que toque apps.

## Review Focus

1. **La web cambia sin querer al mover tokens y fuentes** (una fuente que no carga cae a Helvetica sin error): lo cubre la regresión visual de la Tarea 1, que corre en la Tarea 2.
2. **Eliminar una especialidad sin confirmación**: el diálogo sustituye a `window.confirm`; test en la Tarea 7 y e2e en la Tarea 9.
3. **Pantalla estrecha (390px)**: el menú debe seguir accesible arriba y sin desbordar; e2e en la Tarea 9.
4. **Errores que dejan de anunciarse tras el restilado**: `role="alert"` se conserva; lo cubren `admin-errors.spec.ts` y `invite.spec.ts`.
5. **Menú que no marca dónde estás** (o marca «Inicio» en todas las páginas): test de `isActivePath` en la Tarea 8.

---

## Mapa de archivos

| Archivo | Responsabilidad |
|---|---|
| `packages/ui/package.json`, `tsconfig.json`, `vitest.config.ts`, `vitest.setup.ts` | Paquete y entorno de tests (crear). |
| `packages/ui/src/styles/brand.css` | Tokens de marca comunes (crear; sale de `apps/web/app/globals.css`). |
| `packages/ui/src/styles/app.css` | Escala y base de admin y dashboard (crear). |
| `packages/ui/src/fonts.ts`, `src/fonts/*.woff2` | Neue Haas para `next/font` (crear; fuentes movidas desde `apps/web/app/fonts`). |
| `packages/ui/src/assets/logo-dark.png` | Logo (copia de `apps/web/public/logo-dark.png`). |
| `packages/ui/src/lib/cn.ts`, `src/lib/active-path.ts` | Utilidades (crear). |
| `packages/ui/src/components/*.tsx` | `button`, `label`, `input`, `select`, `checkbox`, `field`, `badge`, `card`, `table`, `confirm-dialog`, `nav-link`, `app-shell`, `page-header`, `auth-card` (crear). |
| `apps/web/app/globals.css`, `app/layout.tsx`, `next.config.ts`, `package.json` | Consumir tokens y fuente del paquete (modificar). |
| `apps/admin/**`, `apps/dashboard/**` | Base visual y pantallas restiladas (modificar). |
| `e2e/playwright.config.ts`, `e2e/web-visual.spec.ts`, `e2e/admin-ui.spec.ts` | Regresión visual de la web y pruebas de la UI del admin (crear/modificar). |

---

### Task 1: Capturas de referencia de la web

**Files:**
- Create: `e2e/web-visual.spec.ts`, `e2e/web-visual.spec.ts-snapshots/*.png` (generadas)
- Modify: `e2e/playwright.config.ts`

**Interfaces:**
- Produces: `pnpm --filter @clinicalumia/e2e exec playwright test web-visual` compara la web con las capturas de antes del cambio.

- [ ] **Step 1: Servir la web en los e2e**

En `e2e/playwright.config.ts`, añade al array `webServer`:

```ts
    {
      command: "pnpm --filter web dev",
      url: "http://localhost:3000",
      reuseExistingServer: true,
      cwd: "..",
    },
```

- [ ] **Step 2: Escribir el test**

`e2e/web-visual.spec.ts`:

```ts
import { expect, test } from "@playwright/test";

const pages = ["/", "/servicios", "/contacto", "/consentimiento"];
const widths = [1920, 1440, 390];

function snapshotName(path: string, width: number) {
  const slug = path === "/" ? "home" : path.slice(1).replaceAll("/", "-");
  return `web-${slug}-${width}.png`;
}

for (const path of pages) {
  for (const width of widths) {
    test(`web ${path} at ${width}px looks exactly as before moving tokens and fonts`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`http://localhost:3000${path}`, { waitUntil: "networkidle" });
      await page.evaluate(async () => {
        for (let y = 0; y < document.body.scrollHeight; y += 700) {
          window.scrollTo(0, y);
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
        window.scrollTo(0, 0);
        await document.fonts.ready;
      });
      await expect(page).toHaveScreenshot(snapshotName(path, width), {
        fullPage: true,
        animations: "disabled",
        maxDiffPixelRatio: 0.002,
      });
    });
  }
}
```

- [ ] **Step 3: Generar las referencias con el código actual**

Run: `make db.start && pnpm --filter @clinicalumia/e2e exec playwright test web-visual --update-snapshots`
Expected: 12 capturas en `e2e/web-visual.spec.ts-snapshots/`.

- [ ] **Step 4: Comprobar que son estables**

Run: `pnpm --filter @clinicalumia/e2e exec playwright test web-visual`
Expected: PASS, 12 tests, dos ejecuciones seguidas. Si alguna página varía entre ejecuciones (por ejemplo, imágenes que cargan tarde), añade en ese test un `mask` con el `data-testid` o rol del elemento variable y regenera; anótalo en el informe.

- [ ] **Step 5: Commit**

```bash
git add e2e
git commit -m "Guardar capturas de referencia de la web antes de compartir el diseño"
```

---

### Task 2: Paquete `@clinicalumia/ui` con la marca y la tipografía

**Files:**
- Create: `packages/ui/package.json`, `packages/ui/tsconfig.json`, `packages/ui/src/styles/brand.css`, `packages/ui/src/fonts.ts`, `packages/ui/src/assets/logo-dark.png`
- Move: `apps/web/app/fonts/*.woff2` → `packages/ui/src/fonts/`
- Modify: `apps/web/app/globals.css`, `apps/web/app/layout.tsx`, `apps/web/next.config.ts`, `apps/web/package.json`

**Interfaces:**
- Produces: `@import "@clinicalumia/ui/brand.css"`; `import { neueHaas } from "@clinicalumia/ui/fonts"` (variable CSS `--font-neue-haas`); `import logo from "@clinicalumia/ui/logo-dark.png"`.

- [ ] **Step 1: Crear el paquete**

`packages/ui/package.json`:

```json
{
  "name": "@clinicalumia/ui",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": {
    "./brand.css": "./src/styles/brand.css",
    "./fonts": "./src/fonts.ts",
    "./logo-dark.png": "./src/assets/logo-dark.png"
  },
  "scripts": {
    "typecheck": "tsc --noEmit",
    "clean": "rm -rf .turbo"
  },
  "peerDependencies": {
    "next": "16.2.4",
    "react": "19.2.4"
  },
  "devDependencies": {
    "@clinicalumia/config": "workspace:*",
    "@types/node": "^20",
    "@types/react": "^19",
    "next": "16.2.4",
    "react": "19.2.4",
    "typescript": "^5"
  }
}
```

`packages/ui/tsconfig.json`:

```json
{
  "extends": "@clinicalumia/config/typescript/base.json",
  "compilerOptions": { "jsx": "react-jsx" },
  "include": ["src/**/*.ts", "src/**/*.tsx", "*.ts"],
  "exclude": ["node_modules", ".turbo"]
}
```

Run: `mkdir -p packages/ui/src/fonts packages/ui/src/assets packages/ui/src/styles && git mv apps/web/app/fonts/*.woff2 packages/ui/src/fonts/ && cp apps/web/public/logo-dark.png packages/ui/src/assets/logo-dark.png && pnpm install`

- [ ] **Step 2: La fuente como módulo del paquete**

`packages/ui/src/fonts.ts`:

```ts
import localFont from "next/font/local";

export const neueHaas = localFont({
  src: [
    { path: "./fonts/NeueHaasDisplayLight.woff2", weight: "300" },
    { path: "./fonts/NeueHaasDisplayRoman.woff2", weight: "400" },
    { path: "./fonts/NeueHaasDisplayMedium.woff2", weight: "500" },
    { path: "./fonts/NeueHaasDisplayBold.woff2", weight: "700" },
    { path: "./fonts/NeueHaasDisplayBlack.woff2", weight: "900" },
  ],
  variable: "--font-neue-haas",
});
```

Para el tipo del import del PNG, crea `packages/ui/src/assets.d.ts`:

```ts
declare module "*.png" {
  const image: import("next/image").StaticImageData;
  export default image;
}
```

- [ ] **Step 3: Los tokens de marca**

`packages/ui/src/styles/brand.css` (los valores de la web tal cual, más los de los bocetos):

```css
@theme {
  --font-sans: var(--font-neue-haas), ui-sans-serif, system-ui, sans-serif;
  --font-display: var(--font-neue-haas), ui-sans-serif, system-ui, sans-serif;

  --color-cream-50: #f1ede8;
  --color-cream-100: #f1ede8;
  --color-cream-200: #e5e1da;
  --color-sage-100: #dfe3d6;
  --color-sage-300: #c3c7b8;
  --color-sage-400: #b5b9a7;
  --color-sage-500: #a1a791;
  --color-sage-600: #8d927e;
  --color-sage-700: #767b68;
  --color-sage-800: #5c6151;
  --color-sage-900: #3f4535;
  --color-ink-400: #9a9a9a;
  --color-ink-500: #797979;
  --color-ink-600: #797979;
  --color-ink-700: #707070;
  --color-ink-800: #5f5f5f;
  --color-ink-900: #3a3a3a;
  --color-bark-100: #eadfd6;
  --color-bark-700: #5b483a;
  --color-surface: #faf8f5;
  --color-line: #e0dbd3;
  --color-line-strong: #d3cdc3;
  --color-stone-200: #e7e2da;
  --color-stone-400: #b9b2a7;
  --color-stone-700: #4f4a44;
  --color-warning-100: #f3e2c9;
  --color-warning-800: #6e4412;
  --color-danger-100: #f5e4de;
  --color-danger-600: #9c4a31;
}
```

- [ ] **Step 4: La web consume el paquete**

`apps/web/package.json` → `dependencies`: `"@clinicalumia/ui": "workspace:*"`; `pnpm install`.

`apps/web/next.config.ts`: añade `transpilePackages: ["@clinicalumia/ui"]` al objeto de configuración existente, sin tocar lo demás.

`apps/web/app/globals.css`: sustituye el bloque desde `--font-sans` hasta `--color-bark-700` (fuentes y colores) por la importación del paquete; deja en el `@theme` de la web solo lo suyo:

```css
@import "tailwindcss";
@import "@clinicalumia/ui/brand.css";

@theme {
  --text-hero: clamp(2.5rem, 4.167vw, 5rem);
  --text-hero--line-height: 1;
  --text-kicker: clamp(1rem, 1.354vw, 1.625rem);
  --text-kicker--line-height: 1.35;
  --text-section: clamp(1.75rem, 2.604vw, 3.125rem);
  --text-section--line-height: 1.1;
  --text-question: clamp(1.125rem, 1.563vw, 1.875rem);
  --text-question--line-height: 1.3;
  --text-body: clamp(1rem, 1.302vw, 1.5625rem);
  --text-body--line-height: 1.4;
  --text-action: clamp(0.9375rem, 1.25vw, 1.5rem);
  --text-action--line-height: 1.2;

  --radius-panel: clamp(2rem, 2.969vw, 3.5625rem);
  --spacing-content: 88.75rem;
  --spacing-gutter: clamp(1.5rem, 19.87vw - 8.9rem, 12.448vw);
}
```

Conserva cualquier regla que haya después del `@theme` en el archivo original.

`apps/web/app/layout.tsx`: borra el `import localFont` y la constante `neueHaas` local y añade `import { neueHaas } from "@clinicalumia/ui/fonts";` (el `className={`${neueHaas.variable} h-full`}` se queda igual).

- [ ] **Step 5: Verificar que la web no cambia**

Run: `make lint && make typecheck && make test`
Expected: PASS.

Run: `pnpm --filter @clinicalumia/e2e exec playwright test web-visual`
Expected: PASS, 12 tests. Si falla, abre el informe (`pnpm --filter @clinicalumia/e2e exec playwright show-report`) y corrige hasta que pase **sin regenerar las capturas**. Una fuente que no carga desde el paquete se ve como Helvetica en la diferencia.

- [ ] **Step 6: Commit**

```bash
git add packages/ui apps/web pnpm-lock.yaml
git commit -m "Compartir los colores, la tipografía y el logo de LUMIA desde packages/ui"
```

---

### Task 3: Base visual de admin y dashboard

**Files:**
- Create: `packages/ui/src/styles/app.css`
- Modify: `packages/ui/package.json`, `apps/admin/app/globals.css`, `apps/admin/app/layout.tsx`, `apps/admin/next.config.ts`, `apps/admin/package.json`, y lo mismo en `apps/dashboard`

**Interfaces:**
- Produces: clases `text-title`, `rounded-field`, `rounded-card` en las apps; fondo crema, tinta `#3a3a3a` y Neue Haas por defecto.

- [ ] **Step 1: Escala de las apps**

`packages/ui/src/styles/app.css`:

```css
@theme {
  --text-title: 2.25rem;
  --text-title--line-height: 1.15;
  --text-title--letter-spacing: -0.01em;
  --radius-field: 0.875rem;
  --radius-card: 1.5rem;
}

@layer base {
  body {
    background-color: var(--color-cream-50);
    color: var(--color-ink-900);
    font-family: var(--font-sans);
    -webkit-font-smoothing: antialiased;
  }
}
```

`packages/ui/package.json` → `exports`: añade `"./app.css": "./src/styles/app.css"`.

- [ ] **Step 2: Admin y dashboard usan la marca**

En **cada una** de `apps/admin` y `apps/dashboard`:

- `package.json` → `dependencies`: `"@clinicalumia/ui": "workspace:*"` (y `pnpm install`).
- `next.config.ts`: `transpilePackages: ["@clinicalumia/ui"]` (en el dashboard, junto al `allowedDevOrigins` existente).
- `app/globals.css`, contenido completo:

```css
@import "tailwindcss";
@import "@clinicalumia/ui/brand.css";
@import "@clinicalumia/ui/app.css";
@source "../../../packages/ui/src";
```

- `app/layout.tsx`: sustituye `import { Inter } from "next/font/google";` y la constante `inter` por `import { neueHaas } from "@clinicalumia/ui/fonts";`, y el `<html>`/`<body>` por:

```tsx
    <html lang="es" className={`${neueHaas.variable} h-full`}>
      <body className="flex min-h-full flex-col font-sans">{children}</body>
    </html>
```

- [ ] **Step 3: Verificar**

Run: `make lint && make typecheck && make test && make test.e2e`
Expected: PASS (los 4 e2e de 1a y los 12 de la web).

Manual: `make dev.admin` → http://localhost:3002/login se ve con fondo crema y Neue Haas (aún con los componentes antiguos).

- [ ] **Step 4: Commit**

```bash
git add packages/ui apps/admin apps/dashboard pnpm-lock.yaml
git commit -m "Aplicar la marca LUMIA como base del admin y el dashboard"
```

---

### Task 4: Entorno de tests del paquete, `cn` y `Button`

**Files:**
- Create: `packages/ui/vitest.config.ts`, `packages/ui/vitest.setup.ts`, `packages/ui/src/lib/cn.ts`, `packages/ui/src/lib/cn.test.ts`, `packages/ui/src/components/button.tsx`, `packages/ui/src/components/button.test.tsx`
- Modify: `packages/ui/package.json`

**Interfaces:**
- Produces: `cn(...inputs: ClassValue[]): string`; `Button` (props de `<button>` + `variant: "primary" | "secondary" | "ghost" | "danger"`, `size: "md" | "sm"`, `asChild?: boolean`); `buttonVariants`. Importables como `@clinicalumia/ui/button` y `@clinicalumia/ui/cn`.

- [ ] **Step 1: Dependencias y configuración**

Run:

```bash
pnpm --filter @clinicalumia/ui add radix-ui class-variance-authority clsx tailwind-merge
pnpm --filter @clinicalumia/ui add -D vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/user-event @testing-library/jest-dom @types/react-dom react-dom
```

`packages/ui/package.json`: en `exports` añade `"./cn": "./src/lib/cn.ts"` y `"./*": "./src/components/*.tsx"` (al final); en `scripts`, `"test": "vitest run"`; en `peerDependencies`, `"react-dom": "19.2.4"`.

`packages/ui/vitest.config.ts`:

```ts
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.{ts,tsx}"],
    setupFiles: ["./vitest.setup.ts"],
  },
});
```

`packages/ui/vitest.setup.ts`:

```ts
import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

afterEach(cleanup);
```

- [ ] **Step 2: Tests de `cn` (fallan)**

`packages/ui/src/lib/cn.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { cn } from "./cn";

describe("cn", () => {
  it("lets a caller override a component's default size with the app title size", () => {
    expect(cn("text-sm", "text-title")).toBe("text-title");
  });

  it("keeps a custom size and a text colour together, since they are different properties", () => {
    expect(cn("text-title", "text-sage-800")).toBe("text-title text-sage-800");
  });

  it("lets a caller override the card radius", () => {
    expect(cn("rounded-card", "rounded-field")).toBe("rounded-field");
  });
});
```

Run: `pnpm --filter @clinicalumia/ui test` → Expected: FAIL (`Cannot find module './cn'`).

- [ ] **Step 3: Implementar `cn`**

`packages/ui/src/lib/cn.ts`:

```ts
import { type ClassValue, clsx } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

const merge = extendTailwindMerge({
  extend: {
    theme: {
      text: ["title"],
      radius: ["field", "card", "panel"],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return merge(clsx(inputs));
}
```

Run: `pnpm --filter @clinicalumia/ui test` → Expected: PASS, 3 tests.

- [ ] **Step 4: Tests de `Button` (fallan)**

`packages/ui/src/components/button.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Button } from "./button";

describe("Button", () => {
  it("does not run its action while disabled, so a pending form cannot be sent twice", async () => {
    const onClick = vi.fn();
    render(<Button disabled onClick={onClick}>Guardar</Button>);
    await userEvent.click(screen.getByRole("button", { name: "Guardar" }));
    expect(onClick).not.toHaveBeenCalled();
  });

  it("can render a link with the button look, keeping link semantics for navigation", () => {
    render(
      <Button asChild>
        <a href="/team">Equipo</a>
      </Button>,
    );
    expect(screen.getByRole("link", { name: "Equipo" })).toHaveAttribute("href", "/team");
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("submits the surrounding form by default, like a native button", async () => {
    const onSubmit = vi.fn((event: SubmitEvent) => event.preventDefault());
    render(
      <form onSubmit={(event) => onSubmit(event.nativeEvent as SubmitEvent)}>
        <Button>Enviar</Button>
      </form>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Enviar" }));
    expect(onSubmit).toHaveBeenCalledOnce();
  });
});
```

Run: `pnpm --filter @clinicalumia/ui test` → Expected: FAIL (`Cannot find module './button'`).

- [ ] **Step 5: Implementar `Button`**

`packages/ui/src/components/button.tsx`:

```tsx
import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";
import type { ComponentProps } from "react";
import { cn } from "../lib/cn";

export const buttonVariants = cva(
  "inline-flex cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-full border-[1.5px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sage-800 disabled:cursor-not-allowed disabled:opacity-60",
  {
    variants: {
      variant: {
        primary:
          "border-sage-800 bg-sage-800 text-cream-50 hover:border-sage-900 hover:bg-sage-900",
        secondary:
          "border-sage-800 bg-transparent text-sage-800 hover:bg-sage-100",
        ghost:
          "border-transparent bg-transparent text-sage-800 underline underline-offset-4 hover:text-sage-900",
        danger:
          "border-danger-600 bg-transparent text-danger-600 hover:bg-danger-100",
      },
      size: {
        md: "h-11 px-[22px] text-[15px]",
        sm: "h-9 px-4 text-sm",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Component = asChild ? Slot.Root : "button";
  return (
    <Component
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  );
}
```

Run: `pnpm --filter @clinicalumia/ui test` → Expected: PASS, 6 tests.

- [ ] **Step 6: Verificar y commit**

Run: `make lint && make typecheck && make test` → Expected: PASS (turbo ejecuta ya `@clinicalumia/ui#test`).

```bash
git add packages/ui pnpm-lock.yaml
git commit -m "Añadir el botón píldora al sistema de diseño"
```

---

### Task 5: Campos de formulario

**Files:**
- Create: `packages/ui/src/components/label.tsx`, `input.tsx`, `select.tsx`, `checkbox.tsx`, `field.tsx`, `field.test.tsx`

**Interfaces:**
- Consumes: `cn` (Tarea 4).
- Produces: `Label`, `Input`, `Select` (select nativo), `Checkbox` (checkbox nativo), `Field({ label, hint?, error?, children })`, donde `children` es un único control que recibe `id`, `aria-invalid` y `aria-describedby`.

- [ ] **Step 1: Tests de `Field` (fallan)**

`packages/ui/src/components/field.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Field } from "./field";
import { Input } from "./input";
import { Select } from "./select";

describe("Field", () => {
  it("connects the label to its control, so clicking or reading the label reaches the input", () => {
    render(
      <Field label="Nombre del servicio">
        <Input name="name" />
      </Field>,
    );
    expect(screen.getByLabelText("Nombre del servicio")).toHaveAttribute("name", "name");
  });

  it("announces an error and marks the control invalid, so screen reader users hear what to fix", () => {
    render(
      <Field label="Email" error="El email no es válido.">
        <Input name="email" />
      </Field>,
    );
    const input = screen.getByLabelText("Email");
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("El email no es válido.");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input.getAttribute("aria-describedby")).toContain(alert.id);
  });

  it("describes the control with its hint", () => {
    render(
      <Field label="IVA" hint="Los servicios sanitarios van exentos.">
        <Select name="vat">
          <option value="exempt">Exento</option>
        </Select>
      </Field>,
    );
    expect(screen.getByLabelText("IVA")).toHaveAccessibleDescription("Los servicios sanitarios van exentos.");
  });

  it("does not mark a valid control as invalid", () => {
    render(
      <Field label="Nombre">
        <Input name="name" />
      </Field>,
    );
    expect(screen.getByLabelText("Nombre")).not.toHaveAttribute("aria-invalid");
  });
});
```

Run: `pnpm --filter @clinicalumia/ui test` → Expected: FAIL (`Cannot find module './field'`).

- [ ] **Step 2: Implementar los controles**

`packages/ui/src/components/label.tsx`:

```tsx
import type { ComponentProps } from "react";
import { cn } from "../lib/cn";

export function Label({ className, ...props }: ComponentProps<"label">) {
  return (
    <label
      className={cn("text-[13px] font-medium text-ink-800", className)}
      {...props}
    />
  );
}
```

`packages/ui/src/components/input.tsx`:

```tsx
import type { ComponentProps } from "react";
import { cn } from "../lib/cn";

export const fieldControl =
  "h-11 w-full rounded-field border border-line-strong bg-white px-3.5 text-[15px] text-ink-900 outline-none transition-colors placeholder:text-ink-500 focus:border-sage-800 aria-[invalid=true]:border-danger-600";

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cn(fieldControl, className)} {...props} />;
}
```

`packages/ui/src/components/select.tsx`:

```tsx
import type { ComponentProps } from "react";
import { cn } from "../lib/cn";
import { fieldControl } from "./input";

export function Select({ className, ...props }: ComponentProps<"select">) {
  return <select className={cn(fieldControl, "pr-9", className)} {...props} />;
}
```

`packages/ui/src/components/checkbox.tsx`:

```tsx
import type { ComponentProps } from "react";
import { cn } from "../lib/cn";

export function Checkbox({ className, ...props }: Omit<ComponentProps<"input">, "type">) {
  return (
    <input
      type="checkbox"
      className={cn("size-[18px] shrink-0 accent-sage-800", className)}
      {...props}
    />
  );
}
```

`packages/ui/src/components/field.tsx`:

```tsx
"use client";

import { cloneElement, type ReactElement, useId } from "react";
import { Label } from "./label";

type ControlProps = {
  id?: string;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
};

export function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: ReactElement<ControlProps>;
}) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy =
    [hint && hintId, error && errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      {cloneElement(children, {
        id,
        "aria-invalid": error ? true : undefined,
        "aria-describedby": describedBy,
      })}
      {hint && (
        <p id={hintId} className="text-[13px] text-ink-800">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} role="alert" className="text-[13px] text-danger-600">
          {error}
        </p>
      )}
    </div>
  );
}
```

Run: `pnpm --filter @clinicalumia/ui test` → Expected: PASS, 10 tests.

- [ ] **Step 3: Verificar y commit**

Run: `make lint && make typecheck && make test` → Expected: PASS.

```bash
git add packages/ui
git commit -m "Añadir los campos de formulario accesibles al sistema de diseño"
```

---

### Task 6: Etiquetas de estado, tarjetas y tablas

**Files:**
- Create: `packages/ui/src/components/badge.tsx`, `card.tsx`, `table.tsx`, `table.test.tsx`

**Interfaces:**
- Produces: `Badge({ tone: "success" | "warning" | "bark" | "neutral" | "outline" })`; `Card` (panel de superficie, radio 24px); `Table`, `TableHead`, `TableBody`, `TableRow`, `TableHeaderCell`, `TableCell` (tabla semántica con el estilo del boceto de facturas).

- [ ] **Step 1: Test de la tabla (falla)**

`packages/ui/src/components/table.test.tsx`:

```tsx
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "./table";

describe("Table", () => {
  it("keeps real table semantics, so assistive technology can read cells with their column headers", () => {
    render(
      <Table aria-label="Facturas">
        <TableHead>
          <TableRow>
            <TableHeaderCell>Nº</TableHeaderCell>
            <TableHeaderCell>Total</TableHeaderCell>
          </TableRow>
        </TableHead>
        <TableBody>
          <TableRow>
            <TableCell>2026-0148</TableCell>
            <TableCell>40,00 €</TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    );
    const table = screen.getByRole("table", { name: "Facturas" });
    expect(within(table).getAllByRole("columnheader").map((cell) => cell.textContent)).toEqual(["Nº", "Total"]);
    expect(within(table).getByRole("cell", { name: "40,00 €" })).toBeInTheDocument();
  });
});
```

Run: `pnpm --filter @clinicalumia/ui test` → Expected: FAIL (`Cannot find module './table'`).

- [ ] **Step 2: Implementar**

`packages/ui/src/components/table.tsx`:

```tsx
import type { ComponentProps } from "react";
import { cn } from "../lib/cn";

export function Table({ className, ...props }: ComponentProps<"table">) {
  return (
    <div className="overflow-x-auto rounded-card bg-surface p-2">
      <table className={cn("w-full border-collapse text-sm", className)} {...props} />
    </div>
  );
}

export function TableHead(props: ComponentProps<"thead">) {
  return <thead {...props} />;
}

export function TableBody(props: ComponentProps<"tbody">) {
  return <tbody {...props} />;
}

export function TableRow({ className, ...props }: ComponentProps<"tr">) {
  return <tr className={cn("[&+&]:border-line [&+&]:border-t", className)} {...props} />;
}

export function TableHeaderCell({ className, ...props }: ComponentProps<"th">) {
  return (
    <th
      className={cn("px-4 py-3 text-left text-[13px] font-medium text-ink-800", className)}
      {...props}
    />
  );
}

export function TableCell({ className, ...props }: ComponentProps<"td">) {
  return <td className={cn("px-4 py-3.5 text-ink-900", className)} {...props} />;
}
```

`packages/ui/src/components/badge.tsx`:

```tsx
import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";
import { cn } from "../lib/cn";

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium",
  {
    variants: {
      tone: {
        success: "bg-sage-100 text-sage-900",
        warning: "bg-warning-100 text-warning-800",
        bark: "bg-bark-100 text-bark-700",
        neutral: "bg-stone-200 text-stone-700",
        outline: "border border-stone-400 text-stone-700",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
);

export function Badge({
  className,
  tone,
  ...props
}: ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}
```

`packages/ui/src/components/card.tsx`:

```tsx
import type { ComponentProps } from "react";
import { cn } from "../lib/cn";

export function Card({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("rounded-card bg-surface p-6", className)} {...props} />;
}
```

Run: `pnpm --filter @clinicalumia/ui test` → Expected: PASS, 11 tests.

- [ ] **Step 3: Verificar y commit**

Run: `make lint && make typecheck && make test` → Expected: PASS.

```bash
git add packages/ui
git commit -m "Añadir etiquetas de estado, tarjetas y tablas al sistema de diseño"
```

---

### Task 7: Diálogo de confirmación

**Files:**
- Create: `packages/ui/src/components/confirm-dialog.tsx`, `confirm-dialog.test.tsx`

**Interfaces:**
- Consumes: `Button` (Tarea 4).
- Produces: `ConfirmDialog({ trigger, title, description, confirmLabel, cancelLabel?, onConfirm })`. `trigger` es un único elemento clicable (normalmente un `Button`). El botón de confirmar lleva `data-testid="confirm-action"`.

- [ ] **Step 1: Tests (fallan)**

`packages/ui/src/components/confirm-dialog.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Button } from "./button";
import { ConfirmDialog } from "./confirm-dialog";

function renderDialog(onConfirm = vi.fn()) {
  render(
    <ConfirmDialog
      trigger={<Button variant="danger">Eliminar</Button>}
      title="¿Eliminar Logopedia?"
      description="Esta acción no se puede deshacer."
      confirmLabel="Eliminar"
      onConfirm={onConfirm}
    />,
  );
  return onConfirm;
}

describe("ConfirmDialog", () => {
  it("asks before a destructive action instead of acting on the first click", async () => {
    const onConfirm = renderDialog();
    await userEvent.click(screen.getByRole("button", { name: "Eliminar" }));
    expect(screen.getByRole("alertdialog", { name: "¿Eliminar Logopedia?" })).toBeInTheDocument();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("runs the action once when confirmed and closes", async () => {
    const onConfirm = renderDialog();
    await userEvent.click(screen.getByRole("button", { name: "Eliminar" }));
    await userEvent.click(screen.getByTestId("confirm-action"));
    expect(onConfirm).toHaveBeenCalledOnce();
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("does nothing when cancelled or dismissed with Escape", async () => {
    const onConfirm = renderDialog();
    await userEvent.click(screen.getByRole("button", { name: "Eliminar" }));
    await userEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    await userEvent.click(screen.getByRole("button", { name: "Eliminar" }));
    await userEvent.keyboard("{Escape}");
    expect(onConfirm).not.toHaveBeenCalled();
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });
});
```

Run: `pnpm --filter @clinicalumia/ui test` → Expected: FAIL (`Cannot find module './confirm-dialog'`).

- [ ] **Step 2: Implementar**

`packages/ui/src/components/confirm-dialog.tsx`:

```tsx
"use client";

import { AlertDialog } from "radix-ui";
import type { ReactElement } from "react";
import { Button } from "./button";

export function ConfirmDialog({
  trigger,
  title,
  description,
  confirmLabel,
  cancelLabel = "Cancelar",
  onConfirm,
}: {
  trigger: ReactElement;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel?: string;
  onConfirm: () => void;
}) {
  return (
    <AlertDialog.Root>
      <AlertDialog.Trigger asChild>{trigger}</AlertDialog.Trigger>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 bg-ink-900/30" />
        <AlertDialog.Content className="fixed top-1/2 left-1/2 flex w-[min(28rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 flex-col gap-4 rounded-card bg-surface p-6">
          <AlertDialog.Title className="text-xl font-bold text-ink-900">
            {title}
          </AlertDialog.Title>
          <AlertDialog.Description className="text-[15px] text-ink-800">
            {description}
          </AlertDialog.Description>
          <div className="flex justify-end gap-2">
            <AlertDialog.Cancel asChild>
              <Button variant="secondary" size="sm">
                {cancelLabel}
              </Button>
            </AlertDialog.Cancel>
            <AlertDialog.Action asChild>
              <Button
                variant="danger"
                size="sm"
                data-testid="confirm-action"
                onClick={onConfirm}
              >
                {confirmLabel}
              </Button>
            </AlertDialog.Action>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
```

Run: `pnpm --filter @clinicalumia/ui test` → Expected: PASS, 14 tests. Si jsdom no resuelve alguna interacción de Radix (puntero), usa `userEvent.setup({ pointerEventsCheck: 0 })` en ese test y anótalo en el informe; nunca quites una aserción.

- [ ] **Step 3: Verificar y commit**

Run: `make lint && make typecheck && make test` → Expected: PASS.

```bash
git add packages/ui
git commit -m "Añadir un diálogo de confirmación para acciones destructivas"
```

---

### Task 8: Armazón de las apps

**Files:**
- Create: `packages/ui/src/lib/active-path.ts`, `active-path.test.ts`, `packages/ui/src/components/nav-link.tsx`, `app-shell.tsx`, `app-shell.test.tsx`, `page-header.tsx`, `auth-card.tsx`

**Interfaces:**
- Consumes: `cn`, `Card`.
- Produces:
  - `isActivePath(href: string, pathname: string): boolean`
  - `NavLink({ href, children })` (marca `aria-current="page"`)
  - `AppShell({ logo, section, nav, user, logout, children })` con `nav: { href: string; label: string }[]`, `user: { name: string; detail: string }`, `logo` y `logout` como `ReactNode`
  - `PageHeader({ title, description?, actions? })`
  - `AuthCard({ logo, title, subtitle?, children })`

- [ ] **Step 1: Tests (fallan)**

`packages/ui/src/lib/active-path.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { isActivePath } from "./active-path";

describe("isActivePath", () => {
  it("marks a section active on its own page and on its sub-pages", () => {
    expect(isActivePath("/team", "/team")).toBe(true);
    expect(isActivePath("/team", "/team/123")).toBe(true);
  });

  it("does not mark Inicio active everywhere, only on the home page", () => {
    expect(isActivePath("/", "/")).toBe(true);
    expect(isActivePath("/", "/team")).toBe(false);
  });

  it("does not confuse sections that share a prefix", () => {
    expect(isActivePath("/team", "/teams")).toBe(false);
  });
});
```

`packages/ui/src/components/app-shell.test.tsx`:

```tsx
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AppShell } from "./app-shell";

vi.mock("next/navigation", () => ({ usePathname: () => "/specialties" }));

describe("AppShell", () => {
  it("shows the sections, marks where you are, and keeps the page content in the main landmark", () => {
    render(
      <AppShell
        logo={<span>LUMIA</span>}
        section="Administración"
        nav={[
          { href: "/", label: "Inicio" },
          { href: "/specialties", label: "Especialidades" },
        ]}
        user={{ name: "Patricia Hernán", detail: "Propietaria" }}
        logout={<button type="submit">Salir</button>}
      >
        <h1>Especialidades</h1>
      </AppShell>,
    );
    const nav = screen.getByRole("navigation", { name: "Secciones" });
    expect(within(nav).getByRole("link", { name: "Especialidades" })).toHaveAttribute("aria-current", "page");
    expect(within(nav).getByRole("link", { name: "Inicio" })).not.toHaveAttribute("aria-current");
    expect(within(screen.getByRole("main")).getByRole("heading", { name: "Especialidades" })).toBeInTheDocument();
    expect(screen.getByText("Patricia Hernán")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Salir" })).toBeInTheDocument();
  });
});
```

Run: `pnpm --filter @clinicalumia/ui test` → Expected: FAIL (módulos inexistentes).

- [ ] **Step 2: Implementar**

`packages/ui/src/lib/active-path.ts`:

```ts
export function isActivePath(href: string, pathname: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}
```

`packages/ui/src/components/nav-link.tsx`:

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { isActivePath } from "../lib/active-path";
import { cn } from "../lib/cn";

export function NavLink({ href, children }: { href: string; children: ReactNode }) {
  const active = isActivePath(href, usePathname());
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "whitespace-nowrap rounded-full px-4 py-2.5 text-[15px] transition-colors",
        active
          ? "bg-sage-800 font-medium text-cream-50"
          : "text-ink-800 hover:bg-sage-100",
      )}
    >
      {children}
    </Link>
  );
}
```

`packages/ui/src/components/app-shell.tsx`:

```tsx
import type { ReactNode } from "react";
import { NavLink } from "./nav-link";

export type NavItem = { href: string; label: string };

export function AppShell({
  logo,
  section,
  nav,
  user,
  logout,
  children,
}: {
  logo: ReactNode;
  section: string;
  nav: NavItem[];
  user: { name: string; detail: string };
  logout: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-cream-50 lg:flex-row">
      <aside className="flex flex-col gap-5 border-line border-b px-5 py-5 lg:w-62 lg:shrink-0 lg:gap-10 lg:border-r lg:border-b-0 lg:pt-9 lg:pb-7">
        <div className="flex flex-col gap-1.5 px-3">
          {logo}
          <span className="text-xs font-medium tracking-[0.12em] text-sage-800 uppercase">
            {section}
          </span>
        </div>
        <nav
          aria-label="Secciones"
          className="flex gap-1 overflow-x-auto lg:flex-1 lg:flex-col"
        >
          {nav.map((item) => (
            <NavLink key={item.href} href={item.href}>
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="flex items-center justify-between gap-3 px-3 lg:flex-col lg:items-start lg:border-line lg:border-t lg:pt-4">
          <div className="flex flex-col">
            <span className="text-sm font-medium text-ink-900">{user.name}</span>
            <span className="text-[13px] text-ink-800">{user.detail}</span>
          </div>
          {logout}
        </div>
      </aside>
      <main className="flex min-w-0 flex-1 flex-col gap-6 px-6 py-8 lg:px-12 lg:py-10">
        {children}
      </main>
    </div>
  );
}
```

`packages/ui/src/components/page-header.tsx`:

```tsx
import type { ReactNode } from "react";

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-6">
      <div className="flex flex-col gap-1.5">
        <h1 className="text-title font-bold text-ink-900">{title}</h1>
        {description && <p className="text-[15px] text-ink-800">{description}</p>}
      </div>
      {actions && <div className="flex gap-2.5">{actions}</div>}
    </div>
  );
}
```

`packages/ui/src/components/auth-card.tsx`:

```tsx
import type { ReactNode } from "react";
import { Card } from "./card";

export function AuthCard({
  logo,
  title,
  subtitle,
  children,
}: {
  logo: ReactNode;
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <main className="flex flex-1 items-center justify-center bg-cream-50 px-6 py-16">
      <Card className="flex w-full max-w-sm flex-col gap-6 p-8">
        <div className="flex flex-col items-center gap-4 text-center">
          {logo}
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-bold text-ink-900">{title}</h1>
            {subtitle && <p className="text-sm text-ink-800">{subtitle}</p>}
          </div>
        </div>
        {children}
      </Card>
    </main>
  );
}
```

Run: `pnpm --filter @clinicalumia/ui test` → Expected: PASS, 18 tests.

- [ ] **Step 3: Verificar y commit**

Run: `make lint && make typecheck && make test` → Expected: PASS.

```bash
git add packages/ui
git commit -m "Añadir el armazón de las apps con menú lateral y cabeceras"
```

---

### Task 9: Admin con el aspecto de los bocetos

**Files:**
- Modify: `apps/admin/app/(admin)/layout.tsx`, `page.tsx`, `specialties/page.tsx`, `specialties/CreateForm.tsx`, `specialties/SpecialtyRow.tsx`, `team/page.tsx`, `team/CreateForm.tsx`, `team/MemberRow.tsx`, `apps/admin/app/login/page.tsx`
- Create: `e2e/admin-ui.spec.ts`

**Interfaces:**
- Consumes: todo lo de las Tareas 4–8.
- Produces: `data-testid` nuevos `logout`, `specialty-delete`, `member-status`; se conservan `login-submit`, `specialty-name-input`, `specialty-submit`, `specialty-row`, `specialty-edit`, `specialty-rename-input`, `specialty-save`, `specialty-error`, `member-error`.

- [ ] **Step 1: e2e de la UI del admin (falla)**

`e2e/admin-ui.spec.ts`:

```ts
import { execSync } from "node:child_process";
import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

const serviceKey = execSync("cd ../packages/db && supabase status -o env")
  .toString()
  .match(/^SERVICE_ROLE_KEY="?([^"\n]+)/m)?.[1];
const admin = createClient("http://127.0.0.1:54321", serviceKey ?? "");
const ADMIN = "http://localhost:3002";

async function loginAsOwner(page: import("@playwright/test").Page) {
  const email = `owner-ui-${Date.now()}@test.local`;
  const password = "lumia-segura-2026";
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  expect(error).toBeNull();
  const { error: profileError } = await admin.from("profiles").insert({
    id: data.user!.id, email, full_name: "Propietaria UI", role: "owner", is_active: true,
  });
  expect(profileError).toBeNull();
  await page.goto(`${ADMIN}/login`);
  await page.fill('[name="email"]', email);
  await page.fill('[name="password"]', password);
  await page.getByTestId("login-submit").click();
  await expect(page.getByRole("navigation", { name: "Secciones" })).toBeVisible();
}

test("deleting a specialty asks for confirmation and only deletes after confirming", async ({ page }) => {
  await loginAsOwner(page);
  const name = `Borrar ${Date.now()}`;
  await page.goto(`${ADMIN}/specialties`);
  await page.getByTestId("specialty-name-input").fill(name);
  await page.getByTestId("specialty-submit").click();
  const row = page.getByTestId("specialty-row").filter({ hasText: name });
  await row.getByTestId("specialty-delete").click();
  await expect(page.getByRole("alertdialog")).toBeVisible();
  await page.getByRole("button", { name: "Cancelar" }).click();
  await expect(row).toBeVisible();
  await row.getByTestId("specialty-delete").click();
  await page.getByTestId("confirm-action").click();
  await expect(row).toHaveCount(0);
});

test("the section menu marks the current page and stays usable on a phone", async ({ page }) => {
  await loginAsOwner(page);
  await page.goto(`${ADMIN}/team`);
  const nav = page.getByRole("navigation", { name: "Secciones" });
  await expect(nav.getByRole("link", { name: "Equipo" })).toHaveAttribute("aria-current", "page");
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(nav.getByRole("link", { name: "Especialidades" })).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});
```

Run: `make test.e2e` → Expected: FAIL (no hay `navigation` «Secciones» ni `specialty-delete`).

- [ ] **Step 2: Layout con el armazón**

`apps/admin/app/(admin)/layout.tsx` — conserva todo hasta el `if (…) redirect("/login")` incluido y sustituye el `return` y los imports de `Link` por:

```tsx
import { AppShell } from "@clinicalumia/ui/app-shell";
import { Button } from "@clinicalumia/ui/button";
import logo from "@clinicalumia/ui/logo-dark.png";
import Image from "next/image";
```

```tsx
  return (
    <AppShell
      logo={
        <Image src={logo} alt="LUMIA · Clínica Logopedia miofuncional" width={150} priority />
      }
      section="Administración"
      nav={[
        { href: "/", label: "Inicio" },
        { href: "/specialties", label: "Especialidades" },
        { href: "/team", label: "Equipo" },
      ]}
      user={{ name: profile.full_name, detail: "Propietaria" }}
      logout={
        <form action={logout}>
          <Button type="submit" variant="ghost" size="sm" data-testid="logout">
            Salir
          </Button>
        </form>
      }
    >
      {children}
    </AppShell>
  );
```

- [ ] **Step 3: Inicio del admin**

`apps/admin/app/(admin)/page.tsx`:

```tsx
import { Card } from "@clinicalumia/ui/card";
import { PageHeader } from "@clinicalumia/ui/page-header";
import Link from "next/link";

const sections = [
  { href: "/specialties", title: "Especialidades", text: "Catálogo de especialidades de la clínica." },
  { href: "/team", title: "Equipo", text: "Empleados con acceso al dashboard." },
];

export default function AdminHome() {
  return (
    <>
      <PageHeader title="Bienvenida" description="Configura la clínica desde aquí." />
      <div className="grid gap-4 sm:grid-cols-2">
        {sections.map((section) => (
          <Link key={section.href} href={section.href} className="rounded-card transition-colors focus-visible:outline-2 focus-visible:outline-sage-800">
            <Card className="flex h-full flex-col gap-1.5 hover:bg-sage-100">
              <h2 className="text-lg font-bold text-ink-900">{section.title}</h2>
              <p className="text-sm text-ink-800">{section.text}</p>
            </Card>
          </Link>
        ))}
      </div>
    </>
  );
}
```

- [ ] **Step 4: Especialidades**

`specialties/page.tsx` — mismo acceso a datos; sustituye el JSX devuelto por:

```tsx
    <>
      <PageHeader
        title="Especialidades"
        description="Catálogo de especialidades. Se asignan a cada empleado al darlo de alta."
      />
      <Card>
        <CreateForm />
      </Card>
      {list.length === 0 ? (
        <Card className="text-center text-sm text-ink-800">
          Aún no hay especialidades. Crea la primera arriba.
        </Card>
      ) : (
        <Card className="p-2">
          <ul>
            {list.map((specialty) => (
              <SpecialtyRow key={specialty.id} specialty={specialty} />
            ))}
          </ul>
        </Card>
      )}
    </>
```

con imports `import { Card } from "@clinicalumia/ui/card";` y `import { PageHeader } from "@clinicalumia/ui/page-header";`.

`specialties/CreateForm.tsx` — misma lógica; sustituye el `<form …>…</form>` por:

```tsx
    <form ref={formRef} action={formAction} className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <div className="flex-1">
        <Field label="Nueva especialidad" error={state && "error" in state ? state.error : undefined}>
          <Input name="name" required placeholder="Logopedia, Psicología…" data-testid="specialty-name-input" />
        </Field>
      </div>
      <Button type="submit" disabled={pending} data-testid="specialty-submit">
        {pending ? "Añadiendo…" : "Añadir"}
      </Button>
    </form>
```

con imports de `Button`, `Field` e `Input` desde `@clinicalumia/ui/…`.

`specialties/SpecialtyRow.tsx` — misma lógica y estados. Cambios:

1. Imports: `Button`, `ConfirmDialog`, `Input` desde `@clinicalumia/ui/…`.
2. Ambos `<li>`: `className="flex flex-wrap items-center gap-3 px-4 py-3 [&+&]:border-line [&+&]:border-t"`, conservando `data-testid="specialty-row"`.
3. Modo edición: el `<input>` pasa a `<Input … data-testid="specialty-rename-input" className="flex-1" aria-label="Nombre de la especialidad" />`; guardar pasa a `<Button type="submit" size="sm" disabled={pending} data-testid="specialty-save">`; cancelar a `<Button type="button" variant="secondary" size="sm" onClick={() => setEditing(false)}>`.
4. Modo lectura: nombre en `text-[15px] font-medium text-ink-900`, slug en `text-xs text-ink-800`; «Editar» es `<Button type="button" variant="secondary" size="sm" data-testid="specialty-edit" onClick={() => setEditing(true)}>`; «Eliminar» deja de usar `confirm()`:

```tsx
      <ConfirmDialog
        trigger={
          <Button type="button" variant="danger" size="sm" disabled={pending} data-testid="specialty-delete">
            Eliminar
          </Button>
        }
        title={`¿Eliminar «${specialty.name}»?`}
        description="Los empleados que la tengan asignada se quedarán sin especialidad."
        confirmLabel="Eliminar"
        onConfirm={() =>
          startTransition(async () => {
            const result = await deleteSpecialty(specialty.id);
            setError("error" in result ? result.error : null);
          })
        }
      />
```

5. El párrafo de error: `className="w-full text-[13px] text-danger-600"`, conservando `role="alert"` y `data-testid="specialty-error"`.

- [ ] **Step 5: Equipo**

`team/page.tsx` — mismo acceso a datos; JSX:

```tsx
    <>
      <PageHeader
        title="Equipo"
        description="Empleados con acceso al dashboard. Al invitar a alguien recibirá un email para crear su contraseña."
      />
      <Card>
        <CreateForm specialties={specialtyList} />
      </Card>
      {memberList.length === 0 ? (
        <Card className="text-center text-sm text-ink-800">
          Aún no hay empleados. Invita al primero arriba.
        </Card>
      ) : (
        <Card className="p-2">
          <ul>
            {memberList.map((member) => (
              <MemberRow key={member.id} member={member} specialties={specialtyList} />
            ))}
          </ul>
        </Card>
      )}
    </>
```

`team/CreateForm.tsx` — misma lógica; el formulario:

```tsx
    <form ref={formRef} action={formAction} className="flex flex-col gap-4">
      <h2 className="text-lg font-bold text-ink-900">Invitar a un empleado</h2>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Email">
          <Input type="email" name="email" required placeholder="nombre@clinicalumia.es" />
        </Field>
        <Field label="Nombre completo">
          <Input name="full_name" required />
        </Field>
        <Field label="Especialidad">
          <Select name="specialty_id" defaultValue="">
            <option value="">Sin asignar</option>
            {specialties.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </Select>
        </Field>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending}>{pending ? "Invitando…" : "Invitar"}</Button>
        {state && "error" in state && (
          <p role="alert" className="text-[13px] text-danger-600">{state.error}</p>
        )}
        {state && "ok" in state && state.ok && (
          <p role="status" className="text-[13px] text-sage-900">Invitación enviada por email.</p>
        )}
      </div>
    </form>
```

`team/MemberRow.tsx` — misma lógica (`run`, estados). Cambios:

1. Imports: `Badge`, `Button`, `Field`, `Input`, `Select` desde `@clinicalumia/ui/…`.
2. `<li>` de ambos modos: `className="flex flex-wrap items-center gap-3 px-4 py-3 [&+&]:border-line [&+&]:border-t"`.
3. Modo edición: los dos campos con `Field` + `Input`/`Select` (mismos `name` y `defaultValue`), «Guardar» `Button size="sm"`, «Cancelar» `Button variant="secondary" size="sm"`.
4. Modo lectura:

```tsx
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="truncate text-[15px] font-medium text-ink-900">{member.full_name}</p>
        <div className="flex flex-wrap items-center gap-2 text-[13px] text-ink-800">
          <span className="truncate">{member.email}</span>
          <Badge tone={specialtyName ? "success" : "neutral"}>{specialtyName ?? "Sin especialidad"}</Badge>
          {!member.is_active && (
            <Badge tone="warning" data-testid="member-status">Inactivo</Badge>
          )}
        </div>
      </div>
      <Button type="button" variant="secondary" size="sm" onClick={() => setEditing(true)}>Editar</Button>
      <Button type="button" variant="secondary" size="sm" disabled={pending} onClick={() => run(() => resendInvite(member.email))}>
        Reenviar invitación
      </Button>
      <Button
        type="button"
        variant={member.is_active ? "danger" : "secondary"}
        size="sm"
        disabled={pending}
        onClick={() => run(() => setMemberActive(member.id, !member.is_active))}
      >
        {member.is_active ? "Desactivar" : "Activar"}
      </Button>
```

5. Error: `className="w-full text-[13px] text-danger-600"`, con `role="alert"` y `data-testid="member-error"`.

- [ ] **Step 6: Login del admin**

`apps/admin/app/login/page.tsx` — misma lógica; JSX:

```tsx
    <AuthCard
      logo={<Image src={logo} alt="LUMIA · Clínica Logopedia miofuncional" width={160} priority />}
      title="Administración"
      subtitle="Acceso restringido"
    >
      <form action={formAction} className="flex flex-col gap-4">
        <Field label="Email">
          <Input type="email" name="email" required autoComplete="email" />
        </Field>
        <Field label="Contraseña" error={state?.error}>
          <Input type="password" name="password" required autoComplete="current-password" />
        </Field>
        <Button type="submit" disabled={pending} data-testid="login-submit" className="mt-2 w-full">
          {pending ? "Entrando…" : "Entrar"}
        </Button>
      </form>
    </AuthCard>
```

con imports de `AuthCard`, `Button`, `Field`, `Input`, `logo` y `Image`.

- [ ] **Step 7: Verificar**

Run: `make lint && make typecheck && make test && make test.e2e`
Expected: PASS, incluidos `admin-ui.spec.ts` (2), `admin-errors.spec.ts` (1), `invite.spec.ts` (3) y `web-visual.spec.ts` (12).

Manual: `make dev.admin`, entra con la propietaria local y compara Especialidades y Equipo con `specs/bocetos/sistema-de-diseno.png` y el menú lateral de `specs/bocetos/admin-facturas.png` (colores, tipografía, radios, menú activo en sage 800).

- [ ] **Step 8: Commits**

```bash
git add e2e/admin-ui.spec.ts "apps/admin/app/(admin)/layout.tsx" "apps/admin/app/(admin)/page.tsx" apps/admin/app/login
git commit -m "Dar al admin el menú lateral y el acceso con el diseño de LUMIA"
git add "apps/admin/app/(admin)/specialties"
git commit -m "Restilar especialidades y pedir confirmación antes de eliminar"
git add "apps/admin/app/(admin)/team"
git commit -m "Restilar el equipo con el diseño de LUMIA"
```

(El e2e de la Step 1 va en el primer commit; antes de cada commit, lint, tipos y tests en verde. Si el e2e completo solo pasa al final, haz los tres commits tras la Step 7.)

---

### Task 10: Dashboard con el aspecto de los bocetos

**Files:**
- Modify: `apps/dashboard/app/(app)/layout.tsx`, `apps/dashboard/app/(app)/page.tsx`, `apps/dashboard/app/login/LoginForm.tsx`, `apps/dashboard/app/auth/contrasena/page.tsx`, `apps/dashboard/app/login/recuperar/page.tsx`

**Interfaces:**
- Consumes: Tareas 4–8.
- Produces: se conservan `login-link-expired`, `password-form`, `password-error`, `password-submit`, `recover-email`, `recover-submit`, `recover-sent`; nuevo `logout`.

- [ ] **Step 1: Layout**

`apps/dashboard/app/(app)/layout.tsx` — cambia la consulta a `.select("full_name, is_active, role")`, conserva las comprobaciones y sustituye el `return` y los imports de `Link` por los mismos imports de la Tarea 9, Step 2, y:

```tsx
  return (
    <AppShell
      logo={<Image src={logo} alt="LUMIA · Clínica Logopedia miofuncional" width={150} priority />}
      section="Clínica"
      nav={[{ href: "/", label: "Inicio" }]}
      user={{ name: profile.full_name, detail: profile.role === "owner" ? "Propietaria" : "Empleado" }}
      logout={
        <form action={logout}>
          <Button type="submit" variant="ghost" size="sm" data-testid="logout">
            Salir
          </Button>
        </form>
      }
    >
      {children}
    </AppShell>
  );
```

Solo «Inicio» en el menú: Agenda, Pacientes, Cobros, Facturas y Consentimientos se añaden cuando existan sus pantallas (piezas 2–6), para no enlazar a páginas vacías.

- [ ] **Step 2: Inicio**

`apps/dashboard/app/(app)/page.tsx` — misma consulta; el `return`:

```tsx
    <PageHeader
      title={`${greeting}, ${profile?.full_name ?? ""}`}
      description={
        specialtyName
          ? `Tu especialidad es ${specialtyName}.`
          : "Aún no tienes una especialidad asignada."
      }
    />
```

con `import { PageHeader } from "@clinicalumia/ui/page-header";`. El e2e `invite.spec.ts` busca el encabezado con el nombre: `PageHeader` usa `<h1>`, así que sigue encontrándolo.

- [ ] **Step 3: Login, contraseña y recuperación**

Los tres con `AuthCard`, `Field`, `Input` y `Button`, misma lógica y mismos `data-testid`:

- `LoginForm.tsx`: `AuthCard` con `title="Clínica LUMIA"` y `subtitle="Acceso del equipo"`. Dentro, el aviso `login-link-expired` como `<p role="alert" data-testid="login-link-expired" className="rounded-field bg-warning-100 px-3.5 py-2.5 text-[13px] text-warning-800">…</p>`, los campos Email y Contraseña (el error de `state` en el `Field` de contraseña), el botón «Entrar» a todo el ancho y el enlace `<a href="/login/recuperar" className="text-center text-sm text-sage-800 underline underline-offset-4">¿Has olvidado tu contraseña?</a>`.
- `auth/contrasena/page.tsx`: `AuthCard` con `title="Elige tu contraseña"`; conserva el `onSubmit` con `startTransition`; campos «Contraseña» con `hint="Mínimo 12 caracteres."` y «Repite la contraseña»; el error va en un `<p role="alert" data-testid="password-error" …>` bajo los campos (no dentro de `Field`, para conservar el `data-testid`); botón `data-testid="password-submit"`.
- `login/recuperar/page.tsx`: `AuthCard` con `title="Recuperar contraseña"`; el estado enviado como `<p data-testid="recover-sent" className="text-center text-[15px] text-ink-800">…</p>` dentro del `AuthCard`; el formulario con `Field` Email (`data-testid="recover-email"` en el `Input`) y botón `data-testid="recover-submit"`.

- [ ] **Step 4: Verificar**

Run: `make lint && make typecheck && make test && make test.e2e`
Expected: PASS, todos los e2e.

Manual: `make dev.dashboard`; login, «¿Has olvidado tu contraseña?» y, tras invitar a alguien desde el admin, el enlace del buzón (`make db.mail`) → «Elige tu contraseña» → Inicio con el menú lateral.

- [ ] **Step 5: Commits**

```bash
git add "apps/dashboard/app/(app)"
git commit -m "Dar al dashboard el menú lateral y la cabecera de LUMIA"
git add apps/dashboard/app/login apps/dashboard/app/auth
git commit -m "Restilar el acceso del equipo al dashboard con el diseño de LUMIA"
```

---

## Siguiente

Al cerrar este plan: **1c · Configuración del admin y publicación** (servicios con duración, precio, IVA y señal; horarios y ausencias; datos de facturación con logo; política de cancelación; equipo con nº de colegiado; publicación en Vercel de `panel.` y `admin.`; producción; verificación en dos pasos).
