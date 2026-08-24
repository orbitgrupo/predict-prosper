# Votox

Aplicacion web de mercados de prediccion construida con Vite, React, TypeScript, Tailwind CSS, shadcn-ui y Supabase.

## Requisitos

- Node.js 18 o superior
- npm
- Proyecto Supabase configurado

## Configuracion local

1. Copia el archivo de ejemplo de variables:

```sh
cp .env.example .env
```

2. Completa las variables de Supabase en `.env`.

3. Instala dependencias:

```sh
npm install
```

4. Inicia el servidor de desarrollo:

```sh
npm run dev
```

## Scripts

- `npm run dev`: inicia el entorno local.
- `npm run build`: genera la version de produccion.
- `npm run preview`: previsualiza el build.
- `npm run lint`: ejecuta ESLint.

## Produccion

Antes de publicar, valida el build, revisa las politicas RLS de Supabase, configura SMTP, backups, dominios permitidos de autenticacion y revisa los requisitos legales aplicables a mercados de prediccion, saldos y retiros.
