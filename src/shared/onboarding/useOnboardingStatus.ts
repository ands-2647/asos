// src/shared/onboarding/useOnboardingStatus.ts
// Hook que diz se o tenant logado já concluiu o onboarding. As telas/guards usam isto
// para decidir entre /onboarding e /home, sem falar direto com o Supabase.

import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { isOnboarded } from "./onboarding";

export function useOnboardingStatus(session: Session | null) {
  // null = ainda não sabemos; depende de haver sessão.
  const [onboarded, setOnboarded] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    if (!session) {
      setOnboarded(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    isOnboarded().then((v) => {
      if (!active) return;
      setOnboarded(v);
      setLoading(false);
    });

    return () => {
      active = false;
    };
    // Reavalia quando troca o usuário (login/logout).
  }, [session?.user.id]);

  return { onboarded, loading };
}
