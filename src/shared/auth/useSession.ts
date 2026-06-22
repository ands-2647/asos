// src/shared/auth/useSession.ts
// Hook que expõe a sessão atual e reage a login/logout. As telas usam isto para saber
// se há usuário logado, sem falar diretamente com o Supabase.

import { useEffect, useState } from "react";
import { supabase } from "../supabase";
import type { Session } from "@supabase/supabase-js";

export function useSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // sessão inicial
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    // reage a mudanças (login, logout, refresh)
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  return { session, loading };
}
