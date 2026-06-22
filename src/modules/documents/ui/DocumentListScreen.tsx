// src/modules/documents/ui/DocumentListScreen.tsx
// Listagem de atendimentos (orçamentos/OS). Só apresentação.
// Por padrão mostra só ativos; com o toggle, inclui arquivados (marcados).

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  listDocuments,
  kindLabel,
  workStatusLabel,
  formatBRL,
  formatShortDate,
  type DocumentListRow,
} from "../../../shared/documents/documents";

export function DocumentListScreen() {
  const navigate = useNavigate();
  const [docs, setDocs] = useState<DocumentListRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showArchived, setShowArchived] = useState(false);

  useEffect(() => {
    setLoading(true);
    listDocuments(showArchived).then(({ data, error }) => {
      setDocs(data);
      setError(error);
      setLoading(false);
    });
  }, [showArchived]);

  return (
    <div className="screen screen-wide">
      <header className="home-top">
        <div>
          <button className="link-btn" onClick={() => navigate("/home")}>
            ← Início
          </button>
          <div className="home-hello">Atendimentos</div>
        </div>
        <button className="btn-primary btn-compact" onClick={() => navigate("/atendimentos/novo")}>
          Novo
        </button>
      </header>

      <label className="toggle-row">
        <input
          type="checkbox"
          checked={showArchived}
          onChange={(e) => setShowArchived(e.target.checked)}
        />
        Mostrar arquivados
      </label>

      {error && <div className="error-box">{error}</div>}

      {loading ? (
        <div className="hint">Carregando…</div>
      ) : docs.length === 0 ? (
        <div className="empty-note">
          {showArchived
            ? "Nenhum atendimento encontrado."
            : "Nenhum atendimento ainda. Toque em “Novo” para criar um orçamento ou ordem de serviço."}
        </div>
      ) : (
        <div className="list">
          {docs.map((d) => (
            <button
              key={d.id}
              className="list-row list-row-btn"
              onClick={() => navigate(`/atendimentos/${d.id}`)}
            >
              <div className="list-main">
                <div className="list-title">
                  {d.clientName ?? "Cliente"}
                  {d.archivedAt && <span className="tag-archived">Arquivado</span>}
                </div>
                <div className="list-sub">
                  {kindLabel(d.kind)}
                  {d.number != null ? ` #${d.number}` : ""} · {workStatusLabel(d.workStatus)} ·{" "}
                  {formatShortDate(d.createdAt)}
                </div>
              </div>
              <div className="list-amount">{formatBRL(d.total)}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
