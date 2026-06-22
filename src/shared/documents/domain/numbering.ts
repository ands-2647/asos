// src/shared/documents/domain/numbering.ts
// Política de numeração de documentos. Domínio puro: sem I/O.
//
// Regra: o número definitivo é atribuído quando o documento SAI de 'draft' pela primeira
// vez (efetivação/aprovação). Nunca renumera — só atribui se ainda não houver número.
// A geração do valor em si é feita pela função do banco next_document_number() (atômica,
// sequência independente por tenant+tipo); aqui ficamos apenas com a DECISÃO de numerar.

import type { WorkStatus } from "./status";

export function shouldAssignNumber(
  from: WorkStatus,
  to: WorkStatus,
  currentNumber: number | null
): boolean {
  const leavingDraft = from === "draft" && to !== "draft";
  const stillUnnumbered = currentNumber == null;
  return leavingDraft && stillUnnumbered;
}
