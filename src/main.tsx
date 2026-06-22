import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";
import "./index.css";

// Error Boundary global: sem isto, qualquer exceção no render desmonta a árvore inteira
// e mostra uma tela branca sem mensagem (sintoma relatado no iOS). Agora o erro real
// (mensagem + stack + componente) aparece na própria tela — inclusive no iPhone.
type EBState = { error: Error | null; stack: string | null };

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, EBState> {
  state: EBState = { error: null, stack: null };

  static getDerivedStateFromError(error: Error): Partial<EBState> {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[AS OS] erro de render:", error, info.componentStack);
    this.setState({ stack: info.componentStack ?? null });
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 24, fontFamily: "system-ui, sans-serif", color: "#16243b", minHeight: "100vh" }}>
          <h1 style={{ fontSize: 18, color: "#cc3b2b", margin: "0 0 8px" }}>Ocorreu um erro</h1>
          <p style={{ fontSize: 14, margin: "0 0 12px" }}>{this.state.error.message}</p>
          <pre
            style={{
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              fontSize: 11,
              lineHeight: 1.5,
              background: "#f4f6fb",
              border: "1px solid #e4e8f0",
              padding: 12,
              borderRadius: 8,
              maxHeight: "50vh",
              overflow: "auto",
            }}
          >
            {String(this.state.error.stack || "")}
            {this.state.stack || ""}
          </pre>
          <button
            onClick={() => window.location.reload()}
            style={{ marginTop: 12, padding: "10px 18px", border: "none", borderRadius: 10, background: "#1f4a86", color: "#fff", fontWeight: 600 }}
          >
            Recarregar
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// Loga rejeições de Promise não tratadas (úteis no console do device via inspetor).
window.addEventListener("unhandledrejection", (e) => {
  console.error("[AS OS] promise rejeitada:", e.reason);
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
