# ClaudeCog

> Uma camada cognitiva pra código. Feito com Claude.

**Português** · [English](README.md) · [Español](README.es.md)

[![npm](https://img.shields.io/npm/v/claudecog?color=7B68EE&label=npm)](https://www.npmjs.com/package/claudecog)
[![License](https://img.shields.io/badge/License-MIT-FF6B35.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D18-10B981.svg)](package.json)

ClaudeCog lê seu repositório como um sistema, não como uma pilha de arquivos. Te dá três coisas:

- um mapa de como as peças se encaixam
- uma explicação de engenheiro sênior sobre qualquer arquivo
- uma lista priorizada de riscos reais (sem coisinha de lint)

## Começo rápido

```bash
cd seu-projeto
npx claudecog map
```

Na primeira vez abre um wizard de 30 segundos. Ele detecta o Claude Code automaticamente se você tiver instalado, senão pede uma API key da Anthropic.

## Comandos

### `claudecog map`

Constrói um modelo do sistema e abre um grafo interativo no seu navegador. Você recebe um resumo de um parágrafo do que o sistema faz, 5 a 12 módulos coloridos por camada, e as relações entre eles.

```bash
claudecog map
```

Útil pra onboarding, planejar refactor, ou responder "afinal, o que esse repositório faz?".

### `claudecog explain <arquivo>`

Um engenheiro sênior pareando com você por dez minutos em um arquivo. A saída é Markdown renderizado com cinco seções: pra que serve o arquivo, modelo mental, walkthrough, pegadinhas e como melhorar.

```bash
claudecog explain src/auth/middleware.ts
```

Roda sem arquivo pra abrir um seletor interativo dos mais importantes.

### `claudecog risks`

Revisão focada em riscos. Ignora bobagem de lint. Procura o que dói em produção: brechas de segurança, problemas de confiabilidade, acoplamento silencioso, riscos de dependência, armadilhas de performance, dívida arquitetural. Cada risco tem um "por quê" claro e uma sugestão concreta.

```bash
claudecog risks
```

## Instalação

Não precisa instalar nada. `npx claudecog` funciona em qualquer máquina com Node 18+.

Se você usa direto, instala global:

```bash
npm install -g claudecog
claudecog map
# o alias curto também funciona
cog map
```

## Idiomas

A CLI está disponível em três idiomas: Português (Brasil), English, Español. Detecta automaticamente pela variável `$LANG`. Pra forçar um idioma:

```bash
claudecog map --lang pt
# ou define de forma permanente no wizard
claudecog setup --reset
```

Você também pode setar `CLAUDECOG_LANG=pt` no seu shell.

## Backends

O ClaudeCog fala com o Claude de duas formas:

| Backend | Quando escolher |
| --- | --- |
| Claude Code CLI | Você já tem `claude` instalado. Detectado automaticamente. Sem custo extra na sua assinatura. |
| API da Anthropic | Pago por uso. Define `ANTHROPIC_API_KEY` ou cola no wizard. |

Config fica em `~/.claudecog/config.json` (`0600`). Cache fica em `.claudecog/` dentro do projeto (já no gitignore).

## Como funciona

```
seu repositório
   │
   ▼
scanner       lê os arquivos, respeita .gitignore
   │
   ▼
Claude        modela o sistema, devolve JSON estruturado
   │
   ▼
renderers     grafo D3 interativo, Markdown no terminal, boxes de risco
```

Pra ignorar arquivos, adiciona um `.claudecogignore` no repositório. Mesma sintaxe do `.gitignore`.

Pra forçar uma análise nova, usa `--refresh` em qualquer comando.

## Contribuindo

O código é pequeno (~3k linhas) e legível. A forma mais rápida de aprender é clonar e rodar o próprio `claudecog explain` nele.

```bash
git clone https://github.com/felipepreseti/claudecog
cd claudecog
npm install
npm run build
node dist/cli.js map
```

PRs bem vindas pra novos comandos, novos renderers, melhorias nos prompts, e novos idiomas.

## Licença

MIT
