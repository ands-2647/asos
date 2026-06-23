// src/shared/documents/domain/status.ts
// Máquina de estados do work_status de um atendimento (orçamento/OS).
// Domínio puro: sem I/O, sem Supabase. É a fonte única das transições válidas.
//
// Eixo de trabalho (work_status) conforme o CHECK da tabela documents:
//   draft | waiting | approved | reproved | in_progress | partial | done | cancelled
//
// Orçamento (budget):  draft --efetivar--> waiting --aprovar/reprovar--> approved | reproved
// OS (service_order):  draft --iniciar--> in_progress --parcial--> partial --concluir--> done

export type WorkStatus =
  | "draft"
  | "waiting"
  | "approved"
  | "reproved"
  | "in_progress"
  | "partial"
  | "done"
  | "cancelled";

export type DocumentKind = "budget" | "service_order";

export type ActionIntent = "primary" | "secondary" | "danger";

export type TransitionAction = {
  action: string; // identificador curto da ação
  to: WorkStatus; // estado de destino
  label: string; // rótulo do botão
  intent: ActionIntent;
};

const TRANSITIONS: Record<DocumentKind, Partial<Record<WorkStatus, TransitionAction[]>>> = {
  budget: {
    draft: [{ action: "efetivar", to: "waiting", label: "Finalizar orçamento", intent: "primary" }],
    waiting: [
      { action: "aprovar", to: "approved", label: "Aprovar orçamento", intent: "primary" },
      { action: "reprovar", to: "reproved", label: "Recusar", intent: "danger" },
    ],
    approved: [],
    reproved: [],
  },
  service_order: {
    draft: [{ action: "iniciar", to: "in_progress", label: "Iniciar serviço", intent: "primary" }],
    in_progress: [
      { action: "parcial", to: "partial", label: "Marcar andamento parcial", intent: "secondary" },
      { action: "concluir", to: "done", label: "Concluir serviço", intent: "primary" },
    ],
    partial: [{ action: "concluir", to: "done", label: "Concluir serviço", intent: "primary" }],
    done: [],
  },
};

// Ações disponíveis a partir do estado atual (contextuais).
export function nextActions(kind: DocumentKind, status: WorkStatus): TransitionAction[] {
  return TRANSITIONS[kind]?.[status] ?? [];
}

// Uma transição só é válida se constar nas ações do estado atual.
export function isValidTransition(kind: DocumentKind, from: WorkStatus, to: WorkStatus): boolean {
  return nextActions(kind, from).some((a) => a.to === to);
}

const WORK_STATUS_LABEL: Record<WorkStatus, string> = {
  draft: "Rascunho",
  waiting: "Aguardando aprovação",
  approved: "Aprovado",
  reproved: "Recusado",
  in_progress: "Em andamento",
  partial: "Andamento parcial",
  done: "Concluído",
  cancelled: "Cancelado",
};

export function statusLabel(status: WorkStatus | string): string {
  return WORK_STATUS_LABEL[status as WorkStatus] ?? status;
}

// Estado terminal: nenhuma ação disponível para nenhum dos tipos.
export function isTerminal(kind: DocumentKind, status: WorkStatus): boolean {
  return nextActions(kind, status).length === 0;
}
