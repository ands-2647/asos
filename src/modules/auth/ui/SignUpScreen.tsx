// src/modules/auth/ui/SignUpScreen.tsx
// Tela de cadastro. Passa nome e nome do negócio para o trigger 021 (via shared/auth).

import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { signUp } from "../../../shared/auth/auth";

export function SignUpScreen() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    setError(null);
    if (!name.trim() || !businessName.trim()) {
      setError("Preencha seu nome e o nome do negócio.");
      return;
    }
    setLoading(true);
    const { error } = await signUp({ name, businessName, email, password });
    setLoading(false);
    if (error) setError(error);
    else navigate("/onboarding"); // recém-criado: vai configurar o negócio (Etapa 2)
  }

  return (
    <div className="screen">
      <div className="brand">
        <h1>AS OS</h1>
        <p>Comece em menos de um minuto</p>
      </div>

      <div className="title">Criar conta</div>
      <div className="subtitle">Seus dados ficam salvos e seguros</div>

      {error && <div className="error-box">{error}</div>}

      <div className="field">
        <label>Seu nome</label>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Como você se chama" />
      </div>

      <div className="field">
        <label>Nome do negócio</label>
        <input value={businessName} onChange={(e) => setBusinessName(e.target.value)} placeholder="Ex.: Oficina do Anderson" />
      </div>

      <div className="field">
        <label>E-mail</label>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@exemplo.com" autoCapitalize="none" />
      </div>

      <div className="field">
        <label>Senha</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Mínimo 6 caracteres"
          onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
        />
      </div>

      <button className="btn-primary" onClick={handleSubmit} disabled={loading}>
        {loading ? "Criando..." : "Criar conta"}
      </button>

      <div className="link-row">
        Já tem conta? <Link to="/auth">Entrar</Link>
      </div>
    </div>
  );
}
