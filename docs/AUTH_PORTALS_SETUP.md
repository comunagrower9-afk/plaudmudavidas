# Arquitetura e Guia de Configuração: Autenticação de Clientes e Autorização Administrativa (Fase 1)

Este documento descreve a arquitetura de segurança, autenticação e autorização para o Portal do Cliente e o Painel Administrativo do **Plaud Note Brasil**, implementada na migration `20260804070000_create_admin_access_and_portal_rpcs.sql`.

---

## 1. Arquitetura Geral: Cliente vs. Administrador

O sistema adota o **Supabase Auth** como fonte canônica de identidade, combinando **Row Level Security (RLS)** restritiva e **RPCs transacionais seguras (SECURITY DEFINER)** para segregação total entre clientes finais e operadores administrativos.

```
+-----------------------------------------------------------------------------------+
|                                  SUPABASE AUTH                                    |
|                               (auth.users table)                                  |
+-----------------------------------------+-----------------------------------------+
                                          |
                   +----------------------+----------------------+
                   |                                             |
                   v                                             v
        [ PORTAL DO CLIENTE ]                          [ PAINEL ADMINISTRATIVO ]
  (Usuário com auth_user_id regular)             (auth_user_id presente em admin_users)
                   |                                             |
                   v                                             v
        +----------------------+                      +----------------------+
        |   RLS Filtrada por   |                      |     RPCs Seguras     |
        |   auth.uid() =       |                      |  (SECURITY DEFINER)  |
        |   customers.auth_uid |                      |  - admin_search_     |
        +----------+-----------+                      |  - admin_get_order   |
                   |                                  |  - admin_register_   |
                   v                                  +----------+-----------+
        +----------------------+                                 |
        | Apenas seus pedidos, |                                 v
        | itens e rastreios    |                      +----------------------+
        +----------------------+                      | Auditoria Imutável   |
                                                      | (append-only) em     |
                                                      |  admin_audit_events  |
                                                      +----------------------+
```

### Princípios Fundamentais de Segurança
1. **Zero Confiança no Frontend:** Nenhuma função aceita identificadores de usuário (`user_id`, `admin_user_id`), e-mails de destino ou permissões enviadas pelo cliente. Toda a identidade é derivada exclusivamente de `auth.uid()`.
2. **Isolamento Total e Imutabilidade das Tabelas Administrativas:**
   - `public.admin_users`: RLS habilitado sem políticas públicas; modificações diretas bloqueadas para clientes.
   - `public.admin_audit_events`: RLS habilitado sem políticas públicas; chave estrangeira `ON DELETE RESTRICT` (impede exclusão em cascata de histórico de auditoria) e permissões limitadas a `SELECT, INSERT` para `service_role` (sem `UPDATE` nem `DELETE`), operando como log estritamente append-only.
3. **Imutabilidade e Minimização de Dados (LGPD/Zero PII na Auditoria):** `public.admin_audit_events` registra estritamente o `admin_user_id`, a ação e identificadores operacionais (`order_id`, `result_status`), com `metadata` fixado em `{}`. CPF, telefone, endereço, tokens e payloads de webhook nunca são gravados em logs de auditoria.
4. **Menor Privilégio nas RPCs:** As funções administrativas baseadas em sessão (`public.current_user_is_admin`, `admin_search_orders`, `admin_get_order`, `admin_register_order_shipment`) são restritas ao papel `authenticated`. O `service_role` utiliza diretamente as funções canônicas de backend (como `public.register_order_shipment`).
5. **Segregação de Tokens:** O segredo `TRACKING_ADMIN_TOKEN` é de uso exclusivo de integrações backend máquina-a-máquina (Edge Functions) e **jamais** deve ser injetado nas variáveis de ambiente do frontend ou exposto no cliente React/Vite.

---

## 2. Método de Autenticação: Magic Link / OTP (One-Time Password)

Para máxima simplicidade e segurança sem senhas (passwordless), tanto clientes quanto administradores utilizam autenticação via **Email OTP / Magic Link**:
- O usuário informa o e-mail cadastrado.
- O Supabase envia um token numérico seguro de uso único de 6 dígitos.
- Ao validar o OTP, uma sessão JWT autenticada é gerada com `auth.uid()`.

---

## 3. Provisionamento e Gerenciamento de Administradores

Os administradores devem ser cadastrados previamente no Supabase Auth. Uma vez que a conta exista em `auth.users`, o privilégio administrativo é concedido inserindo o `auth_user_id` na tabela `public.admin_users`.

### A. Provisionar o Primeiro Administrador

Execute no **SQL Editor** do Dashboard do Supabase (ou via migração administrativa controlada):

```sql
-- Provisionamento seguro de Administrador via E-mail
INSERT INTO public.admin_users (auth_user_id)
SELECT id
FROM auth.users
WHERE lower(email) = lower('<ADMIN_EMAIL>')
ON CONFLICT (auth_user_id) DO NOTHING;
```

> [!IMPORTANT]
> Substitua `<ADMIN_EMAIL>` pelo e-mail do operador cadastrado no Supabase Auth. Nunca utilize e-mails fictícios ou credenciais em código-fonte.

### B. Listar Administradores Ativos

