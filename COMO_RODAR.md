# AS OS — App (Etapa 1: Autenticação)

Frontend React + Vite que conecta ao SEU Supabase já validado.

## Passo a passo (Windows 11)

### 1. Abrir a pasta no VS Code
Descompacte o projeto e abra a pasta no VS Code (Arquivo > Abrir Pasta).

### 2. Abrir o terminal
No VS Code: menu **Terminal > Novo Terminal**.

### 3. Instalar as dependências
No terminal, digite:
```
npm install
```
Espere terminar (cria a pasta node_modules).

### 4. Configurar as chaves do Supabase
- Copie o arquivo `.env.example` e renomeie a cópia para `.env`
- Abra o `.env` e preencha com as chaves do SEU projeto Supabase:
  - `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`
  - Encontre em: painel do Supabase > **Settings > API**
  - Use a **anon key** (NÃO a service_role)

### 5. Rodar o app
```
npm run dev
```
Abra no navegador o endereço que aparecer (geralmente http://localhost:5173).

## Testar
1. Clique em "Criar conta", preencha nome, nome do negócio, e-mail e senha.
2. Deve redirecionar para a Home ("Você está dentro").
3. No painel do Supabase (Table Editor), confira que nasceram:
   - 1 linha em `tenants` com o **nome do negócio** que você digitou
   - 1 linha em `users` com seu nome e role = administrator
   - 1 linha em `tenant_settings`
4. Saia e entre de novo com o mesmo e-mail/senha (testa o login).

## Importante
- No Supabase: Authentication > Providers > Email > **desligue "Confirm email"**
  durante os testes, senão o login não completa sem confirmar e-mail.

## Estrutura
- `src/shared/supabase.ts` — cliente único do Supabase (anon key)
- `src/shared/auth/` — lógica de autenticação (fora das telas)
- `src/modules/auth/ui/` — telas de login e cadastro
- `src/modules/home/ui/` — home placeholder
- `src/App.tsx` — rotas e proteção
