# Procedimento de SSH para as VMs (obrigatório)

Restrição de política corporativa: **todo acesso remoto às VMs deve ser executado a
partir de um venv Python.** Nunca invocar `ssh`/`scp` diretamente do shell padrão da
máquina corporativa — nem mesmo de dentro de um venv. O cliente SSH é **paramiko** (Python
puro), não o binário `ssh.exe` do sistema.

## Por quê

A máquina é corporativa com política restritiva (confirmada em 2026-08-04: PowerShell em
Constrained Language Mode, sem admin, sem winget/choco, WSL2 não instalado — Docker Desktop
não pode ser instalado localmente). Isolar todo acesso remoto dentro de um venv Python,
usando um cliente SSH escrito em Python (paramiko) em vez de invocar um binário externo, é
a forma padronizada de operar sem esbarrar nessa política. Esta é uma restrição de
ambiente, não uma preferência — não simplificar removendo o venv ou voltando a usar
`ssh.exe` diretamente.

## Duas VMs, duas regras de autonomia

O projeto usa **duas instâncias Oracle Cloud Free Tier separadas**:

| VM | Propósito | Dados | Autonomia do Claude |
|---|---|---|---|
| **dev** | Ambiente de desenvolvimento/sandbox (substitui Docker local, bloqueado no notebook) | Nenhum dado real | **Executa comandos SSH livremente, sem aprovação por comando** — autorizado pelo CEO em 2026-08-04 |
| **prod** | Produção — dados financeiros reais da família | Dados reais | **Todo comando exige aprovação explícita do CEO antes da execução**, mesmo usando este wrapper — regra original, inalterada (ver Política de Autonomia em [CLAUDE.md](../../CLAUDE.md)) |

A autonomia ampliada em dev é exclusiva da VM de dev. **Nunca** se estende à VM de prod,
mesmo que o mesmo script (`ssh_vm.py`) seja usado para os dois alvos.

## DNS e portas

- O domínio/DNS único do projeto aponta **só para prod** (Caddy + TLS automático via
  Let's Encrypt, conforme ADR-001).
- A VM de **dev é acessada pelo IP público dela diretamente**, sem hostname.
- Cada VM usa uma porta SSH não-padrão (definida pelo CEO ao provisionar) e, em dev, uma
  porta adicional para preview web (ex.: acessar o frontend/backend rodando em Docker
  Compose a partir de um navegador).
- A security list/NSG da VM de dev fica restrita ao IP público do CEO — não exposta a
  `0.0.0.0/0`. Se o IP do CEO mudar, a regra precisa ser atualizada antes do acesso voltar
  a funcionar.

## Como usar

Script wrapper: [scripts/ssh-vm.ps1](../../scripts/ssh-vm.ps1) (PowerShell, chama
[scripts/ssh_vm.py](../../scripts/ssh_vm.py) por baixo).

```powershell
# Variáveis de ambiente necessárias (definir uma vez por sessão do PowerShell, nunca commitar):
$env:FINANCEIRO_DEV_VM_HOST  = "ip-publico-da-vm-dev"
$env:FINANCEIRO_DEV_VM_KEY   = "$HOME\.ssh\financeiro_dev_vm_key"     # opcional, tem default
$env:FINANCEIRO_DEV_VM_PORT  = "2222"                                 # porta custom definida no provisionamento

$env:FINANCEIRO_PROD_VM_HOST = "dominio-de-producao"
$env:FINANCEIRO_PROD_VM_KEY  = "$HOME\.ssh\financeiro_prod_vm_key"    # opcional, tem default
$env:FINANCEIRO_PROD_VM_PORT = "2222"

# Sessão interativa
.\scripts\ssh-vm.ps1 dev
.\scripts\ssh-vm.ps1 prod

# Comando remoto único
.\scripts\ssh-vm.ps1 dev "docker compose up -d"
.\scripts\ssh-vm.ps1 prod "systemctl status financeiro-api"
```

O script:
1. Cria (se não existir) um venv dedicado em `.venv-ssh/` na raiz do repo.
2. Ativa o venv e garante `paramiko` instalado (`pip install -r
   scripts/requirements-ssh.txt`).
3. Chama `python scripts/ssh_vm.py <dev|prod> [comando]`, que abre a conexão via paramiko.

`.venv-ssh/` está no `.gitignore` — nunca deve ser versionado.

## Sincronização de código com a VM de dev

A VM de dev roda um clone do repositório. O fluxo de edição é:

1. Código é editado localmente no notebook, como qualquer outro projeto.
2. Mudanças são enviadas via **`git push`** (para o GitHub, tráfego HTTPS normal — não
   passa pela restrição de rede que motivou o venv, então não precisa do wrapper SSH).
3. Antes de rodar qualquer comando remoto (testes, `docker compose up`, etc.), a VM de dev
   roda **`git pull`** para pegar o estado mais recente.
4. Nunca editar código diretamente na VM de dev — o notebook é sempre a fonte da verdade;
   a VM só executa.

## Regras

- Claude **nunca** executa `ssh`/`scp` diretamente via Bash/PowerShell fora deste wrapper,
  e o wrapper em si nunca deve voltar a invocar o binário `ssh.exe` — sempre paramiko.
- **VM de dev:** Claude pode rodar comandos livremente via `scripts/ssh-vm.ps1 dev ...`
  (ou `python scripts/ssh_vm.py dev ...` diretamente de dentro do venv), sem pedir
  aprovação a cada comando.
- **VM de prod:** qualquer comando (incluindo deploy) exige aprovação explícita do CEO
  antes da execução, mesmo usando este wrapper — ver Política de Autonomia em
  [CLAUDE.md](../../CLAUDE.md). Esta regra não muda.
- Chave privada e host nunca em texto no repo — sempre via variável de ambiente ou arquivo
  fora do controle de versão.
