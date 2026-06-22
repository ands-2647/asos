// src/modules/auth/ui/LoginScreen.tsx
// Tela de login. Só apresentação — chama shared/auth, não fala com Supabase diretamente.

import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { signIn } from "../../../shared/auth/auth";

export function LoginScreen() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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

      {error && <div className="error-box">{error}</div>}

      <div className="field">
        <label>E-mail</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="voce@exemplo.com"
          autoCapitalize="none"
        />
      </div>

      <div className="field">
        <label>Senha</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
        />
      </div>

      <button className="btn-primary" onClick={handleSubmit} disabled={loading}>
        {loading ? "Entrando..." : "Entrar"}
      </button>

      <div className="link-row">
        Não tem conta? <Link to="/signup">Criar conta</Link>
      </div>
    </div>
  );
}
