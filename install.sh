#!/usr/bin/env bash
# ClaudeCog one-line installer (macOS / Linux)
# Usage:  curl -fsSL https://claudecog.sh | bash
#         curl -fsSL https://raw.githubusercontent.com/felipepreseti/claudecog/main/install.sh | bash

set -euo pipefail

ORANGE='\033[38;5;208m'
PURPLE='\033[38;5;99m'
GREEN='\033[38;5;42m'
YELLOW='\033[38;5;220m'
RED='\033[38;5;203m'
DIM='\033[2m'
BOLD='\033[1m'
RESET='\033[0m'

LANG_PT=0
case "${CLAUDECOG_LANG:-${LANG:-}}" in
  pt*|PT*) LANG_PT=1 ;;
esac

t() {
  if [ "$LANG_PT" = "1" ]; then echo -e "$2"; else echo -e "$1"; fi
}

banner() {
  printf "\n"
  printf "${ORANGE}   ____  _                _       ____            \n"
  printf "  / ___|| |  __ _  _   _  __| |  ___/ ___|  ___    __ _ \n"
  printf " | |    | | / _\` || | | |/ _\` | / _ \\___ \\ / _ \\  / _\` |\n"
  printf " | |___ | || (_| || |_| | (_| ||  __/___) | (_) || (_| |\n"
  printf "  \\____||_| \\__,_| \\__,_|\\__,_| \\___|____/ \\___/  \\__, |\n"
  printf "                                                  |___/ ${RESET}\n"
  printf "${DIM}  $(t "a cognitive layer for code  -  powered by Claude" "uma camada cognitiva para codigo  -  feito com Claude")${RESET}\n\n"
}

step() {
  printf "${PURPLE}>${RESET} ${BOLD}%s${RESET}\n" "$1"
}

ok() {
  printf "${GREEN}v${RESET} %s\n" "$1"
}

warn() {
  printf "${YELLOW}!${RESET} %s\n" "$1"
}

fail() {
  printf "${RED}x${RESET} %s\n" "$1" >&2
}

ask_yes() {
  local q="$1"
  if [ ! -t 0 ]; then
    return 0
  fi
  printf "${PURPLE}?${RESET} %s ${DIM}[Y/n]${RESET} " "$q"
  local ans
  read -r ans </dev/tty || true
  case "$ans" in
    n|N|no|NO) return 1 ;;
    *) return 0 ;;
  esac
}

detect_os() {
  case "$(uname -s)" in
    Darwin) echo "mac" ;;
    Linux) echo "linux" ;;
    *) echo "other" ;;
  esac
}

node_major() {
  if ! command -v node >/dev/null 2>&1; then
    echo "0"
    return
  fi
  node -p "process.versions.node.split('.')[0]" 2>/dev/null || echo "0"
}

install_node_mac() {
  step "$(t "Installing Node.js 20 via Homebrew" "Instalando Node.js 20 via Homebrew")"
  if ! command -v brew >/dev/null 2>&1; then
    warn "$(t "Homebrew not found. Installing Homebrew first..." "Homebrew nao encontrado. Instalando o Homebrew primeiro...")"
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
    if [ -d /opt/homebrew/bin ]; then
      eval "$(/opt/homebrew/bin/brew shellenv)"
    elif [ -d /usr/local/bin ]; then
      eval "$(/usr/local/bin/brew shellenv)"
    fi
  fi
  brew install node@20
  brew link --overwrite --force node@20 || true
}

install_node_linux() {
  step "$(t "Installing Node.js 20 via nvm" "Instalando Node.js 20 via nvm")"
  if [ -z "${NVM_DIR:-}" ]; then
    export NVM_DIR="$HOME/.nvm"
  fi
  if [ ! -s "$NVM_DIR/nvm.sh" ]; then
    curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
  fi
  # shellcheck disable=SC1091
  . "$NVM_DIR/nvm.sh"
  nvm install 20
  nvm use 20
  nvm alias default 20
}

ensure_node() {
  local major
  major="$(node_major)"
  if [ "$major" -ge 18 ]; then
    ok "$(t "Node.js found:" "Node.js encontrado:") $(node -v)"
    return
  fi
  warn "$(t "Node.js 18+ is required and was not found." "Node.js 18+ e necessario e nao foi encontrado.")"
  if ! ask_yes "$(t "Install Node.js 20 now?" "Instalar Node.js 20 agora?")"; then
    fail "$(t "Cannot continue without Node.js. Install it from https://nodejs.org and re-run." "Nao da pra continuar sem Node.js. Instala em https://nodejs.org e roda de novo.")"
    exit 1
  fi
  case "$(detect_os)" in
    mac) install_node_mac ;;
    linux) install_node_linux ;;
    *)
      fail "$(t "Unsupported OS. Install Node.js manually: https://nodejs.org" "SO nao suportado. Instala o Node.js manualmente: https://nodejs.org")"
      exit 1
      ;;
  esac
  ok "$(t "Node.js installed:" "Node.js instalado:") $(node -v)"
}

install_claudecog() {
  step "$(t "Installing ClaudeCog from npm" "Instalando o ClaudeCog pelo npm")"
  local prefix
  prefix="$(npm config get prefix 2>/dev/null || echo "")"
  if [ -n "$prefix" ] && [ ! -w "$prefix/lib" ] && [ ! -w "$prefix" ]; then
    warn "$(t "npm global prefix is not writable. Switching to a user-owned prefix at ~/.npm-global" "O prefix global do npm nao e gravavel. Trocando pra um prefix do usuario em ~/.npm-global")"
    mkdir -p "$HOME/.npm-global"
    npm config set prefix "$HOME/.npm-global"
    case ":$PATH:" in
      *":$HOME/.npm-global/bin:"*) ;;
      *)
        export PATH="$HOME/.npm-global/bin:$PATH"
        for rc in "$HOME/.zshrc" "$HOME/.bashrc" "$HOME/.profile"; do
          if [ -f "$rc" ] && ! grep -q ".npm-global/bin" "$rc"; then
            printf '\nexport PATH="$HOME/.npm-global/bin:$PATH"\n' >> "$rc"
          fi
        done
        ;;
    esac
  fi
  npm install -g claudecog
  ok "$(t "ClaudeCog installed." "ClaudeCog instalado.")"
}

post_install() {
  printf "\n"
  printf "${GREEN}${BOLD}$(t "All set." "Tudo pronto.")${RESET}\n\n"
  printf "${BOLD}$(t "Next steps:" "Proximos passos:")${RESET}\n"
  printf "  ${PURPLE}1.${RESET} cd $(t "your-project" "seu-projeto")\n"
  printf "  ${PURPLE}2.${RESET} ${BOLD}claudecog${RESET}\n\n"
  printf "${DIM}$(t "First run opens a 30-second wizard." "A primeira execucao abre um wizard de 30 segundos.")${RESET}\n"
  printf "${DIM}$(t "Docs:" "Docs:") https://github.com/felipepreseti/claudecog${RESET}\n\n"
}

main() {
  banner
  step "$(t "Checking your system" "Verificando seu sistema")"
  ensure_node
  install_claudecog
  post_install
}

main "$@"
