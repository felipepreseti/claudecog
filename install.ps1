# ClaudeCog one-line installer (Windows / PowerShell)
# Usage:  iwr -useb https://raw.githubusercontent.com/felipepreseti/claudecog/main/install.ps1 | iex

$ErrorActionPreference = 'Stop'

$IsPt = $false
$envLang = if ($env:CLAUDECOG_LANG) { $env:CLAUDECOG_LANG } else { (Get-Culture).Name }
if ($envLang -match '^pt') { $IsPt = $true }

function T($en, $pt) {
  if ($IsPt) { return $pt } else { return $en }
}

function Banner {
  Write-Host ""
  Write-Host "   ____  _                _       ____            "          -ForegroundColor DarkYellow
  Write-Host "  / ___|| |  __ _  _   _  __| |  ___/ ___|  ___    __ _ "    -ForegroundColor DarkYellow
  Write-Host " | |    | | / _`` || | | |/ _`` | / _ \___ \ / _ \  / _`` |"  -ForegroundColor DarkYellow
  Write-Host " | |___ | || (_| || |_| | (_| ||  __/___) | (_) || (_| |"    -ForegroundColor DarkYellow
  Write-Host "  \____||_| \__,_| \__,_|\__,_| \___|____/ \___/  \__, |"    -ForegroundColor DarkYellow
  Write-Host "                                                  |___/ "    -ForegroundColor DarkYellow
  Write-Host ("  " + (T "read any codebase like a senior engineer would" "le qualquer codebase como um senior leria")) -ForegroundColor DarkGray
  Write-Host ""
}

function Step($msg)  { Write-Host "> " -NoNewline -ForegroundColor Magenta; Write-Host $msg -ForegroundColor White }
function Ok($msg)    { Write-Host "v " -NoNewline -ForegroundColor Green;   Write-Host $msg }
function Warn($msg)  { Write-Host "! " -NoNewline -ForegroundColor Yellow;  Write-Host $msg }
function Fail($msg)  { Write-Host "x " -NoNewline -ForegroundColor Red;     Write-Host $msg }

function NodeMajor {
  try {
    $v = & node -v 2>$null
    if ($LASTEXITCODE -ne 0 -or -not $v) { return 0 }
    return [int]($v.TrimStart('v').Split('.')[0])
  } catch {
    return 0
  }
}

function Install-Node {
  Step (T "Installing Node.js LTS via winget" "Instalando Node.js LTS via winget")
  if (-not (Get-Command winget -ErrorAction SilentlyContinue)) {
    Fail (T "winget not available. Install Node.js manually from https://nodejs.org and re-run." "winget nao disponivel. Instala o Node.js manualmente em https://nodejs.org e roda de novo.")
    exit 1
  }
  winget install --id OpenJS.NodeJS.LTS --silent --accept-source-agreements --accept-package-agreements
  $env:Path = [System.Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [System.Environment]::GetEnvironmentVariable('Path','User')
}

function Ensure-Node {
  $major = NodeMajor
  if ($major -ge 18) {
    Ok ((T "Node.js found:" "Node.js encontrado:") + " " + (& node -v))
    return
  }
  Warn (T "Node.js 18+ is required and was not found." "Node.js 18+ e necessario e nao foi encontrado.")
  Install-Node
  $major = NodeMajor
  if ($major -lt 18) {
    Fail (T "Node.js install did not complete. Open a new PowerShell window and re-run the installer." "Instalacao do Node.js nao terminou. Abre uma nova janela do PowerShell e roda o instalador de novo.")
    exit 1
  }
  Ok ((T "Node.js installed:" "Node.js instalado:") + " " + (& node -v))
}

function Install-ClaudeCog {
  Step (T "Installing ClaudeCog from npm" "Instalando o ClaudeCog pelo npm")
  npm install -g claudecog
  if ($LASTEXITCODE -ne 0) {
    Fail (T "npm install failed. Try opening PowerShell as Administrator and re-running." "npm install falhou. Tenta abrir o PowerShell como Administrador e rodar de novo.")
    exit 1
  }
  Ok (T "ClaudeCog installed." "ClaudeCog instalado.")
}

function Post-Install {
  Write-Host ""
  Write-Host (T "All set." "Tudo pronto.") -ForegroundColor Green
  Write-Host ""
  Write-Host (T "Next steps:" "Proximos passos:")
  Write-Host ("  1. cd " + (T "your-project" "seu-projeto"))
  Write-Host "  2. claudecog"
  Write-Host ""
  Write-Host (T "First run opens a 30-second wizard." "A primeira execucao abre um wizard de 30 segundos.") -ForegroundColor DarkGray
  Write-Host (T "Docs: https://github.com/felipepreseti/claudecog" "Docs: https://github.com/felipepreseti/claudecog") -ForegroundColor DarkGray
  Write-Host ""
}

Banner
Step (T "Checking your system" "Verificando seu sistema")
Ensure-Node
Install-ClaudeCog
Post-Install
