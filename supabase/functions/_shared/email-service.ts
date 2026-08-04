import type { SupabaseClient } from "@supabase/supabase-js"
import {
  generateEmailIdempotencyKey,
  generateResendIdempotencyKey,
  sanitizeErrorMessage,
} from "./email-utils.ts"
import { getEmailRenderer, renderOrderConfirmedEmail } from "./email-templates/index.ts"

/**
 * Inicializador da versão fixada do SDK oficial do Resend para Deno / Supabase Edge Runtime
 */
async function initResendClient(apiKey: string): Promise<EmailSenderClient> {
  const { Resend } = await import("npm:resend@4")
  return new Resend(apiKey) as unknown as EmailSenderClient
}

/**
 * Contratos tipados mínimos para envio e injeção em testes
 */
export interface EmailPayload {
  from: string
  to: string[]
  replyTo?: string
  subject: string
  html: string
  text: string
}

export interface EmailSendOptions {
  idempotencyKey?: string
}

export interface EmailSendResult {
  data: { id: string } | null
  error: { message: string; name?: string } | null
}

export interface EmailSenderClient {
  emails: {
    send(payload: EmailPayload, options?: EmailSendOptions): Promise<EmailSendResult>
  }
}

export interface EnsureEmailQueuedOptions {
  orderId: string
  recipientEmail: string
  templateKey?: string
  supabaseAdmin: SupabaseClient
}

export interface EmailQueuedResult {
  emailEventId: string
  idempotencyKey: string
  status: string
  isNew: boolean
}

export interface ProcessEmailOptions {
  emailEventId?: string
  orderId?: string
  supabaseAdmin: SupabaseClient
  resendClient?: EmailSenderClient
  env?: {
    EMAIL_SENDING_ENABLED?: string
    RESEND_API_KEY?: string
    RESEND_FROM_EMAIL?: string
    RESEND_REPLY_TO_EMAIL?: string
  }
}

export interface EmailProcessResult {
  success: boolean
  skipped?: boolean
  reason?: string
  messageId?: string
  error?: string
}

export interface QueueProcessSummary {
  totalEligible: number
  processed: number
  sent: number
  failed: number
  skipped: number
}

// Configurações de Retry e Concorrência
export const LOCK_LEASE_MS = 10 * 60 * 1000 // 10 minutos
export const MAX_ATTEMPTS = 5

/**
 * Calcula o próximo timestamp de tentativa com backoff progressivo
 * Tentativa 1: +1 minuto
 * Tentativa 2: +5 minutos
 * Tentativa 3: +15 minutos
 * Tentativa 4: +60 minutos
 * Tentativa 5: sem novo retry (retorna null)
 */
export function calculateNextAttemptAt(attemptCount: number, fromDate = new Date()): string | null {
  if (attemptCount >= MAX_ATTEMPTS) {
    return null
  }

  const backoffMinutesMap = [1, 5, 15, 60]
  const backoffMinutes = backoffMinutesMap[attemptCount - 1] ?? 60
  const nextDate = new Date(fromDate.getTime() + backoffMinutes * 60 * 1000)
  return nextDate.toISOString()
}

/**
 * 1. OUTBOX DURÁVEL: Garante a criação do registro 'queued' no banco de dados
 * Executado de forma SÍNCRONA antes do retorno HTTP 200 à Vega.
 */
