// src/shared/monitoring/monitoring.ts
// Monitoramento de erros (Sentry) OPCIONAL, carregado via CDN oficial.
// - Não adiciona dependência npm nem afeta o `vite build` (nada é importado em tempo de build).
// - Ativa SOMENTE se VITE_SENTRY_DSN estiver definido; caso contrário é totalmente inerte.
// - Uma vez iniciado, o SDK do Sentry já captura automaticamente erros globais de JS e
//   rejeições de promessas não tratadas (navegação/async). Erros de render do React e da
//   geração de PDF são encaminhados manualmente via captureError().

declare global {
  interface Window {
    Sentry?: any;
  }
}

const DSN = import.meta.env.VITE_SENTRY_DSN as string | undefined;
// Bundle do navegador (inclui captura global de erros + unhandledrejection).
const SENTRY_CDN = "https://browser.sentry-cdn.com/7.119.0/bundle.min.js";

let ready = false;
const pending: Array<() => void> = [];

export function initMonitoring(): void {
  if (!DSN || typeof document === "undefined") return;
  if (document.getElementById("sentry-cdn")) return;

  const s = document.createElement("script");
  s.id = "sentry-cdn";
  s.src = SENTRY_CDN;
  s.crossOrigin = "anonymous";
  s.onload = () => {
    try {
      window.Sentry?.init({
        dsn: DSN,
        environment: import.meta.env.MODE,
        // sem tracing de performance por enquanto — só captura de erros
        tracesSampleRate: 0,
      });
      ready = true;
      pending.splice(0).forEach((fn) => fn());
    } catch (e) {
      console.warn("[monitoring] init do Sentry falhou:", e);
    }
  };
  s.onerror = () => console.warn("[monitoring] não foi possível carregar o Sentry (CDN).");
  document.head.appendChild(s);
}

// Envia um erro ao Sentry (no-op se desativado). Enfileira até o SDK terminar de carregar.
export function captureError(error: unknown, context?: Record<string, unknown>): void {
  if (!DSN) return;
  const run = () => {
    try {
      window.Sentry?.captureException(error, context ? { extra: context } : undefined);
    } catch {
      /* nunca deixar o monitoramento derrubar o app */
    }
  };
  if (ready) run();
  else pending.push(run);
}
