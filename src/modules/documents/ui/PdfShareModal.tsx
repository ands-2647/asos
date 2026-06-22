// src/modules/documents/ui/PdfShareModal.tsx
// Modal de PDF para mobile/PWA: Compartilhar / Salvar / Abrir / Cancelar.
// Mantém o usuário dentro do app (resolve o "preso no visualizador nativo").
// Só apresentação: geração do Blob e ações ficam em shared/pdf/pdfMobile.

import { useState } from "react";
import {
  buildDocumentPdfBlob,
  shareDocumentPdf,
  saveDocumentPdf,
  openDocumentPdf,
  canShareFiles,
} from "../../../shared/pdf/pdfMobile";

export function PdfShareModal({ documentId, onClose }: { documentId: string; onClose: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(action: (blob: Blob, filename: string) => Promise<{ error: string | null }> | { error: string | null }) {
    setError(null);
    setBusy(true);
    const { blob, filename, error } = await buildDocumentPdfBlob(documentId);
    if (error || !blob) {
      setBusy(false);
      setError(error ?? "Não foi possível gerar o PDF.");
      return;
    }
    const result = await action(blob, filename);
    setBusy(false);
    if (result.error) setError(result.error);
    else onClose();
  }

  return (
    <div className="viewer-overlay" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-title">PDF do atendimento</div>
        <div className="sheet-sub">Escolha o que fazer com o documento.</div>

        {error && <div className="error-box">{error}</div>}
        {busy && <div className="hint">Gerando PDF…</div>}

        {canShareFiles() && (
          <button className="btn-primary btn-block" disabled={busy} onClick={() => run((b, f) => shareDocumentPdf(b, f))}>
            Compartilhar PDF
          </button>
        )}
        <button className="btn-secondary btn-block" disabled={busy} onClick={() => run((b, f) => saveDocumentPdf(b, f))}>
          Salvar PDF
        </button>
        <button className="btn-secondary btn-block" disabled={busy} onClick={() => run((b) => openDocumentPdf(b))}>
          Abrir PDF
        </button>
        <button className="link-btn sheet-cancel" disabled={busy} onClick={onClose}>
          Cancelar
        </button>
      </div>
    </div>
  );
}
