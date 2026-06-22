// src/modules/common/ui/ComingSoonScreen.tsx
// Placeholder temporário para destinos que serão construídos nas próximas etapas
// (ex.: Novo Cliente, Novo Atendimento). Mantém os atalhos da Home navegáveis.

import { useNavigate } from "react-router-dom";

export function ComingSoonScreen({ title }: { title: string }) {
  const navigate = useNavigate();
  return (
    <div className="screen">
      <div className="brand">
        <h1>AS OS</h1>
      </div>
      <div className="title">{title}</div>
      <div className="subtitle">Esta tela será construída na próxima etapa.</div>
      <button className="btn-secondary btn-block" onClick={() => navigate("/home")}>
        Voltar para a Home
      </button>
    </div>
  );
}
