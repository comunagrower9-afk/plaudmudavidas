import { timingSafeEqual } from "jsr:@std/crypto/timing-safe-equal"
import { createClient } from "npm:@supabase/supabase-js@2"
import {
  ensureOrderConfirmedEmailQueued,
  processSingleEmailEvent,
} from "../_shared/email-service.ts"
import { sanitizeErrorMessage } from "../_shared/email-utils.ts"

// Headers padrão para respostas JSON e CORS
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-vega-webhook-token",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

const encoder = new TextEncoder()

type PaymentStatus = "pending" | "paid" | "failed" | "cancelled" | "refunded" | "chargeback"

/**
 * Comparação segura em tempo constante utilizando hashes SHA-256 de tamanho fixo
 * Mitiga timing attacks mesmo quando as strings comparadas possuem comprimentos distintos
 */
async function safeCompare(
  received: string,
  expected: string,
): Promise<boolean> {
  const [receivedDigest, expectedDigest] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(received)),
    crypto.subtle.digest("SHA-256", encoder.encode(expected)),
  ])

  return timingSafeEqual(receivedDigest, expectedDigest)
}

/**
 * Gera hash SHA-256 em formato hexadecimal para idempotência de payloads sem ID específico de evento
 */
async function computeSha256(content: string): Promise<string> {
  const data = encoder.encode(content)
  const hashBuffer = await crypto.subtle.digest("SHA-256", data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((byte) => byte.toString(16).padStart(2, "0")).join("")
}

/**
 * Converte valor inteiro em centavos para string decimal com duas casas (ex: 11990 -> "119.90", 297 -> "2.97")
 * Sem perda de precisão de ponto flutuante.
 */
function centsToDecimalString(cents: unknown): string {
  const num = typeof cents === "number" ? cents : Number(cents)
  if (!Number.isFinite(num) || num < 0) {
    throw new Error(`Invalid cents amount: ${String(cents)}`)
  }
  const rounded = Math.round(num)
  const whole = Math.floor(rounded / 100)
  const fraction = rounded % 100
  return `${whole}.${fraction.toString().padStart(2, "0")}`
}

/**
 * Converte e valida string de data no formato ISO
 */
function parseIsoDate(val: unknown): string | null {
  if (typeof val === "string" && val.trim() !== "") {
    const parsed = Date.parse(val)
    if (!isNaN(parsed)) {
      return new Date(parsed).toISOString()
    }
  }
  return null
}

/**
 * Mapeia os status de venda da Vega para os enums canônicos do banco com aliases defensivos
 */
function mapPaymentStatus(rawStatus: unknown): PaymentStatus | null {
  if (typeof rawStatus !== "string") return null
  const normalized = rawStatus.trim().toLowerCase()

  switch (normalized) {
    case "pending":
      return "pending"
    case "approved":
    case "paid":
      return "paid"
    case "refused":
    case "failed":
      return "failed"
    case "chargeback":
      return "chargeback"
    case "refunded":
    case "refunded_sale":
      return "refunded"
    case "cancelled":
    case "canceled":
      return "cancelled"
    default:
      return null
  }
}

/**
 * Extrai o timestamp externo confiável do evento da Vega de acordo com o status
 */
function extractProviderStatusAt(
  status: PaymentStatus,
  payload: Record<string, unknown>
): string | null {
  if (status === "paid") {
    return parseIsoDate(payload.approved_at) || parseIsoDate(payload.updated_at)
  }
  if (status === "refunded") {
    return parseIsoDate(payload.refunded_at) || parseIsoDate(payload.updated_at)
  }
  return parseIsoDate(payload.updated_at) || parseIsoDate(payload.created_at)
}

/**
 * Máquina de estados para impedir regressão de status por eventos fora de ordem
 */
function isStatusTransitionAllowed(
  currentStatus: PaymentStatus,
  newStatus: PaymentStatus
): boolean {
  if (currentStatus === newStatus) return true

  // Estados terminais não podem ser sobrescritos
  if (currentStatus === "refunded" || currentStatus === "chargeback") {
    return false
  }

  // Pedido já pago não pode regredir para pendente ou falho
  if (currentStatus === "paid") {
    if (newStatus === "pending" || newStatus === "failed") {
      return false
    }
  }

  return true
}

/**
 * Extrai APENAS identificadores inequivocamente específicos do evento/webhook.
 * NÃO utiliza sale_code, order_id, transaction_token, etc.
 */
function extractExternalEventId(payload: Record<string, unknown>): string | null {
  const eventSpecificCandidates = [
    payload.event_id,
    payload.eventId,
    payload.webhook_id,
    payload.webhookId,
    payload.notification_id,
    payload.notificationId,
  ]

  for (const candidate of eventSpecificCandidates) {
    if (typeof candidate === "string" && candidate.trim() !== "") {
      return candidate.trim()
    }
    if (typeof candidate === "number" && !Number.isNaN(candidate)) {
      return String(candidate)
    }
  }

  const nestedData = payload.data as Record<string, unknown> | undefined
  if (nestedData && typeof nestedData === "object") {
    const nestedCandidates = [
      nestedData.event_id,
      nestedData.eventId,
      nestedData.webhook_id,
      nestedData.webhookId,
      nestedData.notification_id,
      nestedData.notificationId,
    ]
    for (const candidate of nestedCandidates) {
      if (typeof candidate === "string" && candidate.trim() !== "") {
        return candidate.trim()
      }
      if (typeof candidate === "number" && !Number.isNaN(candidate)) {
        return String(candidate)
      }
    }
  }

  return null
}

/**
 * Remove campos sensíveis antes de persistir o payload em public.webhook_events.payload
 */
function sanitizePayload(obj: Record<string, unknown>): Record<string, unknown> {
  const sanitized = { ...obj }

  // Remoção de campos específicos sensíveis e pesados
  delete sanitized.pix_code
  delete sanitized.pix_code_image64
  delete sanitized.user_ip
  delete sanitized.user_agent
  delete sanitized.transaction_token
  delete sanitized.billet_digitable_line
  delete sanitized.order_url
  delete sanitized.billet_url
  delete sanitized.checkout_url

  // Remove qualquer propriedade com tokens de autenticação ou URLs contendo transaction_token
  for (const [key, value] of Object.entries(sanitized)) {
    if (typeof value === "string") {
      const lowerKey = key.toLowerCase()
      if (
        lowerKey.includes("token") ||
        lowerKey.includes("pix") ||
        lowerKey.includes("billet") ||
        lowerKey.includes("url")
      ) {
        if (
          lowerKey === "order_url" ||
          lowerKey === "billet_url" ||
          lowerKey === "checkout_url" ||
          lowerKey === "transaction_token" ||
          value.includes("token=") ||
          value.includes("token/")
        ) {
          delete sanitized[key]
        }
      }
    }
  }

  // Sanitização do objeto customer (remove CPF/CNPJ)
  if (sanitized.customer && typeof sanitized.customer === "object") {
    const cust = { ...(sanitized.customer as Record<string, unknown>) }
    delete cust.document
    sanitized.customer = cust
  }

  return sanitized
}

/**
 * Extrai o identificador obrigatório do produto (id ou code)
 */
function extractProductIdentifier(
  prod: Record<string, unknown>,
  plans: unknown
): string | null {
  if (prod.id != null && String(prod.id).trim() !== "") {
    return String(prod.id).trim()
  }

  if (prod.code != null && String(prod.code).trim() !== "") {
    const codeStr = String(prod.code).trim()
    // Tenta encontrar ID correspondente na lista de planos
    if (Array.isArray(plans)) {
      for (const plan of plans) {
        const planProducts = (plan as Record<string, unknown>)?.products
        if (Array.isArray(planProducts)) {
          const matched = planProducts.find(
            (p: any) => p && String(p.code).trim() === codeStr
          )
          if (matched && matched.id != null && String(matched.id).trim() !== "") {
            return String(matched.id).trim()
          }
        }
      }
    }
    return codeStr
  }

  return null
}

Deno.serve(async (req: Request) => {
  // Preflight CORS
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    })
  }

  // 1. Validação estrita do método HTTP
  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method Not Allowed" }),
      {
        status: 405,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
          Allow: "POST",
        },
      }
    )
  }

  // 2. Validação do Secret Token da Edge Function
  const expectedToken = Deno.env.get("VEGA_WEBHOOK_TOKEN")
  if (!expectedToken || expectedToken.trim() === "") {
    console.error("[vega-webhook] VEGA_WEBHOOK_TOKEN is not configured in Edge Function secrets.")
    return new Response(
      JSON.stringify({ error: "Server Configuration Error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    )
  }

  const url = new URL(req.url)
  const headerToken = req.headers.get("x-vega-webhook-token")
  const queryToken = url.searchParams.get("token")
  const providedToken = headerToken || queryToken

  if (!providedToken || !(await safeCompare(providedToken, expectedToken))) {
    return new Response(
      JSON.stringify({ error: "Unauthorized" }),
      {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    )
  }

  // 3. Leitura e validação segura do corpo JSON
  let rawBody: string
  let parsedPayload: Record<string, unknown>

  try {
    rawBody = await req.text()
    if (!rawBody || rawBody.trim() === "") {
      return new Response(
        JSON.stringify({ error: "Empty request body" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      )
    }

    const parsed = JSON.parse(rawBody)
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return new Response(
        JSON.stringify({ error: "Invalid JSON structure. Expected object." }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      )
    }
    parsedPayload = parsed as Record<string, unknown>
  } catch (_error) {
    return new Response(
      JSON.stringify({ error: "Invalid JSON format" }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    )
  }

  // 4. Inicialização do cliente administrativo Supabase
  const supabaseUrl = Deno.env.get("SUPABASE_URL")
  const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    console.error("[vega-webhook] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment.")
    return new Response(
      JSON.stringify({ error: "Internal Server Error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    )
  }

  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })

  // 5. Cálculo de Idempotência e Tratamento Especial de Teste Manual
  const externalEventId = extractExternalEventId(parsedPayload)
  const idempotencyKey = externalEventId
    ? `vega:${externalEventId}`
    : `vega:${await computeSha256(rawBody)}`

  // Teste manual especial (test = true E event = manual_test)
  if (parsedPayload.test === true && parsedPayload.event === "manual_test") {
    console.log("[vega-webhook] Manual test event received. Recording and ignoring processing.")
    await supabaseAdmin
      .from("webhook_events")
      .upsert(
        {
          provider: "vega",
          external_event_id: externalEventId,
          idempotency_key: idempotencyKey,
          event_type: "manual_test",
          payload: sanitizePayload(parsedPayload),
          signature_valid: null,
          status: "ignored",
        },
        { onConflict: "idempotency_key" }
      )

    return new Response(
      JSON.stringify({
        success: true,
        message: "Manual test acknowledged and ignored",
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    )
  }

  // 6. Normalização de Status e Sanitização do Payload
  const rawStatus = typeof parsedPayload.status === "string" ? parsedPayload.status : ""
  const normalizedPaymentStatus = mapPaymentStatus(rawStatus)
  const eventType = normalizedPaymentStatus
    ? `sale.${normalizedPaymentStatus}`
    : (rawStatus ? `sale.${rawStatus.toLowerCase()}` : "unknown")

  const sanitizedPayload = sanitizePayload(parsedPayload)

  // 7. Registro ou Verificação do Webhook Event (com suporte a recuperação de falha)
  let webhookEventId: string | null = null

  // Verifica se o evento já existe
  const { data: existingEvent } = await supabaseAdmin
    .from("webhook_events")
    .select("id, status")
    .eq("idempotency_key", idempotencyKey)
    .maybeSingle()

  if (existingEvent) {
    if (existingEvent.status === "processed" || existingEvent.status === "ignored") {
      console.log(`[vega-webhook] Webhook already ${existingEvent.status}. Returning 200 OK.`)
      return new Response(
        JSON.stringify({
          success: true,
          message: `Webhook already ${existingEvent.status}`,
          duplicate: true,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      )
    }
    // Se status for 'received' ou 'failed', permite reprocessamento idempotente
    webhookEventId = existingEvent.id
  } else {
    // Inserção inicial
    const { data: insertedEvent, error: insertError } = await supabaseAdmin
      .from("webhook_events")
      .insert({
        provider: "vega",
        external_event_id: externalEventId,
        idempotency_key: idempotencyKey,
        event_type: eventType,
        payload: sanitizedPayload,
        signature_valid: null,
        status: "received",
      })
      .select("id")
      .single()

    if (insertError) {
      if (insertError.code === "23505" || insertError.message?.includes("idempotency_key")) {
        // Concorrência: busca novamente o registro criado concorrentemente
        const { data: raceEvent } = await supabaseAdmin
          .from("webhook_events")
          .select("id, status")
          .eq("idempotency_key", idempotencyKey)
          .maybeSingle()

        if (raceEvent && (raceEvent.status === "processed" || raceEvent.status === "ignored")) {
          return new Response(
            JSON.stringify({
              success: true,
              message: `Webhook already ${raceEvent.status}`,
              duplicate: true,
            }),
            {
              status: 200,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          )
        }
        webhookEventId = raceEvent?.id ?? null
      } else {
        console.error(`[vega-webhook] DB Insert error: ${insertError.code}`)
        return new Response(
          JSON.stringify({ error: "Failed to persist webhook event" }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        )
      }
    } else {
      webhookEventId = insertedEvent.id
    }
  }

  // 8. Se o status for desconhecido, ignora criação/atualização de entidades
  if (!normalizedPaymentStatus) {
    console.log(`[vega-webhook] Unrecognized status '${rawStatus}'. Marking event as ignored.`)
    if (webhookEventId) {
      await supabaseAdmin
        .from("webhook_events")
        .update({ status: "ignored" })
        .eq("id", webhookEventId)
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Webhook ignored (unrecognized status)",
        status: rawStatus,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    )
  }

  // 9. Processamento de Customers, Orders e Order Items
  const saleCode = typeof parsedPayload.sale_code === "string" && parsedPayload.sale_code.trim() !== ""
    ? parsedPayload.sale_code.trim()
    : null

  if (!saleCode) {
    const errorMsg = "Missing sale_code in Vega payload"
    console.error(`[vega-webhook] ${errorMsg}`)
    if (webhookEventId) {
      await supabaseAdmin
        .from("webhook_events")
        .update({ status: "failed", error_message: errorMsg })
        .eq("id", webhookEventId)
    }
    return new Response(
      JSON.stringify({ error: "Missing required sale identifier" }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    )
  }

  try {
    // 9.1. Extração do timestamp externo e verificação contra eventos fora de ordem
    const providerStatusAt = extractProviderStatusAt(normalizedPaymentStatus, parsedPayload)

    const { data: existingOrder } = await supabaseAdmin
      .from("orders")
      .select("id, payment_status, metadata, paid_at, shipping_address")
      .eq("vega_order_id", saleCode)
      .maybeSingle()

    if (existingOrder) {
      const currentMeta = (existingOrder.metadata && typeof existingOrder.metadata === "object")
        ? existingOrder.metadata as Record<string, unknown>
        : {}

      const existingStatusAt = parseIsoDate(currentMeta.provider_status_at)

      // Se o evento recebido for comprovadamente mais antigo que o status já gravado no pedido
      if (existingStatusAt && providerStatusAt) {
        if (Date.parse(providerStatusAt) < Date.parse(existingStatusAt)) {
          console.log(`[vega-webhook] Out-of-order event for order '${saleCode}'. Current: ${existingStatusAt}, Incoming: ${providerStatusAt}. Ignoring.`)
          if (webhookEventId) {
            await supabaseAdmin
              .from("webhook_events")
              .update({
                status: "ignored",
                error_message: "Out-of-order event ignored (incoming timestamp is older than current status)",
              })
              .eq("id", webhookEventId)
          }

          return new Response(
            JSON.stringify({
              success: true,
              message: "Webhook ignored (out-of-order event)",
              out_of_order: true,
            }),
            {
              status: 200,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          )
        }
      }

      // Máquina de estados: impede regressão de status (ex: pending/failed sobrescrevendo paid/refunded)
      const currentStatus = existingOrder.payment_status as PaymentStatus
      if (!isStatusTransitionAllowed(currentStatus, normalizedPaymentStatus)) {
        console.log(`[vega-webhook] Invalid status transition from '${currentStatus}' to '${normalizedPaymentStatus}' for order '${saleCode}'. Ignoring.`)
        if (webhookEventId) {
          await supabaseAdmin
            .from("webhook_events")
            .update({
              status: "ignored",
              error_message: `Status transition ignored (cannot transition from ${currentStatus} to ${normalizedPaymentStatus})`,
            })
            .eq("id", webhookEventId)
        }

        return new Response(
          JSON.stringify({
            success: true,
            message: "Webhook ignored (status regression prevented)",
          }),
          {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        )
      }
    }

    // 9.2. Customer Resolution
    const rawCustomer = (parsedPayload.customer && typeof parsedPayload.customer === "object")
      ? parsedPayload.customer as Record<string, unknown>
      : {}

    const rawEmail = typeof rawCustomer.email === "string" ? rawCustomer.email.trim() : ""
    if (!rawEmail) {
      throw new Error("Missing customer email in payload")
    }

    const emailNormalized = rawEmail.toLowerCase()
    const fullName = typeof rawCustomer.name === "string" && rawCustomer.name.trim() !== ""
      ? rawCustomer.name.trim()
      : null
    const phone = typeof rawCustomer.phone === "string" && rawCustomer.phone.trim() !== ""
      ? rawCustomer.phone.trim()
      : null

    let customerId: string

    // Busca cliente existente por e-mail normalizado
    const { data: existingCustomer } = await supabaseAdmin
      .from("customers")
      .select("id, full_name, phone")
      .eq("email_normalized", emailNormalized)
      .maybeSingle()

    if (existingCustomer) {
      customerId = existingCustomer.id
      // Atualiza apenas campos que contenham valores novos válidos (sem sobrescrever com null ou vazio)
      const customerUpdates: Record<string, string> = {}
      if (fullName && !existingCustomer.full_name) customerUpdates.full_name = fullName
      if (phone && !existingCustomer.phone) customerUpdates.phone = phone

      if (Object.keys(customerUpdates).length > 0) {
        await supabaseAdmin
          .from("customers")
          .update(customerUpdates)
          .eq("id", customerId)
      }
    } else {
      // Cria novo cliente
      const { data: newCustomer, error: insertCustomerError } = await supabaseAdmin
        .from("customers")
        .insert({
          email: rawEmail,
          full_name: fullName,
          phone: phone,
        })
        .select("id")
        .single()

      if (insertCustomerError) {
        if (insertCustomerError.code === "23505") {
          const { data: raceCustomer } = await supabaseAdmin
            .from("customers")
            .select("id")
            .eq("email_normalized", emailNormalized)
            .single()

          if (!raceCustomer) throw insertCustomerError
          customerId = raceCustomer.id
        } else {
          throw insertCustomerError
        }
      } else {
        customerId = newCustomer.id
      }
    }

    // 9.3. Cálculos Monetários Exatos
    const totalDecimalString = centsToDecimalString(parsedPayload.total_price ?? 0)
    const rawProducts = Array.isArray(parsedPayload.products) ? parsedPayload.products : []

    let subtotalCents = 0
    for (const p of rawProducts) {
      const pRecord = p as Record<string, unknown>
      const qty = typeof pRecord.quantity === "number" && pRecord.quantity > 0 ? pRecord.quantity : 1
      const amt = typeof pRecord.amount === "number" && pRecord.amount >= 0 ? pRecord.amount : 0
      subtotalCents += amt * qty
    }

    const subtotalDecimalString = subtotalCents > 0
      ? centsToDecimalString(subtotalCents)
      : totalDecimalString

    const rawCurrency = typeof parsedPayload.currency_enum === "string"
      ? parsedPayload.currency_enum.trim().toUpperCase()
      : "BRL"
    const currency = /^[A-Z]{3}$/.test(rawCurrency) ? rawCurrency : "BRL"

    // 9.4. Endereço de Entrega (Preserva existente se o novo for nulo ou vazio)
    const rawAddress = (parsedPayload.address && typeof parsedPayload.address === "object" && Object.keys(parsedPayload.address).length > 0)
      ? parsedPayload.address as Record<string, unknown>
      : null

    // 9.5. Resolução Segura de paid_at (Sem inventar now())
    const validApprovedAt = parseIsoDate(parsedPayload.approved_at)

    // 9.6. Order Metadata (Sem dados sensíveis como tokens, URLs com token ou documentos)
    const orderMetadata: Record<string, unknown> = {
      provider: "vega",
      payment_method: parsedPayload.method || null,
      raw_payment_status: rawStatus,
      checkout: parsedPayload.checkout || null,
      business_name: parsedPayload.business_name || null,
      external_code: parsedPayload.external_code || null,
      checkout_tax_percentage: parsedPayload.checkout_tax_percentage ?? null,
      external_created_at: parseIsoDate(parsedPayload.created_at) || parsedPayload.created_at || null,
      refunded_at: parseIsoDate(parsedPayload.refunded_at) || parsedPayload.refunded_at || null,
      provider_status_at: providerStatusAt,
    }

    if (parsedPayload.checkout_tax_amount != null) {
      orderMetadata.checkout_tax_amount = centsToDecimalString(parsedPayload.checkout_tax_amount)
    }

    if (Array.isArray(parsedPayload.plans)) {
      orderMetadata.plan_ids = parsedPayload.plans
        .map((plan: unknown) => (plan as Record<string, unknown>)?.id)
        .filter(Boolean)
    }

    // 9.7. Criação ou Atualização do Pedido
    let orderId: string

    if (!existingOrder) {
      // Novo pedido: paid_at é approved_at válido quando paid, senão null (NUNCA usa now())
      const initialPaidAt = (normalizedPaymentStatus === "paid" && validApprovedAt)
        ? validApprovedAt
        : null

      const { data: newOrder, error: insertOrderError } = await supabaseAdmin
        .from("orders")
        .insert({
          vega_order_id: saleCode,
          order_number: saleCode,
          customer_id: customerId,
          payment_status: normalizedPaymentStatus,
          fulfillment_status: "unfulfilled",
          currency: currency,
          subtotal: Number(subtotalDecimalString),
          total: Number(totalDecimalString),
          shipping_address: rawAddress,
          paid_at: initialPaidAt,
          metadata: orderMetadata,
        })
        .select("id")
        .single()

      if (insertOrderError) {
        throw insertOrderError
      }
      orderId = newOrder.id
    } else {
      orderId = existingOrder.id

      // Atualização: preserva campos anteriores e faz merge de metadata
      const currentMeta = (existingOrder.metadata && typeof existingOrder.metadata === "object")
        ? existingOrder.metadata as Record<string, unknown>
        : {}

      const mergedMetadata = { ...currentMeta, ...orderMetadata }

      const orderUpdates: Record<string, unknown> = {
        payment_status: normalizedPaymentStatus,
        customer_id: customerId,
        subtotal: Number(subtotalDecimalString),
        total: Number(totalDecimalString),
        metadata: mergedMetadata,
      }

      // Atualiza shipping_address somente se fornecido novo endereço não vazio
      if (rawAddress) {
        orderUpdates.shipping_address = rawAddress
      }

      // Se approved_at foi fornecido, atualiza; senão preserva paid_at existente (NUNCA zera)
      if (validApprovedAt) {
        orderUpdates.paid_at = validApprovedAt
      }

      const { error: updateOrderError } = await supabaseAdmin
        .from("orders")
        .update(orderUpdates)
        .eq("id", orderId)

      if (updateOrderError) {
        throw updateOrderError
      }
    }

    // 9.8. Validação e Upsert dos Itens do Pedido
    if (rawProducts.length === 0) {
      throw new Error("Products list is empty in Vega payload")
    }

    const orderItemsToUpsert: Array<{
      order_id: string
      external_product_id: string
      sku: string | null
      product_name: string
      quantity: number
      unit_price: number
      image_url: string | null
      metadata: Record<string, unknown>
    }> = []

    for (const rawProd of rawProducts) {
      const prod = rawProd as Record<string, unknown>
      const externalProductId = extractProductIdentifier(prod, parsedPayload.plans)

      if (!externalProductId) {
        throw new Error("Missing product identifier (id or code) in products payload")
      }

      const sku = prod.code ? String(prod.code).trim() : null
      const productName = typeof prod.title === "string" && prod.title.trim() !== ""
        ? prod.title.trim()
        : (typeof prod.name === "string" && prod.name.trim() !== "" ? prod.name.trim() : "PLAUD NOTE")
      const quantity = typeof prod.quantity === "number" && prod.quantity > 0 ? prod.quantity : 1
      const unitPriceString = centsToDecimalString(prod.amount ?? 0)
      const imageUrl = typeof prod.image_url === "string" ? prod.image_url : (typeof prod.image === "string" ? prod.image : null)

      const itemMeta: Record<string, unknown> = {}
      if (prod.brand) itemMeta.brand = prod.brand
      if (prod.model) itemMeta.model = prod.model
      if (prod.version) itemMeta.version = prod.version
      if (prod.description) itemMeta.description = prod.description

      orderItemsToUpsert.push({
        order_id: orderId,
        external_product_id: externalProductId,
        sku: sku,
        product_name: productName,
        quantity: quantity,
        unit_price: Number(unitPriceString),
        image_url: imageUrl,
        metadata: itemMeta,
      })
    }

    const { error: upsertItemsError } = await supabaseAdmin
      .from("order_items")
      .upsert(orderItemsToUpsert, {
        onConflict: "order_id,external_product_id",
      })

    if (upsertItemsError) {
      throw upsertItemsError
    }

    // 9.9. OUTBOX DURÁVEL OBRIGATÓRIO (SÍNCRONO):
    // Para pedidos pagos, garante que o email_event 'queued' exista no banco ANTES de marcar o webhook como processed
    // Se a criação falhar, a exceção é propagada para o catch geral, marcando webhook_events como 'failed' e retornando HTTP 500
    let queuedEmailEventId: string | null = null
    if (normalizedPaymentStatus === "paid") {
      const queuedResult = await ensureOrderConfirmedEmailQueued({
        orderId,
        recipientEmail: emailNormalized,
        templateKey: "order_confirmed",
        supabaseAdmin,
      })
      queuedEmailEventId = queuedResult.emailEventId
    }

    // 9.10. Finalização do Webhook Event como Processado (somente após persistência e outbox garantidos)
    if (webhookEventId) {
      await supabaseAdmin
        .from("webhook_events")
        .update({
          status: "processed",
          processed_at: new Date().toISOString(),
          error_message: null,
        })
        .eq("id", webhookEventId)
    }

    console.log(`[vega-webhook] Sale '${saleCode}' successfully processed (Status: ${normalizedPaymentStatus}).`)

    // 9.11. Disparo do processamento do e-mail em background (EdgeRuntime.waitUntil)
    if (normalizedPaymentStatus === "paid" && queuedEmailEventId) {
      const emailDispatchPromise = processSingleEmailEvent({
        emailEventId: queuedEmailEventId,
        supabaseAdmin,
      }).catch((emailErr) => {
        console.error(
          `[vega-webhook] Background email dispatch error for event '${queuedEmailEventId}':`,
          emailErr instanceof Error ? emailErr.message : String(emailErr)
        )
      })

      // Se executando no Supabase Edge Runtime, registra no waitUntil para manter a execução após a resposta HTTP
      if (typeof (globalThis as any).EdgeRuntime?.waitUntil === "function") {
        (globalThis as any).EdgeRuntime.waitUntil(emailDispatchPromise)
      } else {
        // Fallback para execução não bloqueante em outros runtimes / testes
        emailDispatchPromise
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Webhook processed successfully",
        sale_code: saleCode,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    )
  } catch (processingError) {
    const safeError = sanitizeErrorMessage(processingError)
    console.error(`[vega-webhook] Processing failed for sale_code '${saleCode}':`, safeError)

    if (webhookEventId) {
      await supabaseAdmin
        .from("webhook_events")
        .update({
          status: "failed",
          error_message: safeError,
        })
        .eq("id", webhookEventId)
    }

    return new Response(
      JSON.stringify({ error: "Internal processing error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    )
  }
})
