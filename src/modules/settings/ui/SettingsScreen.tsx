// src/modules/settings/ui/SettingsScreen.tsx
// Configurações → Empresa. Só apresentação: lógica em shared/settings.
// Usa apenas campos existentes no banco. Logo via Storage (bucket attachments).

import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  loadCompanySettings,
  saveCompanySettings,
  uploadLogo,
  removeLogo,
  type CompanyInput,
} from "../../../shared/settings/settings";

const emptyForm: CompanyInput = {
  name: "",
  cnpj: "",
  phone: "",
  whatsapp: "",
  address: "",
  pixKey: "",
  pixOwnerName: "",
  pixBank: "",
  defaultValidityDays: "",
  defaultObservation: "",
};

export function SettingsScreen() {
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState<CompanyInput>(emptyForm);
  const [logoPath, setLogoPath] = useState<string | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [logoBusy, setLogoBusy] = useState(false);
  const errorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (error && errorRef.current) {
      errorRef.current.focus();
      errorRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [error]);

  useEffect(() => {
    loadCompanySettings().then(({ data, error }) => {
      if (error) setError(error);
      else if (data) {
        setForm({
          name: data.name,
          cnpj: data.cnpj,
          phone: data.phone,
          whatsapp: data.whatsapp,
          address: data.address,
          pixKey: data.pixKey,
          pixOwnerName: data.pixOwnerName,
          pixBank: data.pixBank,
          defaultValidityDays: data.defaultValidityDays,
          defaultObservation: data.defaultObservation,
        });
        setLogoPath(data.logoPath);
        setLogoUrl(data.logoUrl);
      }
      setLoading(false);
    });
  }, []);

  function set<K extends keyof CompanyInput>(key: K, value: CompanyInput[K]) {
    setOk(false);
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave() {
    setError(null);
    setOk(false);
    setSaving(true);
    const { error } = await saveCompanySettings(form);
    setSaving(false);
    if (error) setError(error);
    else setOk(true);
  }

  async function handleLogoFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError(null);
    setLogoBusy(true);
    const { url, error } = await uploadLogo(file, logoPath);
    setLogoBusy(false);
    if (error) {
      setError(error);
      return;
    }
    setLogoUrl(url);
    // recarrega o caminho persistido
    const reload = await loadCompanySettings();
    if (reload.data) setLogoPath(reload.data.logoPath);
  }

  async function handleLogoRemove() {
    if (!window.confirm("Remover a logo?")) return;
    setError(null);
    setLogoBusy(true);
    const { error } = await removeLogo(logoPath);
    setLogoBusy(false);
    if (error) {
      setError(error);
      return;
    }
    setLogoPath(null);
    setLogoUrl(null);
  }

  if (loading) return <div className="loading-screen">Carregando…</div>;

  return (
    <div className="screen screen-wide">
      <header className="home-top">
        <div>
          <button className="link-btn" onClick={() => navigate("/home")}>
            ← Início
          </button>
          <div className="home-hello">Configurações da empresa</div>
        </div>
      </header>

      {error && (
        <div ref={errorRef} className="error-box" role="alert" tabIndex={-1}>
          {error}
        </div>
      )}
      {ok && <div className="ok-box">Configurações salvas.</div>}

      {/* logo */}
      <div className="section-title">Logo</div>
      <div className="logo-row">
        {logoUrl ? (
          <img className="logo-preview" src={logoUrl} alt="logo" />
        ) : (
          <div className="logo-placeholder">Sem logo</div>
        )}
        <div className="logo-actions">
          <button className="btn-secondary btn-sm" disabled={logoBusy} onClick={() => fileRef.current?.click()}>
            {logoBusy ? "Enviando…" : logoPath ? "Trocar logo" : "Enviar logo"}
          </button>
          {logoPath && (
            <button className="btn-secondary btn-sm" disabled={logoBusy} onClick={handleLogoRemove}>
              Remover
            </button>
          )}
        </div>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        style={{ display: "none" }}
        onChange={handleLogoFile}
      />

      {/* dados */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSave();
        }}
      >
        <div className="section-title">Dados da empresa</div>
        <div className="field">
          <label htmlFor="set-name">Nome da empresa</label>
          <input id="set-name" value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Nome da empresa" autoFocus autoCapitalize="words" enterKeyHint="next" />
        </div>
        <div className="field">
          <label htmlFor="set-cnpj">CNPJ</label>
          <input id="set-cnpj" value={form.cnpj} onChange={(e) => set("cnpj", e.target.value)} placeholder="00.000.000/0000-00" inputMode="numeric" enterKeyHint="next" />
        </div>
        <div className="field">
          <label htmlFor="set-phone">Telefone</label>
          <input id="set-phone" value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="(11) 3000-0000" inputMode="tel" enterKeyHint="next" />
        </div>
        <div className="field">
          <label htmlFor="set-whatsapp">WhatsApp</label>
          <input id="set-whatsapp" value={form.whatsapp} onChange={(e) => set("whatsapp", e.target.value)} placeholder="(11) 90000-0000" inputMode="tel" enterKeyHint="next" />
        </div>
        <div className="field">
          <label htmlFor="set-address">Endereço</label>
          <input id="set-address" value={form.address} onChange={(e) => set("address", e.target.value)} placeholder="Rua, número, bairro, cidade" enterKeyHint="next" />
        </div>

        <div className="section-title">Cobrança e orçamento</div>
        <div className="field">
          <label htmlFor="set-pix">Chave Pix</label>
          <input id="set-pix" value={form.pixKey} onChange={(e) => set("pixKey", e.target.value)} placeholder="CPF, CNPJ, e-mail, telefone ou aleatória" enterKeyHint="next" />
        </div>
        <div className="field">
          <label htmlFor="set-pixowner">Favorecido (nome do Pix)</label>
          <input id="set-pixowner" value={form.pixOwnerName} onChange={(e) => set("pixOwnerName", e.target.value)} placeholder="Nome de quem recebe" autoCapitalize="words" enterKeyHint="next" />
          <div className="hint">Aparece na cobrança pelo WhatsApp. Opcional.</div>
        </div>
        <div className="field">
          <label htmlFor="set-pixbank">Banco (abreviado)</label>
          <input id="set-pixbank" value={form.pixBank} onChange={(e) => set("pixBank", e.target.value)} placeholder="Ex.: Bradesco, Nubank, Itaú" enterKeyHint="next" />
          <div className="hint">Opcional.</div>
        </div>
        <div className="field">
          <label htmlFor="set-validity">Validade padrão do orçamento (dias)</label>
          <input id="set-validity" type="number" min={1} value={form.defaultValidityDays} onChange={(e) => set("defaultValidityDays", e.target.value)} placeholder="15" inputMode="numeric" enterKeyHint="next" />
        </div>
        <div className="field">
          <label htmlFor="set-obs">Observação padrão</label>
          <textarea id="set-obs" value={form.defaultObservation} onChange={(e) => set("defaultObservation", e.target.value)} placeholder="Texto padrão para orçamentos/OS" />
        </div>

        <button className="btn-primary btn-block" type="submit" disabled={saving}>
          {saving ? "Salvando..." : "Salvar configurações"}
        </button>
      </form>
    </div>
  );
}
