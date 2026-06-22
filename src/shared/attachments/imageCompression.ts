// src/shared/attachments/imageCompression.ts
// Compressão de imagem no navegador (canvas), antes do upload. Reduz a maior dimensão
// e a qualidade até caber no limite de bytes. Saída sempre em um tipo permitido.

export type CompressResult = { blob: Blob; type: string; ext: string };

const MAX_DIMENSION = 1600; // px na maior borda

// Comprime uma imagem para caber em maxBytes. PNG vira WEBP/JPEG para reduzir tamanho.
export async function compressImage(file: File, maxBytes: number): Promise<CompressResult> {
  const bitmap = await loadBitmap(file);

  const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas indisponível");
  ctx.drawImage(bitmap, 0, 0, width, height);

  // Preferimos WEBP quando suportado (melhor compressão); senão JPEG.
  const targetType = supportsWebp(canvas) ? "image/webp" : "image/jpeg";
  const ext = targetType === "image/webp" ? "webp" : "jpg";

  let quality = 0.82;
  let blob = await canvasToBlob(canvas, targetType, quality);

  // Reduz a qualidade em passos até caber no limite (piso de 0.4).
  while (blob.size > maxBytes && quality > 0.4) {
    quality -= 0.12;
    blob = await canvasToBlob(canvas, targetType, quality);
  }

  return { blob, type: targetType, ext };
}

function loadBitmap(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Não foi possível ler a imagem."));
    };
    img.src = url;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Falha ao gerar a imagem."))),
      type,
      quality
    );
  });
}

function supportsWebp(canvas: HTMLCanvasElement): boolean {
  try {
    return canvas.toDataURL("image/webp").startsWith("data:image/webp");
  } catch {
    return false;
  }
}
