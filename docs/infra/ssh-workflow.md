# Procedimento de SSH para a VM (obrigatório)

Restrição de política corporativa: **todo comando SSH para a VM deve ser executado a partir de um venv Python.** Nunca rodar `ssh` diretamente do shell padrão da máquina corporativa.

## Por quê

A máquina é corporativa com política restritiva de rede/segurança. Isolar o acesso SSH dentro de um venv Python é a forma padronizada de contornar essa restrição sem violar a política. Esta é uma restrição de ambiente, não uma preferência — não simplificar removendo o venv.

## Como usar

Script wrapper: [scripts/ssh-vm.ps1](../../scripts/ssh-vm.ps1)

```powershell
# Variáveis de ambiente necessárias (definir uma vez na sessão do PowerShell, nunca commitar):
$env:FINANCEIRO_VM_HOST = "usuario@ip-da-vm"
$env:FINANCEIRO_VM_KEY  = "$HOME\.ssh\financeiro_vm_key"   # opcional, tem default

# Sessão interativa
.\scripts\ssh-vm.ps1

# Comando remoto único
.\scripts\ssh-vm.ps1 "systemctl status financeiro-api"
```

O script:
1. Cria (se não existir) um venv dedicado em `.venv-ssh/` na raiz do repo.
2. Ativa o venv.
3. Executa o `ssh` de dentro do venv ativado.

`.venv-ssh/` está no `.gitignore` — nunca deve ser versionado.

## Regras

- Claude Code **nunca** executa `ssh` diretamente via Bash/PowerShell fora deste script.
- Qualquer comando na VM (incluindo deploy) exige aprovação explícita do CEO antes da execução, mesmo usando este wrapper — ver Política de Autonomia em [CLAUDE.md](../../CLAUDE.md).
- Chave privada e host nunca em texto no repo — sempre via variável de ambiente ou arquivo fora do controle de versão.
