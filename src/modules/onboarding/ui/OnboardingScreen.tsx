// src/modules/onboarding/ui/OnboardingScreen.tsx
// Etapa 2 — Onboarding. Wizard de 4 passos para completar os dados do negócio.
// Só apresentação: carrega/salva chamando shared/onboarding, nunca o Supabase direto.

import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  loadBusinessProfile,
  completeOnboarding,
  emptyProfile,
  type BusinessProfile,
} from "../../../shared/onboarding/onboarding";

const VERTICAIS = [
  "Oficina mecânica",
  "Funilaria e pintura",
  "Auto elétrica",
  "Ar-condicionado automotivo",
  "Serviços gerais",
];

const TOTAL = 4;

export function OnboardingScreen() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [p, setP] = useState<BusinessProfile>(emptyProfile);
  const [error, setError] = useState<string | null>(null);
  const [loadingInit, setLoadingInit] = useState(true);
  const [saving, setSaving] = useState(false);
  const errorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (error && errorRef.current) {
      errorRef.current.focus();
      errorRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [error]);

  useEffect(() => {
    loadBusinessProfile().then(({ data, error }) => {
      if (data) setP(data);
      if (error) setError(error);
      setLoadingInit(false);
    });
  }, []);

  function set<K extends keyof BusinessProfile>(key: K, value: BusinessProfile[K]) {
    setP((prev) => ({ ...prev, [key]: value }));
  }

  function next() {
    setError(null);
    if (step === 0 && !p.name.trim()) {
      setError("Informe o nome do negócio.");
      return;
    }
    setStep((s) => Math.min(s + 1, TOTAL - 1));
  }

  function back() {
    setError(null);
    setStep((s) => Math.max(s - 1, 0));
  }

  async function finish() {
    setError(null);
    if (!p.name.trim()) {
      setStep(0);
      setError("Informe o nome do negócio.");
      return;
    }
    setSaving(true);
    const { error } = await completeOnboarding(p);
    setSaving(false);
    if (error) setError(error);
    else navigate("/home", { replace: true });
  }

  if (loadingInit) return <div className="loading-screen">Carregando…</div>;

  const isLast = step === TOTAL - 1;

  return (
    <div className="screen">
      <div className="brand">
        <h1>AS OS</h1>
        <p>Vamos configurar seu negócio</p>
      </div>

      <div className="steps">
        {Array.from({ length: TOTAL }).map((_, i) => (
          <span key={i} className={"dot" + (i <= step ? " active" : "")} />
        ))}
      </div>

      {error && (
        <div ref={errorRef} className="error-box" role="alert" tabIndex={-1}>
          {error}
        </div>
      )}

      {/* Enter avança o passo (ou conclui no último); "Voltar" é type=button */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          isLast ? finish() : next();
        }}
      >
        {step === 0 && (
          <>
            <div className="step-head">
              <div className="title">Seu negócio</div>
              <div className="subtitle">Como ele aparece nas ordens de serviço</div>
            </div>
            <div className="field">
              <label htmlFor="onb-name">Nome do negócio</label>
              <input
                id="onb-name"
                value={p.name}
                onChange={(e) => set("name", e.target.value)}
                placeholder="Ex.: Oficina do Anderson"
                autoFocus
                autoCapitalize="words"
                enterKeyHint="next"
              />
            </div>
            <div className="field">
              <label htmlFor="onb-vertical">Ramo de atividade</label>
              <input
                id="onb-vertical"
                list="verticais"
                value={p.vertical}
                onChange={(e) => set("vertical", e.target.value)}
                placeholder="Ex.: Oficina mecânica"
                enterKeyHint="next"
              />
              <datalist id="verticais">
                {VERTICAIS.map((v) => (
                  <option key={v} value={v} />
                ))}
              </datalist>
              <div className="hint">Opcional</div>
            </div>
          </>
        )}

        {step === 1 && (
          <>
            <div className="step-head">
              <div className="title">Contato</div>
              <div className="subtitle">Aparece para o cliente no orçamento</div>
            </div>
            <div className="field">
              <label htmlFor="onb-whatsapp">WhatsApp</label>
              <input id="onb-whatsapp" value={p.whatsapp} onChange={(e) => set("whatsapp", e.target.value)} placeholder="(11) 90000-0000" inputMode="tel" autoFocus enterKeyHint="next" />
            </div>
            <div className="field">
              <label htmlFor="onb-phone">Telefone</label>
              <input id="onb-phone" value={p.phone} onChange={(e) => set("phone", e.target.value)} placeholder="(11) 3000-0000" inputMode="tel" enterKeyHint="next" />
            </div>
            <div className="field">
              <label htmlFor="onb-address">Endereço</label>
              <input id="onb-address" value={p.address} onChange={(e) => set("address", e.target.value)} placeholder="Rua, número, bairro, cidade" enterKeyHint="next" />
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <div className="step-head">
              <div className="title">Dados de cobrança</div>
              <div className="subtitle">Usados nos documentos e na cobrança</div>
            </div>
            <div className="field">
              <label htmlFor="onb-cnpj">CNPJ</label>
              <input id="onb-cnpj" value={p.cnpj} onChange={(e) => set("cnpj", e.target.value)} placeholder="00.000.000/0000-00" inputMode="numeric" autoFocus enterKeyHint="next" />
              <div className="hint">Opcional</div>
            </div>
            <div className="field">
              <label htmlFor="onb-pix">Chave Pix</label>
              <input id="onb-pix" value={p.pixKey} onChange={(e) => set("pixKey", e.target.value)} placeholder="CPF, CNPJ, e-mail, telefone ou chave aleatória" enterKeyHint="next" />
              <div className="hint">Opcional</div>
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <div className="step-head">
              <div className="title">Padrões de orçamento</div>
              <div className="subtitle">Aplicados automaticamente em cada novo orçamento</div>
            </div>
            <div className="field">
              <label htmlFor="onb-validity">Validade padrão (dias)</label>
              <input id="onb-validity" type="number" min={1} value={p.defaultValidityDays} onChange={(e) => set("defaultValidityDays", e.target.value)} placeholder="15" inputMode="numeric" autoFocus enterKeyHint="done" />
              <div className="hint">Opcional</div>
            </div>
            <div className="field">
              <label htmlFor="onb-obs">Observação padrão</label>
              <textarea id="onb-obs" value={p.defaultObservation} onChange={(e) => set("defaultObservation", e.target.value)} placeholder="Ex.: Garantia de 90 dias para peças e serviços." />
              <div className="hint">Opcional</div>
            </div>
          </>
        )}

        <div className="btn-row">
          {step > 0 && (
            <button type="button" className="btn-secondary" onClick={back} disabled={saving}>
              Voltar
            </button>
          )}
          {!isLast ? (
            <button type="submit" className="btn-primary">
              Continuar
            </button>
          ) : (
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? "Salvando..." : "Concluir"}
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