```sql
SELECT
  au.auth_user_id,
  u.email,
  au.created_at,
  u.last_sign_in_at
FROM public.admin_users au
JOIN auth.users u ON u.id = au.auth_user_id
ORDER BY au.created_at ASC;
```

### C. Revogar Acesso de um Administrador

```sql
DELETE FROM public.admin_users
WHERE auth_user_id = (
  SELECT id
  FROM auth.users
  WHERE lower(email) = lower('<ADMIN_EMAIL>')
);
```

---

## 4. Consultas Operacionais e Auditoria

### A. Consultar Histórico de Ações Administrativas

```sql
SELECT
  a.id,
  a.created_at,
  u.email AS admin_email,
  a.action,
  a.order_id,
  a.result_status,
  a.metadata
FROM public.admin_audit_events a
JOIN auth.users u ON u.id = a.admin_user_id
ORDER BY a.created_at DESC
LIMIT 50;
```

### B. Auditoria por Pedido Específico

```sql
SELECT
  a.created_at,
  u.email AS admin_email,
  a.action,
  a.result_status
FROM public.admin_audit_events a
JOIN auth.users u ON u.id = a.admin_user_id
WHERE a.order_id = '<ORDER_UUID>'
ORDER BY a.created_at DESC;
```

---

## 5. Matriz de Privilégios e Segurança

| Objeto / RPC | `anon` | `authenticated` (Cliente) | `authenticated` (Admin) | `service_role` |
| :--- | :---: | :---: | :---: | :---: |
| `schema private` | ❌ Sem acesso | ❌ Sem acesso | ❌ Sem acesso | ✅ USAGE |
| `table public.admin_users` | ❌ Bloqueado | ❌ Sem acesso | ❌ Sem acesso direto | ✅ SELECT, INSERT, UPDATE, DELETE |
| `table public.admin_audit_events` | ❌ Bloqueado | ❌ Sem acesso | ❌ Sem acesso direto | ✅ SELECT, INSERT (sem UPDATE/DELETE) |
| `public.current_user_is_admin()` | ❌ Bloqueado | ✅ Retorna `false` | ✅ Retorna `true` | ❌ Sem EXECUTE direto |
| `public.claim_customer_account()` | ❌ Bloqueado | ✅ Executa p/ seu e-mail | ✅ Executa p/ seu e-mail | ❌ Não aplicável |
| `public.admin_search_orders()` | ❌ Bloqueado | ❌ Erro `42501` | ✅ Executa | ❌ Sem EXECUTE direto |
| `public.admin_get_order()` | ❌ Bloqueado | ❌ Erro `42501` | ✅ Executa | ❌ Sem EXECUTE direto |
| `public.admin_register_order_shipment()` | ❌ Bloqueado | ❌ Erro `42501` | ✅ Executa + Audita | ❌ Sem EXECUTE direto |
| `public.register_order_shipment()` | ❌ Bloqueado | ❌ Bloqueado | ❌ Bloqueado direto | ✅ Executa |

---

## 6. Fluxo de Vinculação de Conta de Cliente (`claim_customer_account`)

Quando um cliente final compra no site com o e-mail `cliente@example.com` e posteriormente solicita um código OTP de acesso no portal:
1. O Supabase Auth autentica o cliente e gera um `auth.uid()`.
2. O frontend invoca `supabase.rpc('claim_customer_account')`.
3. A RPC obtém atomicamente o e-mail verificado de `auth.users` e associa `customers.auth_user_id = auth.uid()`.
4. A partir desse momento, as políticas RLS padrão permitem que o cliente consulte seus pedidos, itens e eventos de rastreamento com total isolamento.

---

## 7. Frontend e Rotas da Aplicação (Fase 2)

A aplicação React/Vite implementa uma estrutura SPA protegida com `react-router-dom`:

| Rota | Descrição | Proteção |
| :--- | :--- | :--- |
| `/` | Landing page oficial Plaud Note (com link "Acompanhar pedido") | Pública |
| `/entrar` | Login do cliente via código OTP de 6 dígitos | Pública |
| `/minha-conta` | Painel do cliente: lista de pedidos e status | `CustomerProtectedRoute` (RLS) |
| `/minha-conta/pedidos/:orderId` | Detalhes do pedido, itens, endereço e botão 17TRACK | `CustomerProtectedRoute` (RLS) |
| `/admin/login` | Login do operador administrativo via OTP | Pública |
| `/admin/pedidos` | Painel de operações: busca, detalhes e cadastro de rastreio | `AdminProtectedRoute` (RPC) |
| `*` | Página 404 personalizada na identidade visual Plaud Note | Pública |

### Configuração do Template de E-mail OTP no Supabase Dashboard
No painel do Supabase, acesse **Authentication > Email Templates > Magic Link / Confirmation**:
1. **Assunto do e-mail:** `Seu código de acesso — Plaud Note`
2. **Corpo do e-mail:** Copie o conteúdo de `supabase/templates/otp-login.html`.
3. O template utiliza a tag canônica `{{ .Token }}` que insere o código numérico de 6 dígitos de alta legibilidade.

### Configuração de Hospedagem (Vercel)
O arquivo `vercel.json` na raiz do projeto garante o redirecionamento de todas as rotas SPA para `/index.html`:
```json
{
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
```