export async function ensureOrderConfirmedEmailQueued({
  orderId,
  recipientEmail,
  templateKey = "order_confirmed",
  supabaseAdmin,
}: EnsureEmailQueuedOptions): Promise<EmailQueuedResult> {
  const idempotencyKey = generateEmailIdempotencyKey(orderId, templateKey)
  const normalizedEmail = recipientEmail.trim().toLowerCase()

  // 1.1. Tenta inserir novo evento como 'queued'
  const { data: insertedEvent, error: insertError } = await supabaseAdmin
    .from("email_events")
    .insert({
      order_id: orderId,
      recipient: normalizedEmail,
      template_key: templateKey,
      idempotency_key: idempotencyKey,
      status: "queued",
      attempt_count: 0,
      metadata: { attempt_count: 0 },
    })
    .select("id, status, idempotency_key")
    .single()

  if (insertError) {
    if (insertError.code === "23505" || insertError.message?.includes("idempotency_key")) {
      // 1.2. Concorrência: busca o registro já existente
      const { data: existingEvent, error: fetchError } = await supabaseAdmin
        .from("email_events")
        .select("id, status, idempotency_key")
        .eq("idempotency_key", idempotencyKey)
        .single()

      if (fetchError || !existingEvent) {
        throw new Error(`Failed to fetch existing email_event after 23505 conflict: ${sanitizeErrorMessage(fetchError?.message)}`)
      }

      return {
        emailEventId: existingEvent.id,
        idempotencyKey: existingEvent.idempotency_key,
        status: existingEvent.status,
        isNew: false,
      }
    }

    throw new Error(`Failed to insert email_event outbox record: ${sanitizeErrorMessage(insertError.message)}`)
  }

  return {
    emailEventId: insertedEvent.id,
    idempotencyKey: insertedEvent.idempotency_key,
    status: insertedEvent.status,
    isNew: true,
  }
}

/**
 * 2. LOCK ATÔMICO CONDICIONADO:
 * Adquire exclusividade de execução com lease de 10 minutos e limite de tentativas.
 * Impede que duas execuções simultâneas chamem o Resend para o mesmo e-mail.
 */
export async function acquireEmailLock(
  emailEventId: string,
  supabaseAdmin: SupabaseClient
): Promise<{ acquired: boolean; lockedRow: Record<string, unknown> | null; lockToken: string | null }> {
  const now = new Date()
  const nowIso = now.toISOString()
  const leaseThresholdIso = new Date(now.getTime() - LOCK_LEASE_MS).toISOString()
  const lockToken = crypto.randomUUID()

  // Atualização atômica condicional:
  // - status em queued ou failed
  // - attempt_count < MAX_ATTEMPTS
  // - next_attempt_at nulo ou já vencido
  // - lock nulo ou expirado (> 10 minutos)
  const { data: lockedRows, error } = await supabaseAdmin
    .from("email_events")
    .update({
      locked_at: nowIso,
      lock_token: lockToken,
    })
    .eq("id", emailEventId)
    .in("status", ["queued", "failed"])
    .lt("attempt_count", MAX_ATTEMPTS)
    .or(`next_attempt_at.is.null,next_attempt_at.lte.${nowIso}`)
    .or(`locked_at.is.null,locked_at.lte.${leaseThresholdIso}`)
    .select("id, order_id, recipient, template_key, status, attempt_count, metadata, idempotency_key")

  if (error) {
    console.error(`[email-service] Error acquiring lock for event '${emailEventId}':`, sanitizeErrorMessage(error))
    return { acquired: false, lockedRow: null, lockToken: null }
  }

  if (!lockedRows || lockedRows.length === 0) {
    return { acquired: false, lockedRow: null, lockToken: null }
  }

  return {
    acquired: true,
    lockedRow: lockedRows[0] as Record<string, unknown>,
    lockToken: lockToken,
  }
}

/**
 * 3. PROCESSAMENTO DE UM EVENTO DE E-MAIL COM LOCK E RESEND
 */
