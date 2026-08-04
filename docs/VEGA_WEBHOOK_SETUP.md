# Configuração e Ingestão do Webhook da Vega Checkout

Este documento detalha o fluxo completo de ingestão e processamento da Edge Function `vega-webhook`, responsável por receber notificações da Vega Checkout e persistir clientes, pedidos e itens de forma segura, com processamento idempotente e recuperável por retry.

---

## 1. Visão Geral da Arquitetura e Ciclo de Vida

A Edge Function `vega-webhook` executa as seguintes etapas:
1. **Autenticação Segura:** Valida o secret `VEGA_WEBHOOK_TOKEN` via `safeCompare` (comparação em tempo constante com hashes SHA-256 de tamanho fixo).
2. **Cálculo de Idempotência:**
   - Se houver identificador exclusivo do evento: `vega:<external_event_id>`.
   - Caso contrário: `vega:<sha256(rawBody)>`.
   - Impede que diferentes transições da mesma venda colidam e assegura que retransmissões idênticas retornem `200 OK`.
3. **Tratamento Especial de Teste:**
   - Payloads contendo `test = true` e `event = "manual_test"` são autenticados, gravados como `status: 'ignored'` e finalizados sem tocar em pedidos/clientes.
4. **Sanitização Ampla de Dados Sensíveis:**
   - Remove do payload salvo em `webhook_events.payload`: `pix_code`, `pix_code_image64`, `customer.document`, `user_ip`, `user_agent`, `transaction_token`, `billet_digitable_line`, `order_url`, `billet_url`, `checkout_url` e quaisquer parâmetros com tokens.
   - **Nenhum documento de cliente (CPF/CNPJ)** é gravado em qualquer tabela.
5. **Proteção Contra Eventos Fora de Ordem e Regressão de Status:**
   - Extrai o timestamp de status da Vega (`provider_status_at`).
   - Se o evento for mais antigo que o status atual do pedido, marca como `ignored` e não modifica o pedido.
   - Impede regressão de status (ex: `pending`/`failed` não podem sobrescrever `paid`, `refunded` ou `chargeback`; `refunded` e `chargeback` são estados terminais).
6. **Resolução de Cliente (`customers`):**
   - Localiza por `email_normalized`.
   - Atualiza apenas se houver novos dados válidos (sem sobrescrever com nulo/vazio).
   - Preserva `auth_user_id` intacto.
7. **Criação/Atualização do Pedido (`orders`):**
   - Converte valores inteiros em centavos (`11990` -> `119.90`, `297` -> `2.97`) sem imprecisão de ponto flutuante.
   - `vega_order_id` e `order_number` mapeados a partir de `sale_code`.
   - Resolução de `paid_at`: utiliza exclusivamente `approved_at` válido (nunca inventa data com `now()`), preservando o valor já existente em atualizações.
   - Preserva status de envio (`fulfillment_status`, código de rastreio, datas de entrega) em caso de atualização de status de pagamento.
   - Metadata de pedidos isolada (sem tokens, URLs com token ou documentos).
8. **Validação e Upsert de Itens (`order_items`):**
   - Valida obrigatoriedade de identificador de produto (`id` ou `code`).
   - Upsert idempotente baseado na restrição `UNIQUE (order_id, external_product_id)`.
9. **Finalização:**
   - Marca o webhook como `status: 'processed'` com `processed_at`.

---

## 2. Passo 1: Aplicar a Nova Migration no Banco Remoto

Para garantir o upsert idempotente dos itens do pedido, foi criada a migration:
`supabase/migrations/20260804043000_add_order_items_unique_constraint.sql`.

Execute no terminal:

```bash
# 1. Conferir migrations pendentes
npx supabase migration list

# 2. Aplicar no Supabase remoto
npx supabase db push

# 3. Regenerar tipagem canônica do TypeScript
npx supabase gen types typescript --linked --schema public > src/types/database.types.ts
```

---

## 3. Passo 2: Configurar o Secret do Webhook

Defina o token secreto nas Edge Functions do Supabase:

```bash
npx supabase secrets set VEGA_WEBHOOK_TOKEN="SEU_TOKEN_SECRETO_AQUI"
```

---

## 4. Passo 3: Publicar a Edge Function Atualizada

Publique a versão com processamento completo:

```bash
npx supabase functions deploy vega-webhook --no-verify-jwt
```

---

## 5. URL de Cadastro na Vega Checkout

Cadastre no painel da Vega:

```text
https://<PROJECT_REF>.supabase.co/functions/v1/vega-webhook?token=<VEGA_WEBHOOK_TOKEN>
```

---

## 6. Consulta e Auditoria no SQL Editor do Supabase

### 6.1. Consultar Webhooks Recebidos
```sql
SELECT
  id,
  provider,
  event_type,
  idempotency_key,
  status,
  error_message,
  received_at,
  processed_at
FROM public.webhook_events
ORDER BY received_at DESC
LIMIT 10;
```

### 6.2. Consultar Pedidos e Clientes Gerados
```sql
SELECT
  o.order_number,
  o.payment_status,
  o.fulfillment_status,
  o.total,
  c.email,
  c.full_name,
  o.created_at
FROM public.orders o
JOIN public.customers c ON c.id = o.customer_id
ORDER BY o.created_at DESC
LIMIT 10;
```
