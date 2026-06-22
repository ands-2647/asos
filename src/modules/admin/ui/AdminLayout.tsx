// src/modules/admin/ui/AdminLayout.tsx
// Casca do painel administrativo AS OS: cabeçalho + navegação interna entre as seções.
// A rota /admin não aparece em nenhum menu do app cliente; só é alcançável por URL + papel.

import { useNavigate } from "react-router-dom";

type Section = "empresas" | "financeiro" | "cobrancas" | "auditoria";

const TABS: { key: Section; label: string; path: string }[] = [
  { key: "empresas", label: "Empresas", path: "/admin/empresas" },
  { key: "financeiro", label: "Financeiro", path: "/admin/financeiro" },
  { key: "cobrancas", label: "Cobranças", path: "/admin/cobrancas" },
  { key: "auditoria", label: "Auditoria", path: "/admin/auditoria" },
];

export function AdminLayout({ active, children }: { active: Section; children: React.ReactNode }) {
  const navigate = useNavigate();
  return (
    <div className="screen screen-wide admin-shell">
      <header className="admin-header">
        <div className="admin-brand">
          <span className="admin-badge">AS OS</span>
          <span className="admin-title">Administração da plataforma</span>
        </div>
        <button className="link-btn" onClick={() => navigate("/home")}>
          Sair do painel
        </button>
      </header>

      <nav className="admin-nav">
        {TABS.map((t) => (
          <button
            key={t.key}
            className={`admin-tab ${active === t.key ? "is-active" : ""}`}
            onClick={() => navigate(t.path)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <div className="admin-body">{children}</div>
    </div>
  );
}
