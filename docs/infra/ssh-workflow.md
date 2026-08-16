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

**Config de HOST/PORT (uma vez só, não por sessão):** copie
[scripts/vm-config.local.ps1.example](../../scripts/vm-config.local.ps1.example) para
`scripts/vm-config.local.ps1` e preencha os valores reais. Esse arquivo está no
`.gitignore` e é carregado automaticamente pelo `ssh-vm.ps1` a cada execução — não é
preciso re-exportar `$env:FINANCEIRO_*_VM_*` a cada sessão do PowerShell nem repetir
host/porta a cada deploy. A chave privada já usa um path default
(`~/.ssh/financeiro_<alvo>_vm_key`); uma vez presente no disco, também não precisa ser
redigitada.

```powershell
# Sessão interativa
.\scripts\ssh-vm.ps1 dev
.\scripts\ssh-vm.ps1 prod

# Comando remoto único
.\scripts\ssh-vm.ps1 dev "docker compose up -d"
.\scripts\ssh-vm.ps1 prod "systemctl status financeiro-api"
```

O script:
1. Carrega `scripts/vm-config.local.ps1` se existir (host/porta).
2. Cria (se não existir) um venv dedicado em `.venv-ssh/` na raiz do repo.
3. Ativa o venv e garante `paramiko` instalado (`pip install -r
   scripts/requirements-ssh.txt`).
4. Chama `python scripts/ssh_vm.py <dev|prod> [comando]`, que abre a conexão via paramiko.

`.venv-ssh/` e `scripts/vm-config.local.ps1` estão no `.gitignore` — nunca devem ser
versionados.

## Sincronização de código com a VM de dev

A VM de dev roda um clone do repositório. O fluxo de edição é:

1. Código é editado localmente no notebook, como qualquer outro projeto.
2. Mudanças são enviadas via **`git push`** (para o GitHub, tráfego HTTPS normal — não
   passa pela restrição de rede que motivou o venv, então não precisa do wrapper SSH).
3. Antes de rodar qualquer comando remoto (testes, `docker compose up`, etc.), a VM de dev
   roda **`git pull`** para pegar o estado mais recente.
4. Nunca editar código diretamente na VM de dev — o notebook é sempre a fonte da verdade;
   a VM só executa.
5. `docker compose pull` na VM só baixa a imagem que já está publicada no GHCR — o job
   `build-and-push` do CI publica em `:latest` só depois que `backend`/`frontend` passam,
   o que leva alguns minutos. Fazer o pull logo após o `push` (antes do CI terminar) traz
   silenciosamente a imagem **anterior**, sem nenhum erro — parece um deploy bem-sucedido,
   mas não é o código novo (achado real na Sprint 11: CEO viu a versão antiga mesmo depois
   do "deploy"). **Sempre confirmar `conclusion: success` do workflow do GitHub Actions pro
   commit exato** (via API, `GET /repos/daniellimabr/financeiro/actions/runs?branch=main` e
   comparar `head_sha`) antes de rodar `docker compose pull` — não confiar em comparar o
   timestamp de criação da imagem (`docker inspect --format='{{.Created}}'`) contra o
   horário do commit local; há discrepância de relógio entre esta máquina e o servidor do
   GitHub grande o suficiente pra invalidar essa checagem.

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

## Autenticação do `git push`/`git pull` para o GitHub (diferente do SSH das VMs)

O remote `origin` usa **HTTPS**, não SSH — esse tráfego não passa pela restrição de rede que
motivou o wrapper paramiko (ver seção acima), então não precisa dele.

A autenticação é feita pelo **Git Credential Manager** (`credential.helper=manager`,
configuração global do Windows) usando um **fine-grained Personal Access Token (PAT)**
escopado só ao repo `daniellimabr/financeiro` (permissão `Contents: Read and write`,
validade de até 1 ano). O GCM está configurado para nunca cair no fluxo OAuth/browser para
`github.com`:

```
git config --global credential.https://github.com.gitHubAuthModes pat
```

Com isso, uma vez que o PAT é registrado (ação manual do CEO, feita uma única vez no
terminal dele — nunca via comando montado pelo Claude, já que o token não pode aparecer em
texto em nenhum comando), o GCM cacheia a credencial no Windows Credential Manager e todo
`git push`/`git pull` subsequente roda sem prompt, inclusive os executados pelo Claude.

Para registrar o PAT, usar o subcomando do git (não o binário standalone — este último não
está no PATH do PowerShell, só no Git Bash):
```
git credential-manager github login --pat SEU_TOKEN
```

**Importante — o remote tem o usuário fixado na URL:**
```
origin  https://daniellimabr@github.com/daniellimabr/financeiro.git
```
Isso é necessário porque o Windows Credential Manager deste notebook guarda **múltiplas
identidades do GitHub** (`daniellimabr`, e outras de uso pessoal/QA não relacionadas a este
projeto). Sem o usuário fixo na URL, o GCM fica ambíguo sobre qual credencial usar num
`git push`; na prática ele escolhia uma sem permissão de escrita neste repo, levava 403 do
GitHub e iniciava um novo login via browser para tentar resolver — foi exatamente o que
aconteceu em 2026-08-04 mesmo com `gitHubAuthModes=pat` configurado (fetch/dry-run
funcionavam, só o push real disparava o browser). Fixar `daniellimabr@` na URL do remote
eliminou a ambiguidade. **Não remover esse usuário da URL do remote.**

## Login da VM de dev no GitHub Container Registry (GHCR)

Desde a Sprint 3, o CI builda e publica as imagens `api`/`frontend` no GHCR
(`ghcr.io/daniellimabr/financeiro-{api,frontend}:latest`) — a VM só faz
`docker compose pull`, não builda mais nada localmente (ver
[OVERVIEW.md](../architecture/OVERVIEW.md)). Como o pacote é privado, a VM
precisa estar autenticada.

**Feito uma única vez, manualmente pelo CEO, direto na VM** — nunca via
comando montado pelo Claude, mesmo princípio do PAT do git push acima:

1. Gerar um **fine-grained Personal Access Token** em
   `github.com/settings/personal-access-tokens/new`, escopado só ao repo
   `daniellimabr/financeiro`, permissão `Packages: Read-only`.
2. Sessão interativa na VM: `.\scripts\ssh-vm.ps1 dev`
3. Na VM: `echo SEU_TOKEN | docker login ghcr.io -u daniellimabr --password-stdin`

O Docker guarda a credencial em `~/.docker/config.json` na própria VM — não
precisa repetir a cada deploy. Se o PAT expirar, repetir o passo 3 com um
token novo.

**Se o prompt de browser voltar a aparecer:**
1. Confirmar que o remote ainda tem o usuário fixado: `git remote -v` deve mostrar
   `https://daniellimabr@github.com/...`.
2. Confirmar que a config de auth mode ainda está ativa: `git config --get
   credential.https://github.com.gitHubAuthModes` (deve retornar `pat`).
3. Se ambos estiverem ok mesmo assim, o PAT provavelmente expirou — o CEO precisa gerar um
   novo em `github.com/settings/personal-access-tokens/new` (mesmo escopo) e rodar
   `git credential-manager github login --pat <novo-token>` no terminal dele.
