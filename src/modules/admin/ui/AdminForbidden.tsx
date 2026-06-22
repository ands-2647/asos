// src/modules/admin/ui/AdminForbidden.tsx
// 403 do painel: usuário sem papel de admin da plataforma tentou acessar /admin.

import { useNavigate } from "react-router-dom";

export function AdminForbidden() {
  const navigate = useNavigate();
  return (
    <div className="screen status-gate">
      <div className="status-card">
        <div className="status-pill status-blocked">403 — Acesso negado</div>
        <p className="status-body">Esta área é exclusiva da administração AS OS.</p>
        <button className="btn-secondary btn-block" onClick={() => navigate("/home")}>
          Voltar ao início
        </button>
      </div>
    </div>
  );
}
