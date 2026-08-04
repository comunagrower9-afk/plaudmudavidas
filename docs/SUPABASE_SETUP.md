# Guia de Configuração e Governança do Supabase

Este documento detalha o fluxo oficial para configuração, vinculação, gerenciamento de migrations, tipos TypeScript e governança de segurança do **Supabase** no projeto PLAUD Note.

---

## 1. Pré-requisitos

1. **Node.js**: Versão 18+ (já configurado no projeto).
2. **Supabase CLI**: Instalado localmente como dependência de desenvolvimento (`npx supabase` ou scripts do `package.json`).
3. **Docker Desktop** *(Opcional)*: Necessário apenas se você desejar rodar o banco de dados e autenticação localmente na sua máquina (`npm run supabase:start`). Para vincular e aplicar migrations diretamente no projeto da nuvem (Supabase Cloud), o Docker **não** é obrigatório.

---

## 2. Criação do Projeto no Supabase Dashboard

1. Acesse [https://supabase.com/dashboard](https://supabase.com/dashboard) e faça login.
2. Clique em **"New project"**.
3. Escolha a organização, dê um nome ao projeto (ex: `plaud-note-production`) e defina uma senha forte para o banco de dados (guarde essa senha em um cofre seguro).
4. Selecione a região mais próxima do seu público (ex: `sa-east-1` - São Paulo).
5. Aguarde alguns minutos até o provisionamento ser concluído.

---

## 3. Configuração das Variáveis de Ambiente

### 3.1. Desenvolvimento Local (`.env.local`)
1. No Dashboard do Supabase, vá em **Project Settings** > **API**.
2. Copie o **Project URL** e a chave **Project API Keys (anon / publishable)**.
3. Crie o arquivo `.env.local` na raiz do projeto (este arquivo já está no `.gitignore` e nunca será enviado ao Git):

```bash
VITE_SUPABASE_URL=https://xxxxxxxxxxxxxxxx.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sbp_xxxxxxxxxxxxxxxxxxxx
```

> [!CAUTION]
> **NUNCA** coloque a chave `service_role`, credenciais de Webhook da Vega ou tokens do Resend no frontend (`.env.local` ou qualquer variável `VITE_*`). Variáveis com prefixo `VITE_` são embutidas no bundle JavaScript público e visíveis a qualquer visitante.

### 3.2. Produção na Vercel
1. Acesse o painel do seu projeto na [Vercel](https://vercel.com).
2. Vá em **Settings** > **Environment Variables**.
3. Adicione as mesmas duas variáveis para os ambientes **Production**, **Preview** e **Development**:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_PUBLISHABLE_KEY`
4. Faça um novo Deploy para que as variáveis passem a valer no build de produção.

### 3.3. Configurações de Autenticação e Redirecionamento (Hospedado vs Local)
- **Ambiente Local (`supabase/config.toml`):** Configurado para `site_url = "http://localhost:5173"`, redirects permitidos para `localhost:5173` e `enable_confirmations = true`.
- **Ambiente Hospedado (Supabase Cloud Dashboard):** O arquivo `config.toml` NÃO altera automaticamente a nuvem. No Supabase Dashboard:
  1. Vá em **Authentication** > **URL Configuration**.
  2. Em **Site URL**, configure `https://www.plaudai.site` (ou seu domínio de produção).
  3. Em **Redirect URLs**, adicione `https://www.plaudai.site/**`, `http://localhost:5173/**`, etc.
  4. Em **Authentication** > **Providers** > **Email**, certifique-se de que a opção **"Confirm email"** está ativada.

---

## 4. Autenticação e Vinculação do Supabase CLI

### 4.1. Login no CLI (sem salvar tokens no repositório)
Execute o comando abaixo. Ele abrirá o navegador para gerar e salvar um token pessoal de acesso no seu computador de forma segura:

```bash
npx supabase login
```

### 4.2. Vincular ao Projeto Remoto
Copie o **Reference ID** do seu projeto (encontrado em **Project Settings** > **General** ou na URL do dashboard: `https://supabase.com/dashboard/project/<PROJECT_REF>`):

```bash
npx supabase link --project-ref <PROJECT_REF>
```
*O CLI solicitará a senha do banco de dados configurada na criação do projeto.*

---

## 5. Gestão de Migrations e Banco de Dados

Toda alteração estrutural no banco de dados deve ser feita exclusivamente via migrations versionadas no repositório (`supabase/migrations/`). Nunca crie ou altere tabelas manualmente pelo Table Editor do Dashboard.

### 5.1. Migrations Existentes na Fundação
1. `20260804032158_create_order_tracking_schema.sql`:
   - Enums: `payment_status_enum`, `fulfillment_status_enum`, `email_status_enum`, `webhook_status_enum`.
   - Tabelas: `customers`, `orders`, `order_items`, `tracking_events`, `email_events`, `webhook_events`.
   - Restrição de moeda: `CHECK (currency ~ '^[A-Z]{3}$')`.
   - Triggers automáticos de `updated_at`.
   - Índices de alta performance e integridade (ex: índice único parcial em `webhook_events(provider, external_event_id)`).
2. `20260804032218_create_order_tracking_rls_and_functions.sql`:
   - Ativação de Row Level Security (RLS) em 100% das tabelas públicas.
   - Políticas de isolamento por cliente autenticado com subqueries otimizadas: `(SELECT auth.uid())`.
   - Revogação explícita de privilégios de `anon` e `authenticated`, concedendo apenas `SELECT` em tabelas do cliente para `authenticated`.
   - Tabelas de backend (`webhook_events` e `email_events`) blindadas sem permissões para o frontend.
   - Função RPC `claim_customer_account()`:
     - Executa com `SECURITY DEFINER` e `SET search_path = ''` (imune a search_path hijacking).
     - Valida `auth.users.email` e exige `email_confirmed_at IS NOT NULL`.
     - Vínculo 100% atômico com `SELECT ... FOR UPDATE` e cláusula `WHERE (auth_user_id IS NULL OR auth_user_id = auth.uid())`.
     - Previne condições de corrida e garante os retornos: `claimed`, `already_claimed`, `not_found`, `conflict`.

### 5.2. Como Conferir Migrations Pendentes
Antes de aplicar qualquer alteração no banco remoto, liste o status das migrations:

```bash
npx supabase migration list
```

### 5.3. Como Aplicar Migrations no Supabase Remoto
Após revisar os arquivos SQL e verificar a lista de pendências:

```bash
npx supabase db push
```

### 5.4. Como Criar Novas Migrations ou Reverter Alterações
Se no futuro for necessário alterar uma tabela, adicionar uma coluna ou corrigir uma migration já aplicada:
1. **NUNCA** edite arquivos de migrations passadas que já foram executadas no ambiente remoto.
2. Crie uma nova migration com timestamp:
   ```bash
   npm run supabase:new-migration -- nome_da_alteracao
   ```
3. Escreva as instruções corretivas ou de evolução no arquivo gerado em `supabase/migrations/`.
4. Revise e aplique com `npx supabase db push`.

---

## 6. Geração de Tipos TypeScript

> [!NOTE]
> O arquivo `src/types/database.types.ts` atual é **provisório** (placeholder manual). Os tipos de resposta da RPC estão modularizados em `src/types/auth.types.ts`.

Após aplicar as migrations no Supabase (remoto ou local com Docker), gere os tipos oficiais canônicos:

### Gerar a partir do projeto remoto:
```bash
npx supabase gen types typescript --project-id <PROJECT_REF> > src/types/database.types.ts
```

### Gerar a partir do banco local (com Docker):
```bash
npm run supabase:gen-types
```

---

## 7. Onde Configurar Secrets de Backend (Vega e Resend)

As integrações futuras de Webhook da Vega e envio de e-mails pelo Resend serão executadas em **Supabase Edge Functions** (Deno server-side).

As credenciais secretas nunca devem ir para o frontend ou repositório. Elas devem ser configuradas como **Edge Function Secrets**:

### Via CLI:
```bash
npx supabase secrets set VEGA_WEBHOOK_SECRET="seu_secret_aqui"
npx supabase secrets set RESEND_API_KEY="re_xxxxxxxxxxxx"
```

### Via Dashboard:
Acesse **Project Settings** > **Edge Functions** > **Secrets** e adicione as chaves necessárias.

---

## 8. Resumo dos Scripts Disponíveis no `package.json`

| Comando | Descrição |
| :--- | :--- |
| `npm run supabase:new-migration -- <nome>` | Cria uma nova migration versionada com timestamp |
| `npm run supabase:gen-types` | Regenera a tipagem TypeScript em `src/types/database.types.ts` |
| `npm run supabase:lint` | Executa análise estática nas migrations SQL |
| `npm run supabase:start` | Inicia o stack do Supabase localmente (requer Docker) |
| `npm run supabase:stop` | Para o stack do Supabase local |
| `npm run supabase:reset` | Reseta o banco de dados **local** e roda migrations + seed |
