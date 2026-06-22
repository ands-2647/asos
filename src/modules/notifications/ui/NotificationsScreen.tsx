// src/modules/notifications/ui/NotificationsScreen.tsx
// Central de Notificações. Só apresentação: lógica em shared/notifications.
// Ao abrir, sincroniza (gera as notificações faltantes) e lista.

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  syncNotifications,
  listNotifications,
  markRead,
  markAllRead,
  notificationTypeLabel,
  formatNotificationTime,
  type AppNotification,
} from "../../../shared/notifications/notifications";

export function NotificationsScreen() {
  const navigate = useNavigate();
  const [items, setItems] = useState<AppNotification[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  async function refresh() {
    const { data, error } = await listNotifications();
    setItems(data);
    if (error) setError(error);
  }

  useEffect(() => {
    (async () => {
      await syncNotifications();
      await refresh();
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const unread = items.filter((n) => !n.readAt).length;

  async function handleOpen(n: AppNotification) {
    if (!n.readAt) await markRead(n.id);
    if (n.documentId) navigate(`/atendimentos/${n.documentId}`);
    else await refresh();
  }

  async function handleMarkAll() {
    setBusy(true);
    await markAllRead();
    setBusy(false);
    await refresh();
  }

  if (loading) return <div className="loading-screen">Carregando…</div>;

  return (
    <div className="screen screen-wide">
      <header className="home-top">
        <div>
          <button className="link-btn" onClick={() => navigate("/home")}>
            ← Início
          </button>
          <div className="home-hello">Notificações</div>
        </div>
        {unread > 0 && (
          <button className="link-btn" disabled={busy} onClick={handleMarkAll}>
            Marcar todas como lidas
          </button>
        )}
      </header>

      {error && <div className="error-box">{error}</div>}

      {items.length === 0 ? (
        <div className="empty-note">Nenhuma notificação no momento.</div>
      ) : (
        <div className="list">
          {items.map((n) => (
            <button
              key={n.id}
              className={"notif-row" + (n.readAt ? " notif-read" : "")}
              onClick={() => handleOpen(n)}
            >
              {!n.readAt && <span className="notif-dot" />}
              <div className="list-main">
                <div className="list-title">{n.title}</div>
                <div className="list-sub">
                  {notificationTypeLabel(n.type)} · {formatNotificationTime(n.createdAt)}
                </div>
              </div>
              {n.actionLabel && n.documentId && <span className="notif-action">{n.actionLabel} ›</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
