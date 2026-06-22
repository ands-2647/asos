// src/shared/pdf/pdfMobile.ts
// Geração de PDF como Blob real para mobile/PWA (Compartilhar / Salvar / Abrir).
// Reaproveita o MESMO template (buildDocumentHtml) — layout e dados inalterados; apenas
// rasteriza o HTML em A4 via html2canvas + jsPDF, carregados por CDN em runtime (sem
// adicionar dependências ao projeto). No desktop, o fluxo de impressão (pdf.ts) é mantido.

import { loadPdfData } from "./pdf";
import { buildDocumentHtml } from "./template";

// CDN (import dinâmico): como a URL vem de variável, o TS trata como any (sem resolver módulo)
// e o Vite (@vite-ignore) deixa o browser buscar o ESM em runtime.
const HTML2CANVAS_URL = "https://esm.sh/html2canvas@1.4.1";
const JSPDF_URL = "https://esm.sh/jspdf@2.5.2";

export function isStandalone(): boolean {
  try {
    return (
      window.matchMedia?.("(display-mode: standalone)").matches === true ||
      (navigator as any).standalone === true
    );
  } catch {
    return false;
  }
}

export function isMobile(): boolean {
  return /iphone|ipad|ipod|android/i.test(navigator.userAgent || "");
}

// Deve usar o fluxo mobile (modal + Blob) em vez da impressão de desktop?
export function shouldUseMobilePdfFlow(): boolean {
  return isStandalone() || isMobile();
}

export function canShareFiles(): boolean {
  const n = navigator as any;
  return typeof n?.share === "function" && typeof n?.canShare === "function";
}

export type PdfBlobResult = { blob: Blob | null; filename: string; error: string | null };

export async function buildDocumentPdfBlob(documentId: string): Promise<PdfBlobResult> {
  const { data, error } = await loadPdfData(documentId);
  if (error || !data) return { blob: null, filename: "documento.pdf", error: error ?? "Falha ao carregar o documento." };

  // Converte a logo (URL assinada) para data URL — evita canvas "tainted" (CORS) no html2canvas.
  let logoUrl = data.company.logoUrl;
  if (logoUrl) {
    try {
      logoUrl = await toDataUrl(logoUrl);
    } catch {
      logoUrl = null;
    }
  }

  const html = buildDocumentHtml({ ...data, company: { ...data.company, logoUrl } });
  const numberPart = data.number != null ? `-${data.number}` : "";
  const filename = `${data.kindLabel}${numberPart}.pdf`.replace(/\s+/g, "-");

  try {
    const blob = await htmlToPdfBlob(html);
    return { blob, filename, error: null };
  } catch (e) {
    console.error("[pdfMobile] geração do blob falhou:", e);
    return { blob: null, filename, error: "Não foi possível gerar o PDF. Tente 'Abrir' como alternativa." };
  }
}

// ---- ações ----

export async function shareDocumentPdf(blob: Blob, filename: string): Promise<{ error: string | null }> {
  const n = navigator as any;
  const file = new File([blob], filename, { type: "application/pdf" });
  if (!(typeof n?.canShare === "function" && n.canShare({ files: [file] }))) {
    return { error: "Compartilhamento de arquivos não disponível neste dispositivo." };
  }
  try {
    await n.share({ files: [file], title: filename });
    return { error: null };
  } catch (e: any) {
    if (e?.name === "AbortError") return { error: null }; // usuário cancelou — ok
    console.error("[pdfMobile] share:", e);
    return { error: "Não foi possível compartilhar o PDF." };
  }
}

export function saveDocumentPdf(blob: Blob, filename: string): { error: string | null } {
  try {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    return { error: null };
  } catch (e) {
    console.error("[pdfMobile] save:", e);
    return { error: "Download bloqueado pelo navegador." };
  }
}

export function openDocumentPdf(blob: Blob): { error: string | null } {
  try {
    const url = URL.createObjectURL(blob);
    const w = window.open(url, "_blank");
    if (!w) return { error: "Permita pop-ups para abrir o PDF." };
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    return { error: null };
  } catch (e) {
    console.error("[pdfMobile] open:", e);
    return { error: "Não foi possível abrir o PDF." };
  }
}

// ---- helpers ----

async function toDataUrl(url: string): Promise<string> {
  const resp = await fetch(url);
  const blob = await resp.blob();
  return await new Promise<string>((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result));
    fr.onerror = () => reject(fr.error);
    fr.readAsDataURL(blob);
  });
}

async function htmlToPdfBlob(html: string): Promise<Blob> {
  const h2cMod: any = await import(/* @vite-ignore */ HTML2CANVAS_URL);
  const html2canvas = h2cMod.default ?? h2cMod;
  const jspdfMod: any = await import(/* @vite-ignore */ JSPDF_URL);
  const JsPDF = jspdfMod.jsPDF ?? jspdfMod.default;

  const iframe = document.createElement("iframe");
  iframe.style.cssText = "position:fixed;left:-10000px;top:0;width:794px;height:1123px;border:0;";
  document.body.appendChild(iframe);
  try {
    const doc = iframe.contentDocument;
    if (!doc) throw new Error("iframe sem documento");
    doc.open();
    doc.write(html);
    doc.close();
    // aguarda render + carregamento de imagens (logo embutida como data URL)
    await new Promise<void>((res) => setTimeout(res, 400));

    // captura o bloco de conteúdo (.page) — altura exata, sem o "vazio" do body que
    // criava uma 2ª página em branco.
    const target = (doc.querySelector(".page") as HTMLElement) || doc.body;
    const canvas = await html2canvas(target, {
      scale: 2,
      useCORS: true,
      backgroundColor: "#ffffff",
    });

    const pdf = new JsPDF("p", "mm", "a4");
    // margens A4 (alinhadas ao @page do template): 14mm laterais, 16mm topo/base
    const marginX = 14;
    const marginY = 16;
    const contentW = 210 - marginX * 2; // 182mm
    const contentH = 297 - marginY * 2; // 265mm
    const pxPerMm = canvas.width / contentW;
    const pageHpx = contentH * pxPerMm;

    // nº de páginas reais (tolerância de 2px evita uma página por causa de arredondamento)
    const totalPages = Math.max(1, Math.ceil((canvas.height - 2) / pageHpx));

    for (let i = 0; i < totalPages; i++) {
      const sy = i * pageHpx;
      const sliceHpx = Math.min(pageHpx, canvas.height - sy);
      if (sliceHpx <= 2) break; // nada relevante restante → não cria página em branco

      const slice = document.createElement("canvas");
      slice.width = canvas.width;
      slice.height = sliceHpx;
      const ctx = slice.getContext("2d");
      if (!ctx) throw new Error("canvas 2d indisponível");
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, slice.width, slice.height);
      ctx.drawImage(canvas, 0, sy, canvas.width, sliceHpx, 0, 0, canvas.width, sliceHpx);

      if (i > 0) pdf.addPage();
      pdf.addImage(slice.toDataURL("image/jpeg", 0.92), "JPEG", marginX, marginY, contentW, sliceHpx / pxPerMm);
    }
    return pdf.output("blob") as Blob;
  } finally {
    iframe.remove();
  }
}