export async function processSingleEmailEvent({
  emailEventId,
  orderId,
  supabaseAdmin,
  resendClient,
  env,
}: ProcessEmailOptions): Promise<EmailProcessResult> {
  const getEnv = (key: string): string | undefined => {
    if (env && key in env) return env[key as keyof typeof env]
    if (typeof Deno !== "undefined" && typeof Deno.env?.get === "function") {
      return Deno.env.get(key)
    }
    return undefined
  }

  // 3.1. Validação do KILL SWITCH antes de qualquer lock ou validação estrita de credenciais
  const isSendingEnabled = getEnv("EMAIL_SENDING_ENABLED") === "true"
  if (!isSendingEnabled) {
    console.log("[email-service] EMAIL_SENDING_ENABLED is not 'true'. Email event remains queued without acquiring lock or calling Resend.")
    return {
      success: true,
      skipped: true,
      reason: "kill_switch_disabled",
    }
  }

  // 3.2. Identifica o emailEventId caso apenas o orderId tenha sido fornecido
  let targetEventId = emailEventId
  if (!targetEventId && orderId) {
    const idempotencyKey = generateEmailIdempotencyKey(orderId, "order_confirmed")
    const { data: foundEvent } = await supabaseAdmin
      .from("email_events")
      .select("id, status")
      .eq("idempotency_key", idempotencyKey)
      .maybeSingle()

    if (!foundEvent) {
      return { success: false, error: "Email event not found for order" }
    }
    if (foundEvent.status === "sent" || foundEvent.status === "delivered") {
      return { success: true, skipped: true, reason: `already_${foundEvent.status}` }
    }
    targetEventId = foundEvent.id
  }

  if (!targetEventId) {
    return { success: false, error: "Missing emailEventId and orderId" }
  }

  // 3.3. Tenta adquirir o Lock Atômico
  const { acquired, lockedRow, lockToken } = await acquireEmailLock(targetEventId, supabaseAdmin)
  if (!acquired || !lockedRow || !lockToken) {
    console.log(`[email-service] Lock could not be acquired for event '${targetEventId}' (already locked, sent, max attempts reached, or not ready). Skipping execution.`)
    return {
      success: true,
      skipped: true,
      reason: "lock_not_acquired_or_not_eligible",
    }
  }

  const currentAttempt = (Number(lockedRow.attempt_count) || 0) + 1
  const existingMeta = (lockedRow.metadata && typeof lockedRow.metadata === "object")
    ? (lockedRow.metadata as Record<string, unknown>)
    : {}
  const targetOrderId = String(lockedRow.order_id)
  const recipientEmail = String(lockedRow.recipient).trim()

  try {
    // 3.4. Validação estrita das Configurações do Resend
    const resendApiKey = getEnv("RESEND_API_KEY")?.trim()
    const resendFromEmail = getEnv("RESEND_FROM_EMAIL")?.trim()
    const resendReplyTo = getEnv("RESEND_REPLY_TO_EMAIL")?.trim()

    if (!resendApiKey || !resendFromEmail || !resendReplyTo) {
      throw new Error("Missing required email configuration: RESEND_API_KEY, RESEND_FROM_EMAIL or RESEND_REPLY_TO_EMAIL")
    }

    // 3.5. Busca os dados canônicos do banco de dados exclusivamente por order_id
    const { data: order, error: orderFetchError } = await supabaseAdmin
      .from("orders")
      .select(`
        id,
        order_number,
        total,
        subtotal,
        currency,
        shipping_address,
        customer_id,
        tracking_code,
        tracking_url,
        carrier,
        shipped_at,
        estimated_delivery_start,
        estimated_delivery_end,
        created_at,
        metadata,
        customers (
          id,
          email,
          full_name
        ),
        order_items (
          id,
          product_name,
          quantity,
          unit_price,
          sku,
          external_product_id
        )
      `)
      .eq("id", targetOrderId)
      .single()

    if (orderFetchError || !order) {
      throw new Error(`Order '${targetOrderId}' not found in database for email rendering: ${sanitizeErrorMessage(orderFetchError?.message)}`)
    }

    // 3.6. Renderização segura do template (HTML + Texto) via Registry tipado
    const targetTemplateKey = String(lockedRow.template_key || "order_confirmed").trim()

    // 3.6.1. Proteção contra e-mail obsoleto após substituição de rastreio (Superseded Tracking Code):
    // Se o template for 'order_shipped', compara o tracking_code do email_event com o orders.tracking_code atual.
    if (targetTemplateKey === "order_shipped") {
      const eventTrackingCode = (existingMeta?.tracking_code && typeof existingMeta.tracking_code === "string")
        ? existingMeta.tracking_code.toUpperCase().trim()
        : null
      const currentOrderTrackingCode = (order.tracking_code && typeof order.tracking_code === "string")
        ? order.tracking_code.toUpperCase().trim()
        : null

      if (eventTrackingCode && currentOrderTrackingCode && eventTrackingCode !== currentOrderTrackingCode) {
        console.log(`[email-service] Event '${targetEventId}' superseded: tracking code does not match current order tracking code. Marking as terminal failed/superseded.`)
        const supersededNowIso = new Date().toISOString()
        const { error: updateSupersededError } = await supabaseAdmin
          .from("email_events")
          .update({
            status: "failed",
            attempt_count: MAX_ATTEMPTS,
            next_attempt_at: null,
            error_message: "Email superseded by new tracking code",
            metadata: {
              ...existingMeta,
              superseded: true,
              superseded_at: supersededNowIso,
            },
            locked_at: null,
            lock_token: null,
            updated_at: supersededNowIso,
          })
          .eq("id", targetEventId)

        if (updateSupersededError) {
          throw new Error(`Failed to record superseded state for email_event '${targetEventId}': ${sanitizeErrorMessage(updateSupersededError.message)}`)
        }

        return {
          success: true,
          skipped: true,
          reason: "superseded_by_new_tracking_code",
        }
      }
    }

    const renderer = getEmailRenderer(targetTemplateKey)

    if (!renderer) {
      throw new Error(`Unsupported email template_key: '${targetTemplateKey}'`)
    }

    const rendered = renderer({
      order: order as any,
      recipientEmail,
    })

    // 3.7. Chamada ao Resend SDK oficial com { idempotencyKey } e payload com replyTo
    const resend: EmailSenderClient = resendClient || (await initResendClient(resendApiKey))
    const resendIdempotencyKey = rendered.resendIdempotencyKey

    const resendPayload: EmailPayload = {
      from: resendFromEmail,
      to: [recipientEmail],
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
    }

    if (resendReplyTo) {
      resendPayload.replyTo = resendReplyTo
    }

    const { data: resendData, error: resendError } = await resend.emails.send(
      resendPayload,
      { idempotencyKey: resendIdempotencyKey }
    )

    if (resendError || !resendData) {
      const errorMsg = resendError?.message || "Unknown error calling Resend"
      throw new Error(errorMsg)
    }

    // 3.8. Sucesso: atualiza status para 'sent', limpa next_attempt_at e limpa o lock
    const nowIso = new Date().toISOString()
    const { error: updateSuccessError } = await supabaseAdmin
      .from("email_events")
      .update({
        status: "sent",
        attempt_count: currentAttempt,
        next_attempt_at: null,
        provider_message_id: resendData.id,
        sent_at: nowIso,
        locked_at: null,
        lock_token: null,
        error_message: null,
        metadata: {
          ...existingMeta,
          attempt_count: currentAttempt,
          last_attempt_at: nowIso,
        },
      })
      .eq("id", targetEventId)
      .eq("lock_token", lockToken)

    if (updateSuccessError) {
      const safeUpdateError = sanitizeErrorMessage(updateSuccessError.message)
      console.error(`[email-service] Critical: Failed to update email_event '${targetEventId}' to status 'sent':`, safeUpdateError)
      return {
        success: false,
        error: `Failed to record sent status: ${safeUpdateError}`,
      }
    }

    console.log(`[email-service] Email '${targetEventId}' for order '${targetOrderId}' sent successfully (Message ID: ${resendData.id}).`)

    return {
      success: true,
      messageId: resendData.id,
    }
  } catch (dispatchError) {
    // 3.9. Falha: atualiza para 'failed', agenda next_attempt_at com backoff e limpa o lock
    const safeErrorMsg = sanitizeErrorMessage(dispatchError)
    const now = new Date()
    const nextAttemptAt = calculateNextAttemptAt(currentAttempt, now)

    console.error(`[email-service] Failed to dispatch email '${targetEventId}' (Attempt ${currentAttempt}/${MAX_ATTEMPTS}): ${safeErrorMsg}`)

    const { error: updateFailError } = await supabaseAdmin
      .from("email_events")
      .update({
        status: "failed",
        attempt_count: currentAttempt,
        next_attempt_at: nextAttemptAt,
        locked_at: null,
        lock_token: null,
        error_message: safeErrorMsg,
        metadata: {
          ...existingMeta,
          attempt_count: currentAttempt,
          last_attempt_at: now.toISOString(),
          last_error: safeErrorMsg,
        },
      })
      .eq("id", targetEventId)
      .eq("lock_token", lockToken)

    if (updateFailError) {
      console.error(`[email-service] Warning: Failed to record failure state for email_event '${targetEventId}':`, sanitizeErrorMessage(updateFailError.message))
    }

    return {
      success: false,
      error: safeErrorMsg,
    }
  }
}

