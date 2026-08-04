import { timingSafeEqual } from "jsr:@std/crypto/timing-safe-equal"
import { createClient } from "npm:@supabase/supabase-js@2"
import { processSingleEmailEvent } from "../_shared/email-service.ts"
import { sanitizeErrorMessage } from "../_shared/email-utils.ts"

const encoder = new TextEncoder()

const jsonHeaders = {
  "Content-Type": "application/json",
}

/**
 * Comparação em tempo constante utilizando hashes SHA-256
 */
async function safeCompare(received: string, expected: string): Promise<boolean> {
  const [receivedDigest, expectedDigest] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(received)),
    crypto.subtle.digest("SHA-256", encoder.encode(expected)),
  ])
  return timingSafeEqual(receivedDigest, expectedDigest)
}

// Chaves proibidas que nunca devem ser aceitas do cliente
const FORBIDDEN_KEYS = new Set([
  "recipient",
  "tracking_url",
  "email",
  "status",
  "fulfillment_status",
  "payment_status",
  "template_key",
  "idempotency_key",
  "customer_id",
  "order_id",
])

Deno.serve(async (req: Request) => {
  // 1. Método HTTP
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204 })
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: jsonHeaders }
    )
  }

  // 2. Autenticação Administrativa via Header Estrito
  const trackingAdminToken = Deno.env.get("TRACKING_ADMIN_TOKEN")?.trim()
  if (!trackingAdminToken) {
    console.error("[register-shipment] Critical: TRACKING_ADMIN_TOKEN secret is not configured")
    return new Response(
      JSON.stringify({ error: "Tracking admin service is not configured" }),
      { status: 500, headers: jsonHeaders }
    )
  }

  const receivedToken = req.headers.get("x-tracking-admin-token")?.trim()
  if (!receivedToken || !(await safeCompare(receivedToken, trackingAdminToken))) {
    return new Response(
      JSON.stringify({ error: "Unauthorized" }),
      { status: 401, headers: jsonHeaders }
    )
  }

  // 3. Leitura e Validação do Corpo da Requisição
  let bodyText: string
  try {
    bodyText = await req.text()
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "Failed to read request body", details: sanitizeErrorMessage(err) }),
      { status: 400, headers: jsonHeaders }
    )
  }

  if (bodyText.length > 10240) {
    return new Response(
      JSON.stringify({ error: "Request payload too large" }),
      { status: 413, headers: jsonHeaders }
    )
  }

  let payload: Record<string, unknown>
  try {
    payload = JSON.parse(bodyText)
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      throw new Error("Payload must be a JSON object")
    }
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "Invalid JSON format in request body" }),
      { status: 400, headers: jsonHeaders }
    )
  }

  // 4. Verificação de Propriedades Proibidas (Zero Trust)
  const payloadKeys = Object.keys(payload)
  for (const key of payloadKeys) {
    if (FORBIDDEN_KEYS.has(key.toLowerCase().trim())) {
      return new Response(
        JSON.stringify({
          error: `Property '${key}' is forbidden and cannot be overridden by client`,
        }),
        { status: 400, headers: jsonHeaders }
      )
    }
  }

  const orderIdentifier = typeof payload.order_identifier === "string" ? payload.order_identifier.trim() : ""
  const trackingCode = typeof payload.tracking_code === "string" ? payload.tracking_code.trim() : ""
  const carrier = typeof payload.carrier === "string" ? payload.carrier.trim() : null
  const replaceExisting = Boolean(payload.replace_existing)

  if (!orderIdentifier) {
    return new Response(
      JSON.stringify({ error: "Missing required field 'order_identifier'" }),
      { status: 400, headers: jsonHeaders }
    )
  }

  if (!trackingCode) {
    return new Response(
      JSON.stringify({ error: "Missing required field 'tracking_code'" }),
      { status: 400, headers: jsonHeaders }
    )
  }

  // 5. Inicialização do Cliente Supabase com Chave Administrativa
  const supabaseUrl = Deno.env.get("SUPABASE_URL")?.trim()
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.trim()

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error("[register-shipment] Critical: Supabase URL or Service Role Key missing")
    return new Response(
      JSON.stringify({ error: "Internal database configuration error" }),
      { status: 500, headers: jsonHeaders }
    )
  }

  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })

  // 6. Execução da RPC Atômica no Banco de Dados
  try {
    const { data: rpcResult, error: rpcError } = await supabaseAdmin.rpc("register_order_shipment", {
      p_order_identifier: orderIdentifier,
      p_tracking_code: trackingCode,
      p_carrier: carrier,
      p_replace_existing: replaceExisting,
    })

    if (rpcError) {
      console.error("[register-shipment] RPC execution error:", sanitizeErrorMessage(rpcError.message))
      return new Response(
        JSON.stringify({ error: "Database execution failed", details: sanitizeErrorMessage(rpcError.message) }),
        { status: 500, headers: jsonHeaders }
      )
    }

    const status = (rpcResult && typeof rpcResult === "object") ? rpcResult.status : null

    // 7. Mapeamento de Status HTTP
    if (status === "invalid_input") {
      return new Response(
        JSON.stringify({ error: rpcResult.message || "Invalid input parameters" }),
        { status: 400, headers: jsonHeaders }
      )
    }

    if (status === "not_found") {
      return new Response(
        JSON.stringify({ error: rpcResult.message || "Order not found" }),
        { status: 404, headers: jsonHeaders }
      )
    }

    if (status === "not_paid" || status === "conflict" || status === "tracking_conflict") {
      return new Response(
        JSON.stringify({
          error: rpcResult.message || "Operation conflict",
          existing_tracking_code: rpcResult.existing_tracking_code || undefined,
        }),
        { status: 409, headers: jsonHeaders }
      )
    }

    if (status === "registered" || status === "already_registered" || status === "replaced") {
      // 8. Disparo do E-mail em Segundo Plano via EdgeRuntime.waitUntil
      const emailEventId = rpcResult.email_event_id
      if (emailEventId && typeof EdgeRuntime !== "undefined" && typeof EdgeRuntime.waitUntil === "function") {
        EdgeRuntime.waitUntil(
          processSingleEmailEvent({
            emailEventId: emailEventId,
            supabaseAdmin,
          }).catch((dispatchErr) => {
            console.error("[register-shipment] Background email dispatch error:", sanitizeErrorMessage(dispatchErr))
          })
        )
      }

      // Resposta sanitizada (sem customer_id, e-mail ou endereços)
      return new Response(
        JSON.stringify({
          success: true,
          status: status,
          order_number: rpcResult.order_number,
          tracking_code: rpcResult.tracking_code,
          tracking_url: rpcResult.tracking_url,
          carrier: rpcResult.carrier || null,
          email_event_id: emailEventId || null,
        }),
        { status: 200, headers: jsonHeaders }
      )
    }

    // Status desconhecido retornado pela RPC
    console.error("[register-shipment] Unexpected RPC response status:", status)
    return new Response(
      JSON.stringify({ error: "Unexpected status response from database" }),
      { status: 500, headers: jsonHeaders }
    )
  } catch (err) {
    console.error("[register-shipment] Unhandled exception:", sanitizeErrorMessage(err))
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: jsonHeaders }
    )
  }
})
