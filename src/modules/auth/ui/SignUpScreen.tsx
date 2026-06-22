// src/modules/auth/ui/SignUpScreen.tsx
// Tela de cadastro. Passa nome e nome do negócio para o trigger 021 (via shared/auth).

import { useState, useRef, useEffect } from "react";
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
  const errorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (error && errorRef.current) {
      errorRef.current.focus();
      errorRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [error]);

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
          <label htmlFor="signup-name">Seu nome</label>
          <input id="signup-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Como você se chama" autoFocus autoCapitalize="words" enterKeyHint="next" />
        </div>

        <div className="field">
          <label htmlFor="signup-business">Nome do negócio</label>
          <input id="signup-business" value={businessName} onChange={(e) => setBusinessName(e.target.value)} placeholder="Ex.: Oficina do Anderson" enterKeyHint="next" />
        </div>

        <div className="field">
          <label htmlFor="signup-email">E-mail</label>
          <input id="signup-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@exemplo.com" autoCapitalize="none" enterKeyHint="next" />
        </div>

        <div className="field">
          <label htmlFor="signup-password">Senha</label>
          <input id="signup-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mínimo 6 caracteres" enterKeyHint="done" />
        </div>

        <button className="btn-primary" type="submit" disabled={loading}>
          {loading ? "Criando..." : "Criar conta"}
        </button>
      </form>

      <div className="link-row">
        Já tem conta? <Link to="/auth">Entrar</Link>
      </div>
    </div>
  );
}
