// src/modules/common/ui/BottomNav.tsx
// Barra de navegação inferior (mobile/PWA) — padrão de app comercial.
// Apenas roteamento entre telas que JÁ existem; não toca em regra de negócio, dados ou auth.
// Auto-oculta fora das telas do cliente (login, onboarding e /admin não exibem a barra).
// Visível só em telas pequenas (CSS) e respeita a safe-area do iPhone.

import { useLocation, useNavigate } from "react-router-dom";

type Tab = { to: string; label: string; icon: (active: boolean) => JSX.Element };

// Seções onde a barra deve aparecer (telas do cliente logado).
const SHOW_ON = ["/home", "/clientes", "/atendimentos", "/financeiro", "/dashboard", "/notificacoes", "/configuracoes"];

function isUnder(path: string, base: string): boolean {
  return path === base || path.startsWith(base + "/");
}

const TABS: Tab[] = [
  { to: "/home", label: "Início", icon: IconHome },
  { to: "/atendimentos", label: "Atendimentos", icon: IconDoc },
  { to: "/clientes", label: "Clientes", icon: IconUsers },
  { to: "/financeiro", label: "Financeiro", icon: IconMoney },
];

export function BottomNav() {
  const { pathname } = useLocation();
  const navigate = useNavigate();

  const visible = SHOW_ON.some((b) => isUnder(pathname, b));
  if (!visible) return null;

  return (
    <nav className="bottom-nav" aria-label="Navegação principal">
      {TABS.map((t) => {
        const active = isUnder(pathname, t.to);
        return (
          <button
            key={t.to}
            type="button"
            className={`bottom-nav-item ${active ? "is-active" : ""}`}
            aria-current={active ? "page" : undefined}
            onClick={() => navigate(t.to)}
          >
            {t.icon(active)}
            <span className="bottom-nav-label">{t.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

// --- ícones (SVG inline, stroke = currentColor, sem dependências) ---

function IconHome() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9.5V21h14V9.5" />
    </svg>
  );
}
function IconDoc() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M7 3h7l5 5v13H7z" />
      <path d="M14 3v5h5" />
      <path d="M9.5 13h6M9.5 16.5h6" />
    </svg>
  );
}
function IconUsers() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3.5 20c.6-3.3 2.9-5 5.5-5s4.9 1.7 5.5 5" />
      <path d="M16 4.5a3 3 0 0 1 0 6M17.5 15c2 .5 3.4 2 3.9 4.5" />
    </svg>
  );
}
function IconMoney() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="6" width="18" height="12" rx="2" />
      <circle cx="12" cy="12" r="2.6" />
      <path d="M6.5 9.5h.01M17.5 14.5h.01" />
    </svg>
  );
}
