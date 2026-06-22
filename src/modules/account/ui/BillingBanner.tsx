// src/modules/account/ui/BillingBanner.tsx
// Aviso visual de vencimento do plano no app cliente (Fase 4). Auto-contido: busca o
// próprio status de cobrança e só aparece quando o vencimento está próximo (<= 7 dias).
// A notificação interna correspondente é criada pelo ciclo diário (run_billing_cycle).

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getMyBillingStatus, type BillingStatus } from "../../../shared/account/account";

export function BillingBanner() {
  const navigate = useNavigate();
  const [b, setB] = useState<BillingStatus | null>(null);

  useEffect(() => {
    getMyBillingStatus().then(setB);
  }, []);

  // só mostra para contas em uso (active/trial) com vencimento em até 7 dias
  if (!b || (b.status !== "active" && b.status !== "trial")) return null;
  if (b.days_left == null || b.days_left > 7) return null;

  const urgent = b.days_left <= 3;
  const msg =
    b.days_left <= 0
      ? "Seu plano vence hoje."
      : `Seu plano vence em ${b.days_left} dia${b.days_left === 1 ? "" : "s"}.`;

  return (
    <button
      type="button"
      className={`billing-banner ${urgent ? "is-urgent" : ""}`}
      onClick={() => navigate("/notificacoes")}
      aria-label={`${msg} Ver avisos.`}
    >
      <span className="billing-banner-dot" aria-hidden />
      <span className="billing-banner-text">{msg} Toque para ver os avisos.</span>
    </button>
  );
}
