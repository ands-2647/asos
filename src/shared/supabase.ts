// src/shared/supabase.ts
// Cliente Supabase ÚNICO do app (frontend). Usa a ANON KEY (nunca a service role).
// As chaves vêm do .env (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY) — nunca hardcoded.

import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error(
    "Variáveis do Supabase ausentes. Copie .env.example para .env e preencha " +
      "VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY (painel Supabase > Settings > API)."
  );
}

// Storage resiliente para o iOS/Safari.
// Em contexto não-seguro (http em IP da LAN), modo privado ou "Bloquear todos os cookies",
// o Safari LANÇA ao acessar localStorage. Como o supabase-js persiste a sessão logo após o
// login, essa exceção derrubava o app (tela branca). Aqui detectamos isso uma única vez e
// caímos para um storage em memória — a sessão funciona na sessão atual sem quebrar o render.
function resilientStorage() {
  const memory = new Map<string, string>();
  const memoryStorage = {
    getItem: (k: string) => (memory.has(k) ? memory.get(k)! : null),
    setItem: (k: string, v: string) => void memory.set(k, v),
    removeItem: (k: string) => void memory.delete(k),
  };

  try {
    if (typeof window === "undefined" || !window.localStorage) return memoryStorage;
    const probe = "__as_os_probe__";
    window.localStorage.setItem(probe, "1");
    window.localStorage.removeItem(probe);
    return window.localStorage;
  } catch {
    console.warn("[AS OS] localStorage indisponível (iOS/privado) — usando storage em memória.");
    return memoryStorage;
  }
}

export const supabase = createClient(url, anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false, // não usamos magic link / OAuth redirect
    storage: resilientStorage(),
  },
});
