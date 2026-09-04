# Espelha exatamente os steps do CI (.github/workflows/ci.yml) para rodar
# localmente antes de um push — objetivo: nunca descobrir uma falha de
# lint/format/teste só depois que o CI já rodou (achado real da Sprint 37:
# `ruff format --check` esquecido, só `ruff check` rodado manualmente, CI
# quebrou e custou um ciclo inteiro de espera). `pre-commit` já cobre
# ruff/ruff-format/eslint/detect-secrets a cada commit; este script cobre o
# restante (pytest, tsc, vitest) e serve de checagem única antes do push.
#
# Uso: .\scripts\check-all.ps1

# "Continue" (nao "Stop"): comandos nativos (npx/vitest/pytest) podem escrever
# em stderr sem terem falhado de verdade - sob "Stop", PowerShell 5.1 trata
# qualquer escrita em stderr de um comando nativo como erro terminante mesmo
# com exit code 0 (mesmo gotcha documentado em scripts/ssh-vm.ps1). Falha real
# continua detectada via $LASTEXITCODE em Invoke-Step.
$ErrorActionPreference = "Continue"
$RepoRoot = Split-Path -Parent $PSScriptRoot
$Failed = $false

function Invoke-Step {
    param([string]$Name, [scriptblock]$Block)
    Write-Host "== $Name ==" -ForegroundColor Cyan
    & $Block
    if ($LASTEXITCODE -ne 0) {
        Write-Host "FALHOU: $Name" -ForegroundColor Red
        $script:Failed = $true
    }
}

Push-Location (Join-Path $RepoRoot "backend")
try {
    Invoke-Step "backend: ruff check" { .\.venv\Scripts\python.exe -m ruff check . }
    Invoke-Step "backend: ruff format --check" { .\.venv\Scripts\python.exe -m ruff format --check . }
    Invoke-Step "backend: pytest" { .\.venv\Scripts\python.exe -m pytest }
} finally {
    Pop-Location
}

Push-Location (Join-Path $RepoRoot "frontend")
try {
    Invoke-Step "frontend: eslint" { npx eslint . }
    Invoke-Step "frontend: prettier --check" { npx prettier --check . }
    Invoke-Step "frontend: tsc -b" { npx tsc -b }
    Invoke-Step "frontend: vitest" { npx vitest run }
} finally {
    Pop-Location
}

if ($Failed) {
    Write-Host "`nUm ou mais steps falharam - corrigir antes de push (mesmos steps do CI)." -ForegroundColor Red
    exit 1
}

Write-Host "`nTudo verde - equivalente ao que o CI vai rodar." -ForegroundColor Green
exit 0
