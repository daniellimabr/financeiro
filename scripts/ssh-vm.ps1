# Wrapper obrigatório para acesso às VMs (dev/prod) a partir de um venv Python.
# Política corporativa: nenhum acesso remoto deve ser executado fora de um venv, e o
# cliente SSH é paramiko (Python puro) — nunca o binário ssh.exe do sistema.
# Uso: .\scripts\ssh-vm.ps1 <dev|prod> [comando remoto opcional]
#   .\scripts\ssh-vm.ps1 dev                          -> sessão interativa na VM de dev
#   .\scripts\ssh-vm.ps1 dev "docker compose up -d"    -> comando remoto na VM de dev
#   .\scripts\ssh-vm.ps1 prod "systemctl status api"   -> exige aprovação prévia do CEO

param(
    [Parameter(Mandatory = $true, Position = 0)]
    [ValidateSet("dev", "prod")]
    [string]$Target,

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

$RequirementsFile = Join-Path $PSScriptRoot "requirements-ssh.txt"
pip install --quiet -r $RequirementsFile

$SshVmScript = Join-Path $PSScriptRoot "ssh_vm.py"

if ($RemoteCommand.Count -gt 0) {
    python $SshVmScript $Target $($RemoteCommand -join " ")
} else {
    python $SshVmScript $Target
}

exit $LASTEXITCODE
