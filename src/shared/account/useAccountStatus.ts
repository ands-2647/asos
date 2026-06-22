// src/shared/account/useAccountStatus.ts
// Hook que devolve o status do tenant logado (para o gate de rotas). Mesma forma do
// useOnboardingStatus: só avalia quando há sessão e reavalia ao trocar de usuário.

import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { getMyAccountStatus, type AccountStatus } from "./account";

export function useAccountStatus(session: Session | null) {
  const [status, setStatus] = useState<AccountStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    if (!session) {
      setStatus(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    getMyAccountStatus().then((s) => {
      if (!active) return;
      setStatus(s);
      setLoading(false);
    });

    return () => {
      active = false;
    };
  }, [session?.user.id]);

  return { status, loading };
}
