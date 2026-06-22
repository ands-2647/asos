// src/modules/home/ui/HomeScreen.tsx
// Home com 3 estados:
//  1) sem clientes e sem atendimentos -> boas-vindas + atalhos Novo Cliente / Novo Atendimento
//  2) com clientes e sem atendimentos -> total de clientes + atalho Novo Atendimento
//  3) com movimentação              -> total de clientes, total de atendimentos, últimos atendimentos
// Só apresentação: os dados vêm de shared/home.

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { signOut } from "../../../shared/auth/auth";
import {
  loadHomeData,
  kindLabel,
  workStatusLabel,
  formatBRL,
  formatShortDate,
  type HomeData,
} from "../../../shared/home/home";
import { syncNotifications, unreadCount } from "../../../shared/notifications/notifications";

export function HomeScreen() {
  const navigate = useNavigate();
  const [data, setData] = useState<HomeData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    loadHomeData().then(({ data, error }) => {
      setData(data);
      setError(error);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    syncNotifications()
      .then(() => unreadCount())
      .then(setUnread)
      .catch(() => {});
  }, []);

  async function handleSignOut() {
    await signOut();
    navigate("/auth", { replace: true });
  }

  const goNewClient = () => navigate("/clientes/novo");
  const goNewService = () => navigate("/atendimentos/novo");
  const goClients = () => navigate("/clientes");
  const goDocuments = () => navigate("/atendimentos");
  const goDocument = (id: string) => navigate(`/atendimentos/${id}`);

  if (loading) return <div className="loading-screen">Carregando…</div>;

  return (
    <div className="screen screen-wide">
      <header className="home-top">
        <div className="home-id">
          <img className="brand-logo" src="/icon-512.png" alt="AS OS" />
          <div>
            <div className="home-hello">Olá!</div>
            {data?.businessName && <div className="home-business">{data.businessName}</div>}
          </div>
        </div>
        <div className="header-actions">
          <button className="link-btn" onClick={() => navigate("/dashboard")}>
            Dashboard
          </button>
          <button className="link-btn" onClick={() => navigate("/financeiro")}>
            Financeiro
          </button>
          <button className="link-btn" onClick={() => navigate("/configuracoes")}>
            Configurações
          </button>
          <button className="link-btn" onClick={() => navigate("/notificacoes")}>
            Notificações
            {unread > 0 && <span className="notif-badge">{unread}</span>}
          </button>
          <button className="link-btn" onClick={handleSignOut}>
            Sair
          </button>
        </div>
      </header>

      {error && <div className="error-box">{error}</div>}

      {data && !error && (
        <HomeBody
          data={data}
          onNewClient={goNewClient}
          onNewService={goNewService}
          onOpenClients={goClients}
          onOpenDocuments={goDocuments}
          onOpenDocument={goDocument}
        />
      )}
    </div>
  );
}

function HomeBody({
  data,
  onNewClient,
  onNewService,
  onOpenClients,
  onOpenDocuments,
  onOpenDocument,
}: {
  data: HomeData;
  onNewClient: () => void;
  onNewService: () => void;
  onOpenClients: () => void;
  onOpenDocuments: () => void;
  onOpenDocument: (id: string) => void;
}) {
  const hasClients = data.clientCount > 0;
  const hasDocs = data.documentCount > 0;

  // Estado 3 — possui movimentação
  if (hasDocs) {
    return (
      <>
        <div className="stat-row">
          <button className="stat-card stat-card-btn" onClick={onOpenClients}>
            <div className="stat-num">{data.clientCount}</div>
            <div className="stat-label">{data.clientCount === 1 ? "Cliente" : "Clientes"}</div>
          </button>
          <button className="stat-card stat-card-btn" onClick={onOpenDocuments}>
            <div className="stat-num">{data.documentCount}</div>
            <div className="stat-label">
              {data.documentCount === 1 ? "Atendimento" : "Atendimentos"}
            </div>
          </button>
        </div>

        <div className="btn-row">
          <button className="btn-primary" onClick={onNewService}>
            Novo atendimento
          </button>
          <button className="btn-secondary" onClick={onNewClient}>
            Novo cliente
          </button>
        </div>

        <div className="section-title">Últimos atendimentos</div>
        <div className="list">
          {data.recentDocs.map((d) => (
            <button className="list-row list-row-btn" key={d.id} onClick={() => onOpenDocument(d.id)}>
              <div className="list-main">
                <div className="list-title">{d.clientName ?? "Cliente"}</div>
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
      </>
    );
  }

  // Estado 2 — possui clientes, mas nenhum atendimento
  if (hasClients) {
    return (
      <>
        <div className="stat-row">
          <button className="stat-card stat-card-btn" onClick={onOpenClients}>
            <div className="stat-num">{data.clientCount}</div>
            <div className="stat-label">
              {data.clientCount === 1 ? "Cliente cadastrado" : "Clientes cadastrados"}
            </div>
          </button>
        </div>

        <div className="empty-note">
          Você ainda não registrou nenhum atendimento. Crie o primeiro orçamento ou ordem de serviço.
        </div>

        <button className="btn-primary btn-block" onClick={onNewService}>
          Novo atendimento
        </button>
      </>
    );
  }

  // Estado 1 — usuário novo, sem clientes e sem atendimentos
  return (
    <div className="welcome">
      <div className="title">Bem-vindo ao AS OS</div>
      <div className="subtitle">
        Comece cadastrando um cliente ou criando seu primeiro atendimento.
      </div>

      <button className="btn-primary btn-block" onClick={onNewClient}>
        Novo cliente
      </button>
      <button className="btn-secondary btn-block" onClick={onNewService}>
        Novo atendimento
      </button>
    </div>
  );
}
