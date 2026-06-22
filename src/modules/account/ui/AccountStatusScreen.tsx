// src/modules/account/ui/AccountStatusScreen.tsx
// Tela mostrada quando a conta NÃO está liberada (pending/expired/blocked/rejected).
// Os dados do tenant continuam intactos no banco — assim que o admin reativar, o uso volta.
// Só apresentação: a decisão de exibir vem do gate em App.tsx.

import { signOut } from "../../../shared/auth/auth";
import type { AccountStatus } from "../../../shared/account/account";

const COPY: Record<Exclude<AccountStatus, "active" | "trial">, { title: string; body: string }> = {
  pending: {
    title: "Cadastro em análise",
    body: "Seu cadastro está aguardando aprovação. Você receberá acesso assim que a equipe AS OS liberar sua conta.",
  },
  expired: {
    title: "Plano expirado",
    body: "Seu plano expirou. Seus dados estão guardados com segurança — regularize o pagamento para voltar a usar o sistema.",
  },
  blocked: {
    title: "Conta bloqueada",
    body: "Sua conta está temporariamente bloqueada. Fale com o suporte AS OS para regularizar.",
  },
  rejected: {
    title: "Cadastro não aprovado",
    body: "Seu cadastro não foi aprovado. Se acredita que houve um engano, entre em contato com o suporte AS OS.",
  },
};

export function AccountStatusScreen({ status }: { status: AccountStatus }) {
  const key = (status === "active" || status === "trial" ? "pending" : status) as keyof typeof COPY;
  const { title, body } = COPY[key];

  return (
    <div className="screen status-gate">
      <div className="status-card">
        <div className="status-mark">AS OS</div>
        <div className={`status-pill status-${status}`}>{title}</div>
        <p className="status-body">{body}</p>
        <button className="btn-secondary btn-block" onClick={() => signOut()}>
          Sair
        </button>
        <button className="link-btn" onClick={() => window.location.reload()}>
          Já fui liberado? Atualizar
        </button>
      </div>
    </div>
  );
}
