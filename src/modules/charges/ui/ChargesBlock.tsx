// src/modules/charges/ui/ChargesBlock.tsx
// Bloco "Cobranças" usado na tela de detalhe do atendimento. Só apresentação:
// toda a lógica vem de shared/charges. Avisa o pai (onChanged) quando algo muda,
// para o bloco financeiro/timeline do detalhe se atualizar.

import { useEffect, useState } from "react";
import { formatBRL, formatShortDate } from "../../../shared/documents/documents";
import { PAYMENT_METHOD_OPTIONS } from "../../../shared/payments/payments";
import {
  listCharges,
  createCharge,
  settleCharge,
  cancelCharge,
  chargeStatusLabel,
  type Charge,
} from "../../../shared/charges/charges";

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function ChargesBlock({
  documentId,
  onChanged,
}: {
  documentId: string;
  onChanged?: () => void;
}) {
  const [charges, setCharges] = useState<Charge[]>([]);
  const [form, setForm] = useState({ amount: "", dueDate: today(), note: "" });
  const [method, setMethod] = useState("dinheiro");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  async function reload() {
    const { data, error } = await listCharges(documentId);
    setCharges(data);
    if (error) setError(error);
  }

  useEffect(() => {
    listCharges(documentId).then(({ data, error }) => {
      setCharges(data);
      if (error) setError(error);
      setLoading(false);
    });
  }, [documentId]);

  async function handleCreate() {
    setError(null);
    setBusy(true);
    const { error } = await createCharge(documentId, form);
    setBusy(false);
    if (error) {
      setError(error);
      return;
    }
    setForm({ amount: "", dueDate: today(), note: "" });
    await reload();
    onChanged?.();
  }

  async function handleSettle(c: Charge) {
    setError(null);
    setBusy(true);
    const { error } = await settleCharge(c, documentId, method);
    setBusy(false);
    if (error) {
      setError(error);
      return;
    }
    await reload();
    onChanged?.();
  }

  async function handleCancel(c: Charge) {
    if (!window.confirm("Cancelar esta cobrança?")) return;
    setError(null);
    setBusy(true);
    const { error } = await cancelCharge(c);
    setBusy(false);
    if (error) {
      setError(error);
      return;
    }
    await reload();
    onChanged?.();
  }

  return (
    <>
      <div className="section-title">Cobranças</div>
      {error && <div className="error-box">{error}</div>}

      {!loading && charges.length > 0 && (
        <div className="list">
          {charges.map((c) => (
            <div className="charge-row" key={c.id}>
              <div className="charge-head">
                <div className="list-main">
                  <div className="list-title">{formatBRL(c.amount)}</div>
                  <div className="list-sub">
                    Vence em {formatShortDate(c.dueDate)}
                    {c.note ? ` · ${c.note}` : ""}
                  </div>
                </div>
                <span className={"badge badge-charge-" + c.viewStatus}>
                  {chargeStatusLabel(c.viewStatus)}
                </span>
              </div>
              {c.status === "pending" && (
                <div className="charge-actions">
                  <select
                    className="select select-sm"
                    value={method}
                    onChange={(e) => setMethod(e.target.value)}
                  >
                    {PAYMENT_METHOD_OPTIONS.map((m) => (
                      <option key={m.label} value={m.value}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                  <button className="btn-primary btn-sm" disabled={busy} onClick={() => handleSettle(c)}>
                    Receber
                  </button>
                  <button className="btn-secondary btn-sm" disabled={busy} onClick={() => handleCancel(c)}>
                    Cancelar
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="pay-form">
        <div className="line-grid">
          <div>
            <label className="mini-label">Valor (R$)</label>
            <input
              inputMode="decimal"
              value={form.amount}
              onChange={(e) => setForm((p) => ({ ...p, amount: e.target.value }))}
              placeholder="0,00"
            />
          </div>
          <div>
            <label className="mini-label">Vencimento</label>
            <input
              type="date"
              value={form.dueDate}
              onChange={(e) => setForm((p) => ({ ...p, dueDate: e.target.value }))}
            />
          </div>
        </div>
        <label className="mini-label">Observação</label>
        <input
          value={form.note}
          onChange={(e) => setForm((p) => ({ ...p, note: e.target.value }))}
          placeholder="Opcional"
        />
        <button className="btn-primary btn-block" disabled={busy} onClick={handleCreate}>
          {busy ? "Processando..." : "Criar cobrança"}
        </button>
      </div>
    </>
  );
}
