# Checklist Manual de Publicação e Go-Live — Portais Plaud Note

Este documento contém o checklist operacional para ativação manual no Supabase Dashboard, Resend SMTP e Vercel.

> **Importante:** A migration `20260804070000_create_admin_access_and_portal_rpcs.sql` já está aplicada e as Edge Functions já estão publicadas. Não é necessário executar `db push` ou `functions deploy`.

---

## 1. Configuração do Supabase Auth (Dashboard)

Acesse **Authentication -> URL Configuration** e configure:

1. **Site URL:**
   - `https://www.plaudai.site`

2. **Redirect URLs (Allowlist):**
   - `https://www.plaudai.site/**`
   - `http://localhost:5173/**`
   - `http://127.0.0.1:5173/**`

Acesse **Authentication -> Providers -> Email** e configure:
- **Enable Email Provider:** Ativado (Enabled)
- **Confirm email:** Desativado (clientes entram via OTP de 6 dígitos)
- **OTP Expiry:** 600 segundos (10 minutos)
- **Rate Limits / Cooldown:** 60 segundos entre envios de código

Acesse **Authentication -> Email Templates -> Magic Link / Confirmation**:
- **Subject / Assunto:** `Seu código de acesso — Plaud Note`
- **Body / Template:** Copie e cole integralmente o conteúdo de `supabase/templates/otp-login.html` (utilizando literalmente `{{ .Token }}`).

---

## 2. Configuração do Resend SMTP no Supabase Auth

Para garantir alta entregabilidade dos códigos de acesso com o domínio verificado `plaudai.site`:

1. No painel do Resend, crie uma API Key exclusiva para o serviço de autenticação (ex: `supabase-auth-smtp`). Nunca versione essa chave no repositório.
2. Acesse **Supabase Dashboard -> Project Settings -> Authentication -> SMTP Settings**:
   - **Enable Custom SMTP:** Ativado
   - **Sender email:** `acesso@plaudai.site`
   - **Sender name:** `Plaud Note`
   - **Host:** `smtp.resend.com`
   - **Port:** `465` (SSL)
   - **User:** `resend`
   - **Password:** `<SUA_API_KEY_RESEND>`

---

## 3. Cadastro do Primeiro Administrador

Para conceder acesso ao Painel Administrativo (`/admin/login`), o usuário deve primeiro ter um registro em `auth.users` (por exemplo, solicitando OTP ou criado no dashboard Auth). Em seguida, execute no **SQL Editor** do Supabase:

```sql
-- Conceder privilégio administrativo ao operador
INSERT INTO public.admin_users (auth_user_id)
SELECT id
FROM auth.users
WHERE lower(email) = lower('admin@plaudai.site')
ON CONFLICT (auth_user_id) DO NOTHING;
```

> **Atenção:** Nunca utilize colunas inexistentes como `user_id`, `role` ou `notes`. A tabela `public.admin_users` possui a chave primária canônica `auth_user_id REFERENCES auth.users(id) ON DELETE CASCADE`.

Para testar se o usuário possui acesso administrativo ativo, execute:
```sql
SELECT public.current_user_is_admin();
```

---

## 4. Variáveis de Ambiente na Vercel

No painel do projeto na Vercel (**Project Settings -> Environment Variables**), configure para os ambientes **Production** e **Preview**:

- `VITE_SUPABASE_URL`: URL pública do seu projeto Supabase (ex: `https://xyzcompany.supabase.co`)
- `VITE_SUPABASE_PUBLISHABLE_KEY`: Chave pública anon do Supabase (ex: `eyJhbGciOi...`)

> **Segurança Estrita:** Nenhuma chave privada (`SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, `CRON_SECRET`) deve ser prefixada com `VITE_` ou exposta no frontend.

O deploy ocorrerá automaticamente através da integração Git já conectada.

---

## 5. Roteiro de Teste Manual Pós-Deploy

Execute o seguinte teste de fumaça de ponta a ponta:

1. **Login do Cliente (`/entrar`):**
   - Digite um e-mail cadastrado em compras.
   - Verifique o recebimento do código de 6 dígitos no e-mail.
   - Faça login e valide o acionamento de `claim_customer_account()`.
   - Acesse `/minha-conta` e veja a lista de pedidos.
   - Acesse os detalhes do pedido e valide itens, valores, endereço e botão 17TRACK.
   - Tente acessar `/minha-conta/pedidos/<UUID_DE_OUTRO_CLIENTE>` e verifique que a RLS bloqueia o acesso.

2. **Login Administrativo (`/admin/login`):**
   - Tente login com e-mail não administrador: deve ser bloqueado com mensagem clara.
   - Faça login com o e-mail de admin autorizado.
   - Acesse `/admin/pedidos` e busque por nome ou número de pedido.
   - Verifique alerta de endereço incompleto quando aplicável.
   - Cadastre um código de rastreamento fictício e verifique que o e-mail entra na fila (`queued`).

3. **Validação de Rotas Diretas na Vercel:**
   - Recarregue a página (F5) em `/minha-conta` e `/admin/pedidos` para garantir que o rewrite SPA não quebra assets estáticos nem gera erro 404.
   - Faça logout e teste a navegação em dispositivos móveis.

---

## 6. Recomendação Futura de Proteção (Anti-Abuso)

Para proteção adicional contra requisições abusivas de OTP nos formulários públicos, recomenda-se futuramente a ativação do Cloudflare Turnstile / hCaptcha no Supabase Auth (**Authentication -> Security -> Captcha Protection**), sem necessidade de alteração na estrutura de banco existente.
