# Infraestrutura de E-mails Transacionais (Resend + Supabase Edge Functions)

Este documento descreve a arquitetura de alta confiabilidade, controle de concorrência com **Lock Atômico**, **Outbox Durável**, **Worker de Fila com Retries Progressivos**, controle por **Kill Switch** e proteção contra duplicidade para o envio de e-mails transacionais no projeto PLAUD NOTE.

---

## 1. Visão Geral da Arquitetura de Confiabilidade

O fluxo foi desenhado com base no padrão **Transactional Outbox**, garantindo que nenhum e-mail seja perdido mesmo em caso de falha de background ou reinicialização do runtime:

```
[Webhook da Vega Checkout]
        │
        ▼ (POST /functions/v1/vega-webhook)
[vega-webhook Edge Function]
        │
        ├── 1. Validação de Token e Idempotência do Webhook
        ├── 2. Persistência de Customers, Orders e Order Items
        ├── 3. Atualização do Webhook Event para 'processed'
        │
        ├── 4. [OUTBOX DURÁVEL SÍNCRONO]:
        │      Garante/Insere email_events ('queued') no PostgreSQL ANTES do retorno HTTP
        │
        ├── 5. Responde imediatamente à Vega (HTTP 200 OK)
        │
        └── 6. EdgeRuntime.waitUntil(...) [Disparo em Segundo Plano]
                 │
                 ├── Verifica Kill Switch (EMAIL_SENDING_ENABLED === "true")
                 │     ├── Se !== 'true': mantém 'queued' e encerra sem lock ou chamada externa
                 │     └── Se === 'true': prossegue
                 │
                 ├── [LOCK ATÔMICO CONDICIONAL]:
                 │      UPDATE email_events SET locked_at = now(), lock_token = uuid
                 │      WHERE status IN ('queued', 'failed')
                 │        AND (next_attempt_at IS NULL OR next_attempt_at <= now())
                 │        AND (locked_at IS NULL OR locked_at <= now() - 10 min)
                 │      RETURNING *
                 │
                 ├── Renderiza template HTML + Texto Puro (com escape XSS)
                 ├── Dispara chamada ao Resend SDK: resend.emails.send(payload, { idempotencyKey })
                 │
                 ├── Se Sucesso:
                 │     status = 'sent', provider_message_id = id, limpa lock
                 │
                 └── Se Falha / Erro Temporário:
                       status = 'failed', attempt_count++, calcula next_attempt_at (backoff), limpa lock
```

---

## 2. Lock Atômico e Concorrência

Para impedir que retries simultâneos da Vega ou execuções paralelas de Edge Functions disparem múltiplos e-mails ao mesmo destinatário:

1. **Lease de 10 Minutos:**
   O lock possui validade de 10 minutos (`locked_at`). Caso uma função seja interrompida abruptamente, o registro é automaticamente liberado para recuperação após 10 minutos.
2. **Exclusividade Garantida:**
   Apenas o processo que obtiver a linha retornada no `UPDATE ... RETURNING` (com o seu respectivo `lock_token` UUID) tem permissão de chamar a API do Resend.
3. **Imutabilidade de Estados Finais:**
   Registros com status `sent`, `delivered`, `bounced` e `complained` **nunca** atendem à cláusula `WHERE status IN ('queued', 'failed')` e são protegidos contra qualquer reenvio.

---

## 3. Worker de Fila e Retries Progressivos (`process-email-queue`)

A Edge Function interna `process-email-queue` é responsável por varrer periodicamente a fila de mensagens pendentes:

- **Segurança Estrita:** Não aceita parâmetros arbitrários de destinatário ou corpo de mensagem via payload HTTP. Todos os dados são carregados estritamente do banco de dados por `order_id`.
- **Backoff Progressivo:**
  - Tentativa 1: +1 minuto
  - Tentativa 2: +5 minutos
  - Tentativa 3: +15 minutos
  - Tentativa 4: +60 minutos
  - Tentativa 5: +180 minutos
  - Tentativas > 5: Esgotado (`next_attempt_at = null`, permanece como `failed` para inspeção humana).
- **Tratamento de `concurrent_idempotent_requests`:** É tratado como falha temporária elegível para retry automático no próximo ciclo.

---

## 4. Agendamento com Supabase Cron (pg_cron) — Futuro

Quando autorizado e após o deploy, a função de fila poderá ser agendada via `pg_cron` no Supabase:

```sql
-- Exemplo de agendamento a cada 2 minutos (NÃO APLICAR AGORA)
SELECT cron.schedule(
  'process-email-queue-every-2-min',
  '*/2 * * * *',
  $$
  SELECT
    net.http_post(
      url := 'https://<PROJECT-REF>.supabase.co/functions/v1/process-email-queue',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-cron-secret', '<CRON_SECRET>'
      ),
      body := '{}'::jsonb
    ) AS request_id;
  $$
);
```

---

## 5. Variáveis de Ambiente e Secrets

| Variável | Obrigatoriedade | Descrição | Exemplo |
| :--- | :--- | :--- | :--- |
| `RESEND_API_KEY` | **Obrigatória** | Chave de API do Resend. | `re_123456789...` |
| `RESEND_FROM_EMAIL` | **Obrigatória** | Remetente autenticado no domínio verificado. | `PLAUD NOTE <pedidos@plaudai.site>` |
| `RESEND_REPLY_TO_EMAIL` | *Opcional* | E-mail para onde irão as respostas do cliente. | `suporte@plaudai.site` |
| `EMAIL_SENDING_ENABLED` | **Kill Switch** | Deve ser exatamente `"true"` para liberar envios. | `"true"` |
| `CRON_SECRET` | *Opcional* | Segredo para autorizar execuções do worker via Cron. | `secret_token_123` |

---

## 6. Procedimento de Teste com Destinatário Controlado

Quando o domínio estiver verificado no Resend e você desejar validar o layout em uma caixa de entrada real:

1. Ative o envio:
   ```bash
   npx supabase secrets set EMAIL_SENDING_ENABLED="true"
   ```
2. Realize uma compra de teste com status `approved` na Vega Checkout utilizando o seu próprio e-mail pessoal.
3. Verifique o registro na tabela `email_events`:
   ```sql
   SELECT id, order_id, recipient, template_key, status, attempt_count, next_attempt_at, provider_message_id, sent_at, error_message
   FROM public.email_events
   ORDER BY created_at DESC
   LIMIT 5;
   ```
