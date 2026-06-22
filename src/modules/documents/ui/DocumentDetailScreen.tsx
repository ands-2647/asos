// src/modules/documents/ui/DocumentDetailScreen.tsx
// Visualização completa do atendimento (read-only): dados, rastreabilidade, itens/serviços,
// totais, FINANCEIRO (total/recebido/saldo/status) + pagamentos, fotos, ações e timeline.

import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  kindLabel,
  formatBRL,
  formatShortDate,
  archiveDocument,
  restoreDocument,
  type DocumentKind,
} from "../../../shared/documents/documents";
import {
  getDocumentDetail,
  listDocumentEvents,
  convertBudgetToOrder,
  formatDateTime,
  type DocumentFull,
  type TimelineEvent,
  type DocRef,
} from "../../../shared/documents/detail";
import { getStatusInfo, applyTransition, type StatusInfo } from "../../../shared/documents/transitions";
import { statusLabel, type ActionIntent, type WorkStatus } from "../../../shared/documents/domain/status";
import {
  listPhotos,
  uploadPhoto,
  deletePhoto,
  MAX_PHOTOS,
  type Photo,
} from "../../../shared/attachments/attachments";
import {
  getFinancialSummary,
  listPayments,
  addPayment,
  methodLabel,
  paymentStatusLabel,
  PAYMENT_METHOD_OPTIONS,
  type FinancialSummary,
  type PaymentRow,
} from "../../../shared/payments/payments";
import { generateDocumentPdf } from "../../../shared/pdf/pdf";
import { shareDocumentWhatsApp } from "../../../shared/whatsapp/whatsapp";
import { ChargesBlock } from "../../charges/ui/ChargesBlock";

