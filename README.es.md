# ClaudeCog

> Una capa cognitiva para tu código. Hecho con Claude.

[Português](README.pt-BR.md) · [English](README.md) · **Español**

[![npm](https://img.shields.io/npm/v/claudecog?color=7B68EE&label=npm)](https://www.npmjs.com/package/claudecog)
[![License](https://img.shields.io/badge/License-MIT-FF6B35.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D18-10B981.svg)](package.json)

ClaudeCog lee tu repositorio como un sistema, no como un montón de archivos. Te da tres cosas:

- un mapa de cómo encajan las piezas
- una explicación de ingeniero senior sobre cualquier archivo
- una lista priorizada de riesgos reales (sin detalles de lint)

## Inicio rápido

```bash
cd tu-proyecto
npx claudecog map
```

La primera vez abre un asistente de 30 segundos. Detecta Claude Code automáticamente si lo tienes instalado, si no pide una API key de Anthropic.

## Comandos

### `claudecog map`

Construye un modelo del sistema y abre un grafo interactivo en tu navegador. Recibes un resumen de un párrafo de lo que hace el sistema, 5 a 12 módulos coloreados por capa, y las relaciones entre ellos.

```bash
claudecog map
```

Útil para onboarding, planificar refactor, o responder "¿qué hace este repositorio en realidad?".

### `claudecog explain <archivo>`

Un ingeniero senior trabajando contigo durante diez minutos en un archivo. La salida es Markdown renderizado con cinco secciones: para qué sirve el archivo, modelo mental, walkthrough, trampas y cómo mejorarlo.

```bash
claudecog explain src/auth/middleware.ts
```

Ejecútalo sin archivo para abrir un selector interactivo de los más importantes.

### `claudecog risks`

Revisión enfocada en riesgos. Ignora detalles de lint. Busca lo que duele en producción: huecos de seguridad, problemas de fiabilidad, acoplamiento silencioso, riesgos de dependencias, trampas de rendimiento, deuda arquitectónica. Cada riesgo tiene un "por qué" claro y una solución concreta.

```bash
claudecog risks
```

## Instalación

No necesitas instalar nada. `npx claudecog` funciona en cualquier máquina con Node 18+.

Si lo usas a menudo, instálalo global:

```bash
npm install -g claudecog
claudecog map
# el alias corto también funciona
cog map
```

## Idiomas

La CLI está disponible en tres idiomas: Português (Brasil), English, Español. Detecta automáticamente por la variable `$LANG`. Para forzar un idioma:

```bash
claudecog map --lang es
# o ponlo permanente en el asistente
claudecog setup --reset
```

También puedes configurar `CLAUDECOG_LANG=es` en tu shell.

## Backends

ClaudeCog habla con Claude de dos formas:

| Backend | Cuándo elegirlo |
| --- | --- |
| Claude Code CLI | Ya tienes `claude` instalado. Detectado automáticamente. Sin coste extra en tu suscripción. |
| API de Anthropic | Pago por uso. Define `ANTHROPIC_API_KEY` o pégalo en el asistente. |

Config vive en `~/.claudecog/config.json` (`0600`). Caché vive en `.claudecog/` dentro del proyecto (ya en gitignore).

## Cómo funciona

```
tu repositorio
   │
   ▼
scanner       lee los archivos, respeta .gitignore
   │
   ▼
Claude        modela el sistema, devuelve JSON estructurado
   │
   ▼
renderers     grafo D3 interactivo, Markdown en terminal, cajas de riesgo
```

Para ignorar archivos, agrega un `.claudecogignore` al repositorio. Misma sintaxis que `.gitignore`.

Para forzar un análisis nuevo, usa `--refresh` en cualquier comando.

## Contribuyendo

El código es pequeño (~3k líneas) y legible. La forma más rápida de aprenderlo es clonarlo y ejecutar el propio `claudecog explain` sobre él.

```bash
git clone https://github.com/felipepreseti/claudecog
cd claudecog
npm install
npm run build
node dist/cli.js map
```

PRs bienvenidas para nuevos comandos, nuevos renderers, mejoras en los prompts, y nuevos idiomas.

## Licencia

MIT
