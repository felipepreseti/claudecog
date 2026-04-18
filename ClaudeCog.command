#!/usr/bin/env bash
# ClaudeCog double-click launcher for macOS.
# Drop this file on your Desktop. Double-click it. Done.
# It installs ClaudeCog (and Node.js if missing), then opens a guided setup
# inside the folder you point it at.

set -euo pipefail

cd "$(dirname "$0")" || true

ORANGE='\033[38;5;208m'
PURPLE='\033[38;5;99m'
GREEN='\033[38;5;42m'
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

clear

printf "\n"
printf "${ORANGE}   ____  _                _       ____            \n"
printf "  / ___|| |  __ _  _   _  __| |  ___/ ___|  ___    __ _ \n"
printf " | |    | | / _\` || | | |/ _\` | / _ \\___ \\ / _ \\  / _\` |\n"
printf " | |___ | || (_| || |_| | (_| ||  __/___) | (_) || (_| |\n"
printf "  \\____||_| \\__,_| \\__,_|\\__,_| \\___|____/ \\___/  \\__, |\n"
printf "                                                  |___/ ${RESET}\n\n"
printf "${DIM}  $(t "Welcome. This window installs ClaudeCog and walks you through setup." "Bem-vindo. Essa janela instala o ClaudeCog e te guia no setup.")${RESET}\n\n"

if ! command -v claudecog >/dev/null 2>&1; then
  printf "${PURPLE}>${RESET} ${BOLD}$(t "ClaudeCog is not installed yet. Installing now..." "ClaudeCog ainda nao esta instalado. Instalando agora...")${RESET}\n\n"
  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/felipepreseti/claudecog/main/install.sh)"
  export PATH="$HOME/.npm-global/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"
fi

if ! command -v claudecog >/dev/null 2>&1; then
  printf "\n${ORANGE}!${RESET} $(t "ClaudeCog was installed but is not on PATH yet." "ClaudeCog foi instalado mas ainda nao esta no PATH.")\n"
  printf "  $(t "Quit Terminal and re-open this file." "Fecha o Terminal e abre esse arquivo de novo.")\n\n"
  read -r -p "$(t "Press Enter to close..." "Aperta Enter pra fechar...")" _
  exit 0
fi

printf "\n${PURPLE}>${RESET} ${BOLD}$(t "Choose the project folder you want to analyze." "Escolhe a pasta do projeto que voce quer analisar.")${RESET}\n"
printf "${DIM}$(t "(A folder picker is opening...)" "(O seletor de pasta esta abrindo...)")${RESET}\n"

PROJECT_DIR="$(osascript -e 'try
  POSIX path of (choose folder with prompt "Choose your project folder")
on error
  return ""
end try' 2>/dev/null || echo "")"

if [ -z "$PROJECT_DIR" ]; then
  printf "\n${ORANGE}!${RESET} $(t "No folder selected. Exiting." "Nenhuma pasta selecionada. Saindo.")\n"
  read -r -p "$(t "Press Enter to close..." "Aperta Enter pra fechar...")" _
  exit 0
fi

printf "\n${GREEN}v${RESET} $(t "Project:" "Projeto:") ${BOLD}${PROJECT_DIR}${RESET}\n\n"

cd "$PROJECT_DIR"
claudecog

printf "\n${DIM}$(t "Done. You can close this window." "Pronto. Voce pode fechar essa janela.")${RESET}\n"
read -r -p "$(t "Press Enter to close..." "Aperta Enter pra fechar...")" _