/**
 * 4. WORKER DE FILA: Processa lote de e-mails 'queued' e 'failed' elegíveis para tentativa
 */
export async function processEmailQueueBatch({
  batchSize = 10,
  supabaseAdmin,
  resendClient,
  env,
}: {
  batchSize?: number
  supabaseAdmin: SupabaseClient
  resendClient?: EmailSenderClient
  env?: {
    EMAIL_SENDING_ENABLED?: string
    RESEND_API_KEY?: string
    RESEND_FROM_EMAIL?: string
    RESEND_REPLY_TO_EMAIL?: string
  }
}): Promise<QueueProcessSummary> {
  const getEnv = (key: string): string | undefined => {
    if (env && key in env) return env[key as keyof typeof env]
    if (typeof Deno !== "undefined" && typeof Deno.env?.get === "function") {
      return Deno.env.get(key)
    }
    return undefined
  }

  const isSendingEnabled = getEnv("EMAIL_SENDING_ENABLED") === "true"
  if (!isSendingEnabled) {
    console.log("[email-service] Worker skipped: EMAIL_SENDING_ENABLED is not 'true'.")
    return { totalEligible: 0, processed: 0, sent: 0, failed: 0, skipped: 0 }
  }

  const now = new Date()
  const nowIso = now.toISOString()
  const leaseThresholdIso = new Date(now.getTime() - LOCK_LEASE_MS).toISOString()

  // Busca e-mails elegíveis respeitando o limite MAX_ATTEMPTS
  const { data: eligibleEvents, error } = await supabaseAdmin
    .from("email_events")
    .select("id")
    .in("status", ["queued", "failed"])
    .lt("attempt_count", MAX_ATTEMPTS)
    .or(`next_attempt_at.is.null,next_attempt_at.lte.${nowIso}`)
    .or(`locked_at.is.null,locked_at.lte.${leaseThresholdIso}`)
    .order("created_at", { ascending: true })
    .limit(batchSize)

  if (error || !eligibleEvents) {
    console.error("[email-service] Failed to fetch eligible queue events:", sanitizeErrorMessage(error?.message))
    return { totalEligible: 0, processed: 0, sent: 0, failed: 0, skipped: 0 }
  }

  const summary: QueueProcessSummary = {
    totalEligible: eligibleEvents.length,
    processed: 0,
    sent: 0,
    failed: 0,
    skipped: 0,
  }

  for (const event of eligibleEvents) {
    summary.processed++
    const result = await processSingleEmailEvent({
      emailEventId: event.id,
      supabaseAdmin,
      resendClient,
      env,
    })

    if (result.success && !result.skipped) {
      summary.sent++
    } else if (result.skipped) {
      summary.skipped++
    } else {
      summary.failed++
    }
  }

  return summary
}
