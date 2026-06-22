// src/modules/clients/ui/ClientListScreen.tsx
// Listagem de clientes. Só apresentação — dados vêm de shared/clients.
// Por padrão mostra só ativos; com o toggle, inclui arquivados (marcados).

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { listClients, type ClientRow } from "../../../shared/clients/clients";

export function ClientListScreen() {
  const navigate = useNavigate();
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showArchived, setShowArchived] = useState(false);

  useEffect(() => {
    setLoading(true);
    listClients(showArchived).then(({ data, error }) => {
      setClients(data);
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
          <div className="home-hello">Clientes</div>
        </div>
        <button className="btn-primary btn-compact" onClick={() => navigate("/clientes/novo")}>
          Novo cliente
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
      ) : clients.length === 0 ? (
        <div className="empty-note">
          {showArchived
            ? "Nenhum cliente encontrado."
            : "Nenhum cliente cadastrado ainda. Toque em “Novo cliente” para começar."}
        </div>
      ) : (
        <div className="list">
          {clients.map((c) => (
            <button
              key={c.id}
              className="list-row list-row-btn"
              onClick={() => navigate(`/clientes/${c.id}/editar`)}
            >
              <div className="list-main">
                <div className="list-title">
                  {c.name}
                  {c.archivedAt && <span className="tag-archived">Arquivado</span>}
                </div>
                <div className="list-sub">{c.phone ?? "Sem telefone"}</div>
              </div>
              <div className="list-chevron">›</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
