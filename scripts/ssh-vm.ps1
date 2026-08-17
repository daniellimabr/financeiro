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

# "Continue" (não "Stop"): comandos nativos abaixo (pip, python/ssh_vm.py) podem
# escrever em stderr sem terem falhado de verdade — o remoto roda `git pull`,
# cujo progresso vai sempre para stderr por convenção do git. Sob "Stop",
# PowerShell 5.1 trata qualquer escrita em stderr de um comando nativo como
# erro terminante mesmo com exit code 0, derrubando o script antes do comando
# remoto real rodar. Falha de verdade continua detectada via `exit $LASTEXITCODE`
# no fim do script, que já propaga o código real do processo remoto.
$ErrorActionPreference = "Continue"
$RepoRoot = Split-Path -Parent $PSScriptRoot
$VenvPath = Join-Path $RepoRoot ".venv-ssh"

# Config local opcional (fora do controle de versão) com HOST/PORT das VMs,
# para não precisar re-exportar $env:FINANCEIRO_*_VM_* a cada sessão/chamada.
# Ver docs/infra/ssh-workflow.md.
$LocalConfig = Join-Path $PSScriptRoot "vm-config.local.ps1"
if (Test-Path $LocalConfig) {
    & $LocalConfig
}

if (-not (Test-Path $VenvPath)) {
    Write-Host "Criando venv dedicado para operações SSH em $VenvPath ..."
    python -m venv $VenvPath
}

$ActivateScript = Join-Path $VenvPath "Scripts\Activate.ps1"
& $ActivateScript

$RequirementsFile = Join-Path $PSScriptRoot "requirements-ssh.txt"
# --disable-pip-version-check evita que o aviso "new release available" do pip
# (escrito em stderr) vire um NativeCommandError fatal sob $ErrorActionPreference
# = "Stop" (PowerShell 5.1 trata qualquer escrita em stderr de um comando nativo
# como erro terminante nesse modo, mesmo com exit code 0).
pip install --quiet --disable-pip-version-check -r $RequirementsFile

$SshVmScript = Join-Path $PSScriptRoot "ssh_vm.py"

if ($RemoteCommand.Count -gt 0) {
    # Passa o comando via variável de ambiente, não como argumento de CLI: quando
    # invocado sem aspas (como abaixo), o PowerShell re-tokeniza e derruba aspas
    # internas do comando remoto (ex.: SQL com -c "SELECT ..."), quebrando-o em
    # múltiplos argumentos e perdendo as aspas antes mesmo de chegar no Python.
    # Variável de ambiente não sofre esse re-parsing — preserva o texto exato.
    $env:SSH_VM_REMOTE_COMMAND = $RemoteCommand -join " "
    python $SshVmScript $Target
    Remove-Item Env:\SSH_VM_REMOTE_COMMAND
} else {
    python $SshVmScript $Target
}

exit $LASTEXITCODE
