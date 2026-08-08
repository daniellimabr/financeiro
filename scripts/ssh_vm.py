"""Cliente SSH (paramiko) para as VMs do projeto — ver docs/infra/ssh-workflow.md.

Nunca invoca o binário ssh.exe do sistema; roda inteiramente em Python dentro do
venv dedicado (.venv-ssh/), conforme a restrição de rede do notebook corporativo.

Uso:
    python ssh_vm.py <dev|prod> [comando remoto...]

Sem comando remoto, abre uma sessão interativa simples (linha a linha).
Com comando remoto, executa e propaga o exit code.

Variáveis de ambiente (por alvo, ex.: dev -> FINANCEIRO_DEV_VM_*):
    FINANCEIRO_<ALVO>_VM_HOST   (obrigatória)
    FINANCEIRO_<ALVO>_VM_KEY    (opcional, default ~/.ssh/financeiro_<alvo>_vm_key)
    FINANCEIRO_<ALVO>_VM_PORT   (opcional, default 22)
    FINANCEIRO_<ALVO>_VM_USER   (opcional, default "ubuntu")
"""

from __future__ import annotations

import os
import sys
import threading
from pathlib import Path

import paramiko

TARGETS = ("dev", "prod")


def _env(target: str, suffix: str, default: str | None = None) -> str | None:
    return os.environ.get(f"FINANCEIRO_{target.upper()}_VM_{suffix}", default)


def _connect(target: str) -> paramiko.SSHClient:
    host = _env(target, "HOST")
    if not host:
        print(
            f"Defina FINANCEIRO_{target.upper()}_VM_HOST antes de usar este script.",
            file=sys.stderr,
        )
        sys.exit(1)

    port = int(_env(target, "PORT", "22"))
    user = _env(target, "USER", "ubuntu")
    key_path = _env(target, "KEY", str(Path.home() / ".ssh" / f"financeiro_{target}_vm_key"))

    client = paramiko.SSHClient()
    client.load_system_host_keys()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(hostname=host, port=port, username=user, key_filename=key_path)
    return client


def _run_command(client: paramiko.SSHClient, command: str) -> int:
    stdin, stdout, stderr = client.exec_command(command)
    stdin.close()
    channel = stdout.channel

    def _pump(stream, out):
        for line in iter(stream.readline, ""):
            out.write(line)
            out.flush()

    t_out = threading.Thread(target=_pump, args=(stdout, sys.stdout))
    t_err = threading.Thread(target=_pump, args=(stderr, sys.stderr))
    t_out.start()
    t_err.start()
    t_out.join()
    t_err.join()

    return channel.recv_exit_status()


def _interactive(client: paramiko.SSHClient) -> int:
    channel = client.invoke_shell()

    def _reader():
        while True:
            data = channel.recv(4096)
            if not data:
                break
            sys.stdout.write(data.decode(errors="replace"))
            sys.stdout.flush()

    reader = threading.Thread(target=_reader, daemon=True)
    reader.start()

    try:
        while not channel.closed:
            line = input()
            channel.send(line + "\n")
    except (EOFError, KeyboardInterrupt):
        pass
    return 0


def main() -> None:
    if len(sys.argv) < 2 or sys.argv[1] not in TARGETS:
        print(f"Uso: python ssh_vm.py <{'|'.join(TARGETS)}> [comando remoto...]", file=sys.stderr)
        sys.exit(2)

    target = sys.argv[1]
    # Comando remoto chega via env var, não argv — ver comentário em ssh-vm.ps1
    # sobre o PowerShell derrubar aspas internas ao passar como argumento de CLI.
    command = os.environ.get("SSH_VM_REMOTE_COMMAND", "") or " ".join(sys.argv[2:])

    if target == "prod":
        print(
            "AVISO: alvo é a VM de PRODUÇÃO. Este comando só deve rodar mediante "
            "aprovação explícita do CEO (ver Política de Autonomia em CLAUDE.md).",
            file=sys.stderr,
        )

    client = _connect(target)
    try:
        exit_code = _run_command(client, command) if command else _interactive(client)
    finally:
        client.close()

    sys.exit(exit_code)


if __name__ == "__main__":
    main()
