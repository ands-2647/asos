// src/modules/auth/ui/LoginScreen.tsx
// Tela de login. Só apresentação — chama shared/auth, não fala com Supabase diretamente.

import { useState, useRef, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { signIn } from "../../../shared/auth/auth";

export function LoginScreen() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const errorRef = useRef<HTMLDivElement>(null);

  // F5: ao surgir um erro, leva o foco e rola suavemente até ele.
  useEffect(() => {
    if (error && errorRef.current) {
      errorRef.current.focus();
      errorRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [error]);

  async function handleSubmit() {
    setError(null);
    setLoading(true);
    const { error } = await signIn({ email, password });
    setLoading(false);
    if (error) setError(error);
    else navigate("/home");
  }

  return (
    <div className="screen">
      <div className="brand">
        <h1>AS OS</h1>
        <p>Ordem de serviço, sem complicação</p>
      </div>

      <div className="title">Entrar</div>
      <div className="subtitle">Acesse sua conta para continuar</div>

      {error && (
        <div ref={errorRef} className="error-box" role="alert" tabIndex={-1}>
          {error}
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSubmit();
        }}
      >
        <div className="field">
          <label htmlFor="login-email">E-mail</label>
          <input
            id="login-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="voce@exemplo.com"
            autoCapitalize="none"
            autoFocus
            enterKeyHint="next"
          />
        </div>

        <div className="field">
          <label htmlFor="login-password">Senha</label>
          <input
            id="login-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            enterKeyHint="done"
          />
        </div>

        <button className="btn-primary" type="submit" disabled={loading}>
          {loading ? "Entrando..." : "Entrar"}
        </button>
      </form>

      <div className="link-row">
        Não tem conta? <Link to="/signup">Criar conta</Link>
      </div>
    </div>
  );
}
