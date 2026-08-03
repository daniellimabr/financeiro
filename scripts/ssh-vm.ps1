# Wrapper obrigatório para SSH na VM Oracle Cloud a partir de um venv Python.
# Política corporativa: nenhum SSH deve ser executado fora de um venv.
# Uso: .\scripts\ssh-vm.ps1 [comando remoto opcional]
#   .\scripts\ssh-vm.ps1                  -> abre sessão interativa
#   .\scripts\ssh-vm.ps1 "systemctl status financeiro-api"

param(
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$RemoteCommand
)

$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path -Parent $PSScriptRoot
$VenvPath = Join-Path $RepoRoot ".venv-ssh"

if (-not (Test-Path $VenvPath)) {
    Write-Host "Criando venv dedicado para operações SSH em $VenvPath ..."
    python -m venv $VenvPath
}

$ActivateScript = Join-Path $VenvPath "Scripts\Activate.ps1"
& $ActivateScript

if (-not (Test-Path "env:FINANCEIRO_VM_HOST")) {
    Write-Error "Defina a variável de ambiente FINANCEIRO_VM_HOST (ex.: usuario@ip-da-vm) antes de usar este script."
    exit 1
}

$VmHost = $env:FINANCEIRO_VM_HOST
$KeyPath = if ($env:FINANCEIRO_VM_KEY) { $env:FINANCEIRO_VM_KEY } else { "$HOME\.ssh\financeiro_vm_key" }

if ($RemoteCommand.Count -gt 0) {
    ssh -i $KeyPath $VmHost -- $($RemoteCommand -join " ")
} else {
    ssh -i $KeyPath $VmHost
}
