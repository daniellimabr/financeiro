import { useEffect, useRef } from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";

interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}

// Painel lateral genérico do Analyst Console (Sprint 35, épico E10) — primeira
// vez que o sistema precisa de um padrão de "painel sobre a tela", usado por
// CategorizationReviewPage (Categorias) e ConfiguracoesPage (Gestão de
// Contas). Portal pra document.body, mesmo padrão de CategoryCombobox.tsx.
// Não monta `children` enquanto fechado — cada abertura dispara as queries de
// dados do conteúdo do zero, nunca um cache "congelado" da última abertura.
export function Drawer({ open, onClose, title, children }: DrawerProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    closeButtonRef.current?.focus();
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    // A backdrop fixa cobre a tela toda visualmente, mas não intercepta
    // scroll por si só — sem isto, a roda do mouse/teclado ainda rola a
    // página por trás do drawer (achado real via browser-check, Sprint 35).
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div className="ac-drawer-backdrop" onClick={onClose}>
      <div
        className="ac-drawer"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="ac-drawer-head">
          <h2>{title}</h2>
          <button
            ref={closeButtonRef}
            type="button"
            className="ac-drawer-close"
            aria-label="Fechar"
            onClick={onClose}
          >
            <CloseIcon />
          </button>
        </div>
        <div className="ac-drawer-body">{children}</div>
      </div>
    </div>,
    document.body
  );
}

function CloseIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M3 3l10 10M13 3 3 13" />
    </svg>
  );
}
