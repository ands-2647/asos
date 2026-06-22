// src/shared/admin/useIsAdmin.ts
// Hook que diz se o usuário logado é admin da plataforma AS OS. Usado pelo guard /admin.

import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { amIPlatformAdmin } from "./admin";

export function useIsAdmin(session: Session | null) {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    if (!session) {
      setIsAdmin(false);
      setLoading(false);
      return;
    }

    setLoading(true);
    amIPlatformAdmin().then((v) => {
      if (!active) return;
      setIsAdmin(v);
      setLoading(false);
    });

    return () => {
      active = false;
    };
  }, [session?.user.id]);

  return { isAdmin, loading };
}
