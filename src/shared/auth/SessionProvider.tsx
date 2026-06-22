// src/shared/auth/SessionProvider.tsx
// Fonte ÚNICA de sessão para todo o app. Antes, cada guard chamava useSession() e criava
// sua própria subscription onAuthStateChange + setState a cada evento — gerando uma
// tempestade de re-renders que fazia os <Navigate replace> chamarem history.replaceState()
// em excesso (o Safari/iOS limita a 100/10s e lança). Aqui assinamos UMA vez e só
// atualizamos o estado quando o token realmente muda (dedupe).
//
// Não altera regras de negócio nem o fluxo de autenticação — apenas como a sessão é
// compartilhada entre os componentes.

import { createContext, useContext, useEffect, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../supabase";

type SessionState = { session: Session | null; loading: boolean };

const SessionContext = createContext<SessionState>({ session: null, loading: true });

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const tokenRef = useRef<string | null>(null);

  useEffect(() => {
    let active = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      tokenRef.current = data.session?.access_token ?? null;
      setSession(data.session);
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      const token = s?.access_token ?? null;
      // dedupe: ignora eventos que não mudam a sessão de fato (evita o storm de re-render)
      if (token === tokenRef.current) return;
      tokenRef.current = token;
      setSession(s);
      setLoading(false);
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return <SessionContext.Provider value={{ session, loading }}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionState {
  return useContext(SessionContext);
}