function intentClass(intent: ActionIntent): string {
  if (intent === "danger") return "btn-danger";
  if (intent === "secondary") return "btn-secondary";
  return "btn-primary";
}
function docRefLabel(ref: DocRef): string {
  return `${kindLabel(ref.kind)}${ref.number != null ? ` #${ref.number}` : " (rascunho)"}`;
}
function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function DocumentDetailScreen() {
  const navigate = useNavigate();
  const { id } = useParams();
  const fileRef = useRef<HTMLInputElement>(null);
  const [doc, setDoc] = useState<DocumentFull | null>(null);
  const [status, setStatus] = useState<StatusInfo | null>(null);
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [financial, setFinancial] = useState<FinancialSummary | null>(null);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [payForm, setPayForm] = useState({ amount: "", method: "dinheiro", paidOn: today() });
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [payError, setPayError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [savingPay, setSavingPay] = useState(false);
  const [viewer, setViewer] = useState<string | null>(null);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [shareError, setShareError] = useState<string | null>(null);

  async function load() {
    if (!id) return;
    const [detail, st, ev, ph, fin, pays] = await Promise.all([
      getDocumentDetail(id),
      getStatusInfo(id),
      listDocumentEvents(id),
      listPhotos(id),
      getFinancialSummary(id),
      listPayments(id),
    ]);
    if (detail.error) setError(detail.error);
    setDoc(detail.data);
    setStatus(st.data);
    setEvents(ev.data);
    setPhotos(ph.data);
    setFinancial(fin.data);
    setPayments(pays.data);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function refreshPhotos() {
    if (!id) return;
    const ph = await listPhotos(id);
    setPhotos(ph.data);
  }

  async function handleAction(to: WorkStatus) {
    if (!id) return;
    setActionError(null);
    setBusy(true);
    const { error } = await applyTransition(id, to);
    setBusy(false);
    if (error) {
      setActionError(error);
      return;
    }
    setLoading(true);
    await load();
  }

  async function handleConvert() {
    if (!id) return;
    setActionError(null);
    setBusy(true);
    const { id: newId, error } = await convertBudgetToOrder(id);
    setBusy(false);
    if (error) {
      setActionError(error);
      return;
    }
    if (newId) navigate(`/atendimentos/${newId}`);
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !id) return;
    setPhotoError(null);
    setUploading(true);
    const { error } = await uploadPhoto(id, file, photos.length);
    setUploading(false);
    if (error) setPhotoError(error);
    else await refreshPhotos();
  }

  async function handleDeletePhoto(photo: Photo) {
    if (!window.confirm("Excluir esta foto? Esta ação não pode ser desfeita.")) return;
    setPhotoError(null);
    const { error } = await deletePhoto(photo);
    if (error) setPhotoError(error);
    else await refreshPhotos();
  }

  async function handleAddPayment() {
    if (!id) return;
    setPayError(null);
    setSavingPay(true);
    const { error } = await addPayment(id, payForm);
    setSavingPay(false);
    if (error) {
      setPayError(error);
      return;
    }
    setPayForm({ amount: "", method: "dinheiro", paidOn: today() });
    setLoading(true);
    await load();
  }

  async function handlePdf() {
    if (!id) return;
    setPdfError(null);
    const { error } = await generateDocumentPdf(id);
    if (error) setPdfError(error);
  }

  async function handleWhatsApp() {
    if (!id) return;
    setShareError(null);
    const { error } = await shareDocumentWhatsApp(id);
    if (error) setShareError(error);
  }

  async function handleArchiveToggle() {
    if (!id) return;
    if (!doc?.archivedAt && !window.confirm("Arquivar este atendimento?")) return;
    setActionError(null);
    setBusy(true);
    const { error } = doc?.archivedAt ? await restoreDocument(id) : await archiveDocument(id);
    setBusy(false);
    if (error) {
      setActionError(error);
      return;
    }
    setLoading(true);
    await load();
  }

  if (loading) return <div className="loading-screen">Carregando…</div>;

  if (error || !doc) {
    return (
      <div className="screen">
        <header className="home-top">
          <button className="link-btn" onClick={() => navigate("/atendimentos")}>
            ← Atendimentos
          </button>
        </header>
        <div className="error-box">{error ?? "Atendimento não encontrado."}</div>
      </div>
    );
  }

  const canConvert =
    (doc.kind as DocumentKind) === "budget" &&
    doc.workStatus === "approved" &&
    doc.conversions.length === 0;
  const atLimit = photos.length >= MAX_PHOTOS;
  const settled = financial != null && financial.balance <= 0 && financial.received > 0;

  return (
    <div className="screen screen-wide">
      <header className="home-top">
        <button className="link-btn" onClick={() => navigate("/atendimentos")}>
          ← Atendimentos
        </button>
        <div className="header-actions">
          <button className="link-btn" onClick={handleWhatsApp}>
            Enviar WhatsApp
          </button>
          <button className="link-btn" onClick={handlePdf}>
            Gerar PDF
          </button>
          <button className="link-btn" onClick={() => navigate(`/atendimentos/${doc.id}/editar`)}>
            Editar
          </button>
        </div>
      </header>

      {pdfError && <div className="error-box">{pdfError}</div>}
      {shareError && <div className="error-box">{shareError}</div>}

      <div className="detail-head">
        <div className="detail-title">
          {kindLabel(doc.kind)}
          {doc.number != null ? ` #${doc.number}` : ""}
        </div>
        <span className={"badge badge-" + doc.workStatus}>{statusLabel(doc.workStatus)}</span>
      </div>

      <div className="detail-card">
        <Row label="Cliente" value={doc.clientName ?? "—"} />
        {doc.clientPhone && <Row label="Telefone" value={doc.clientPhone} />}
        <Row label="Tipo" value={kindLabel(doc.kind)} />
        <Row label="Número" value={doc.number != null ? `#${doc.number}` : "Sem número (rascunho)"} />
        <Row label="Criado em" value={formatShortDate(doc.createdAt)} />
        {doc.validUntil && <Row label="Válido até" value={formatShortDate(doc.validUntil)} />}
      </div>

      {(doc.origin || doc.conversions.length > 0) && (
        <div className="detail-card">
          {doc.origin && (
            <button className="trace-row" onClick={() => navigate(`/atendimentos/${doc.origin!.id}`)}>
              <span className="trace-label">Gerado a partir de</span>
              <span className="trace-link">{docRefLabel(doc.origin)} ›</span>
            </button>
          )}
          {doc.conversions.map((c) => (
            <button key={c.id} className="trace-row" onClick={() => navigate(`/atendimentos/${c.id}`)}>
              <span className="trace-label">Convertido em</span>
              <span className="trace-link">{docRefLabel(c)} ›</span>
            </button>
          ))}
        </div>
      )}

      <div className="section-title">Peças</div>
      {doc.items.length === 0 ? (
        <div className="hint">Nenhuma peça.</div>
      ) : (
        <div className="list">
          {doc.items.map((it, i) => (
            <div className="list-row" key={i}>
              <div className="list-main">
                <div className="list-title">{it.description}</div>
                <div className="list-sub">
                  {it.quantity} × {formatBRL(it.unitPrice)}
                </div>
              </div>
              <div className="list-amount">{formatBRL(it.lineTotal)}</div>
            </div>
          ))}
        </div>
      )}

      <div className="section-title">Serviços</div>
      {doc.services.length === 0 ? (
        <div className="hint">Nenhum serviço.</div>
      ) : (
        <div className="list">
          {doc.services.map((sv, i) => (
            <div className="list-row" key={i}>
              <div className="list-main">
                <div className="list-title">{sv.description}</div>
              </div>
              <div className="list-amount">{formatBRL(sv.price)}</div>
            </div>
          ))}
        </div>
      )}

      {/* financeiro */}
      <div className="section-title">Financeiro</div>
      {financial && (
        <div className="detail-card">
          <Row label="Valor total" value={formatBRL(financial.total)} />
          <Row label="Total recebido" value={formatBRL(financial.received)} />
          <div className="detail-row">
            <span className="detail-row-label">Saldo pendente</span>
            <span className={"detail-row-value" + (financial.balance > 0 ? " value-pending" : " value-ok")}>
              {formatBRL(financial.balance)}
            </span>
          </div>
          <div className="detail-row">
            <span className="detail-row-label">Status financeiro</span>
            <span className={"badge badge-fin-" + financial.status}>
              {paymentStatusLabel(financial.status)}
            </span>
          </div>
        </div>
      )}

      {/* pagamentos */}
      <div className="section-title">Pagamentos</div>
      {payments.length > 0 && (
        <div className="list">
          {payments.map((p) => (
            <div className="list-row" key={p.id}>
              <div className="list-main">
                <div className="list-title">{methodLabel(p.method)}</div>
                <div className="list-sub">{formatShortDate(p.paidOn)}</div>
              </div>
              <div className="list-amount">{formatBRL(p.amount)}</div>
            </div>
          ))}
        </div>
      )}

      {payError && <div className="error-box">{payError}</div>}
      {settled ? (
        <div className="hint">Documento quitado.</div>
      ) : (
        <div className="pay-form">
          <div className="line-grid">
            <div>
              <label className="mini-label">Valor (R$)</label>
              <input
                inputMode="decimal"
                value={payForm.amount}
                onChange={(e) => setPayForm((p) => ({ ...p, amount: e.target.value }))}
                placeholder="0,00"
              />
            </div>
            <div>
              <label className="mini-label">Data</label>
              <input
                type="date"
                value={payForm.paidOn}
                onChange={(e) => setPayForm((p) => ({ ...p, paidOn: e.target.value }))}
              />
            </div>
          </div>
          <label className="mini-label">Método</label>
          <select
            className="select"
            value={payForm.method}
            onChange={(e) => setPayForm((p) => ({ ...p, method: e.target.value }))}
          >
            {PAYMENT_METHOD_OPTIONS.map((m) => (
              <option key={m.label} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
          <button className="btn-primary btn-block" disabled={savingPay} onClick={handleAddPayment}>
            {savingPay ? "Registrando..." : "Registrar pagamento"}
          </button>
        </div>
      )}

      {/* cobranças */}
      <ChargesBlock documentId={doc.id} onChanged={load} />

      {/* fotos */}
      <div className="section-title">
        Fotos <span className="count-hint">{photos.length}/{MAX_PHOTOS}</span>
      </div>
      {photoError && <div className="error-box">{photoError}</div>}
      <div className="photo-grid">
        {photos.map((p) => (
          <div className="photo-thumb" key={p.id}>
            {p.url ? (
              <img src={p.url} alt="anexo" onClick={() => setViewer(p.url)} />
            ) : (
              <div className="photo-broken">indisponível</div>
            )}
            <button className="photo-del" title="Excluir" onClick={() => handleDeletePhoto(p)}>
              ×
            </button>
          </div>
        ))}
        {!atLimit && (
          <button className="photo-add" disabled={uploading} onClick={() => fileRef.current?.click()}>
            {uploading ? "Enviando…" : "+ Foto"}
          </button>
        )}
      </div>
      {atLimit && <div className="hint">Limite de {MAX_PHOTOS} fotos atingido.</div>}
      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        style={{ display: "none" }}
        onChange={handleFile}
      />

      {/* ações operacionais */}
      <div className="section-title">Ações</div>
      {actionError && <div className="error-box">{actionError}</div>}
      <div className="status-actions">
        {status?.actions.map((a) => (
          <button
            key={a.action}
            className={intentClass(a.intent)}
            disabled={busy}
            onClick={() => handleAction(a.to)}
          >
            {a.label}
          </button>
        ))}
        {canConvert && (
          <button className="btn-primary" disabled={busy} onClick={handleConvert}>
            Converter em OS
          </button>
        )}
        {doc.archivedAt ? (
          <button className="btn-secondary" disabled={busy} onClick={handleArchiveToggle}>
            Restaurar atendimento
          </button>
        ) : (
          <button className="btn-danger" disabled={busy} onClick={handleArchiveToggle}>
            Arquivar atendimento
          </button>
        )}
      </div>

      {/* timeline */}
      <div className="section-title">Histórico</div>
      {events.length === 0 ? (
        <div className="hint">Sem eventos registrados.</div>
      ) : (
        <div className="timeline">
          {events.map((e) => (
            <div className="tl-item" key={e.id}>
              <div className="tl-dot" />
              <div className="tl-body">
                <div className="tl-summary">{e.summary}</div>
                <div className="tl-time">{formatDateTime(e.createdAt)}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {viewer && (
        <div className="viewer-overlay" onClick={() => setViewer(null)}>
          <img className="viewer-img" src={viewer} alt="foto" />
        </div>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="detail-row">
      <span className="detail-row-label">{label}</span>
      <span className="detail-row-value">{value}</span>
    </div>
  );
}
