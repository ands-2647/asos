// src/shared/auth/auth.ts
// Lógica de autenticação. Fica FORA das telas (ARCHITECTURE_RULES: nenhuma regra de
// negócio dentro de telas). As telas apenas chamam estas funções.

import { supabase } from "../supabase";

export type SignUpInput = {
  name: string;          // nome da pessoa
  businessName: string;  // nome do negócio (vira tenants.name via trigger 021)
  email: string;
  password: string;
};

export type SignInInput = {
  email: string;
  password: string;
};

// Cadastro. Passa name e business_name em options.data — o trigger handle_new_auth_user
// (migration 021) lê esses campos de raw_user_meta_data para nomear o tenant e o usuário.
export async function signUp(input: SignUpInput): Promise<{ error: string | null }> {
  const { error } = await supabase.auth.signUp({
    email: input.email.trim(),
    password: input.password,
    options: {
      data: {
        name: input.name.trim(),
        business_name: input.businessName.trim(),
      },
    },
  });
  return { error: error ? translateError(error.message) : null };
}

export async function signIn(input: SignInInput): Promise<{ error: string | null }> {
  const { error } = await supabase.auth.signInWithPassword({
    email: input.email.trim(),
    password: input.password,
  });
  return { error: error ? translateError(error.message) : null };
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
}

// mensagens de erro comuns do Supabase Auth em português
function translateError(msg: string): string {
  const m = msg.toLowerCase();
  if (m.includes("invalid login credentials")) return "E-mail ou senha incorretos.";
  if (m.includes("user already registered")) return "Este e-mail já está cadastrado.";
  if (m.includes("password should be at least")) return "A senha deve ter ao menos 6 caracteres.";
  if (m.includes("unable to validate email")) return "E-mail inválido.";
  if (m.includes("email not confirmed")) return "E-mail ainda não confirmado.";
  return "Algo deu errado. Tente novamente.";
}
