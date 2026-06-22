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

      {error && <div className="error-box">{error}</div>}
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
      <div className="section-title">Dados da empresa</div>
      <div className="field">
        <label>Nome da empresa</label>
        <input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Nome da empresa" />
      </div>
      <div className="field">
        <label>CNPJ</label>
        <input value={form.cnpj} onChange={(e) => set("cnpj", e.target.value)} placeholder="00.000.000/0000-00" inputMode="numeric" />
      </div>
      <div className="field">
        <label>Telefone</label>
        <input value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="(11) 3000-0000" inputMode="tel" />
      </div>
      <div className="field">
        <label>WhatsApp</label>
        <input value={form.whatsapp} onChange={(e) => set("whatsapp", e.target.value)} placeholder="(11) 90000-0000" inputMode="tel" />
      </div>
      <div className="field">
        <label>Endereço</label>
        <input value={form.address} onChange={(e) => set("address", e.target.value)} placeholder="Rua, número, bairro, cidade" />
      </div>

      <div className="section-title">Cobrança e orçamento</div>
      <div className="field">
        <label>Chave Pix</label>
        <input value={form.pixKey} onChange={(e) => set("pixKey", e.target.value)} placeholder="CPF, CNPJ, e-mail, telefone ou aleatória" />
      </div>
      <div className="field">
        <label>Validade padrão do orçamento (dias)</label>
        <input type="number" min={1} value={form.defaultValidityDays} onChange={(e) => set("defaultValidityDays", e.target.value)} placeholder="15" />
      </div>
      <div className="field">
        <label>Observação padrão</label>
        <textarea value={form.defaultObservation} onChange={(e) => set("defaultObservation", e.target.value)} placeholder="Texto padrão para orçamentos/OS" />
      </div>

      <button className="btn-primary btn-block" onClick={handleSave} disabled={saving}>
        {saving ? "Salvando..." : "Salvar configurações"}
      </button>
    </div>
  );
}
