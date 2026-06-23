// src/shared/documents/transitions.ts
// Orquestração do fluxo operacional do documento. Junta o domínio (status/numbering) com
// o banco (Supabase). Fica FORA das telas. RLS limita ao próprio tenant.
//
// applyTransition:
//  1) lê o estado atual (kind, work_status, number, tenant_id)
//  2) valida a transição pelo domínio (isValidTransition) — bloqueia inválidas
//  3) se a política mandar numerar, chama next_document_number() (RPC, atômico)
//  4) grava work_status (+ number quando aplicável)
// O evento da timeline é gerado pelo trigger on_document_status_changed no banco.

import { supabase } from "../supabase";
import {
  isValidTransition,
  nextActions,
  type DocumentKind,
  type TransitionAction,
  type WorkStatus,
} from "./domain/status";
import { shouldAssignNumber } from "./domain/numbering";
import { chargeOpenBalance } from "../charges/charges";

export type StatusInfo = {
  kind: DocumentKind;
  workStatus: WorkStatus;
  number: number | null;
  actions: TransitionAction[];
};

export async function getStatusInfo(
  id: string
): Promise<{ data: StatusInfo | null; error: string | null }> {
  const { data, error } = await supabase
    .from("documents")
    .select("kind, work_status, number")
    .eq("id", id)
    .single();

  if (error || !data) {
    console.error("[transitions] getStatusInfo", error?.message);
    return { data: null, error: "Atendimento não encontrado." };
  }

  const kind = data.kind as DocumentKind;
  const workStatus = data.work_status as WorkStatus;
  return {
    data: { kind, workStatus, number: data.number ?? null, actions: nextActions(kind, workStatus) },
    error: null,
  };
}

export async function applyTransition(
  id: string,
  to: WorkStatus
): Promise<{ error: string | null }> {
  const { data, error } = await supabase
    .from("documents")
    .select("tenant_id, kind, work_status, number")
    .eq("id", id)
    .single();

  if (error || !data) {
    console.error("[transitions] load", error?.message);
    return { error: "Atendimento não encontrado." };
  }

  const kind = data.kind as DocumentKind;
  const from = data.work_status as WorkStatus;
  const currentNumber = (data.number ?? null) as number | null;

  if (!isValidTransition(kind, from, to)) {
    return { error: "Transição de status inválida." };
  }

  const patch: { work_status: WorkStatus; number?: number } = { work_status: to };

  if (shouldAssignNumber(from, to, currentNumber)) {
    const { data: num, error: rpcErr } = await supabase.rpc("next_document_number", {
      p_tenant_id: data.tenant_id,
      p_kind: kind,
    });
    if (rpcErr || num == null) {
      console.error("[transitions] numbering", rpcErr?.message);
      return { error: "Não foi possível gerar o número do documento." };
    }
    patch.number = num as number;
  }

  const { error: upErr } = await supabase.from("documents").update(patch).eq("id", id);
  if (upErr) {
    console.error("[transitions] update", upErr.message);
    return { error: "Não foi possível atualizar o status. Tente de novo." };
  }

  // Ao APROVAR um orçamento, gera automaticamente a cobrança do valor em aberto
  // (vira "a receber" no Financeiro/Dashboard). Best-effort: não derruba a transição.
  if (kind === "budget" && to === "approved") {
    const r = await chargeOpenBalance(id);
    if (r.error) console.error("[transitions] auto-charge", r.error);
  }

  return { error: null };
}
