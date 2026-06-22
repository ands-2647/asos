// src/shared/auth/useSession.ts
// Reexporta o hook de sessão a partir do SessionProvider (fonte única, com dedupe).
// Mantido para compatibilidade com os imports existentes (telas/guards).

export { useSession } from "./SessionProvider";
