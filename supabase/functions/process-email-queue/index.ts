import { timingSafeEqual } from "jsr:@std/crypto/timing-safe-equal"
import { createClient } from "npm:@supabase/supabase-js@2"
import { processEmailQueueBatch } from "../_shared/email-service.ts"
import { sanitizeErrorMessage } from "../_shared/email-utils.ts"

const encoder = new TextEncoder()

/**
 * Comparação segura em tempo constante usando hashes SHA-256 de tamanho fixo
 */
async function safeCompare(received: string, expected: string): Promise<boolean> {
  const [receivedDigest, expectedDigest] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(received)),
    crypto.subtle.digest("SHA-256", encoder.encode(expected)),
  ])
  return timingSafeEqual(receivedDigest, expectedDigest)
}

Deno.serve(async (req: Request) => {
  // 1. Validação estrita do método POST (sem suporte a CORS/navegador para função interna de worker)
  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method Not Allowed" }),
      {
        status: 405,
        headers: {
          "Content-Type": "application/json",
          Allow: "POST",
        },
      }
    )
  }

  // 2. Validação obrigatória da configuração CRON_SECRET no servidor
  const cronSecret = Deno.env.get("CRON_SECRET")
  if (!cronSecret || cronSecret.trim() === "") {
    console.error("[process-email-queue] Server configuration error: CRON_SECRET is not configured.")
    return new Response(
      JSON.stringify({ error: "Configuration Error: CRON_SECRET is not configured on server" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    )
  }

  // 3. Autenticação estrita do chamador via CRON_SECRET (via header x-cron-secret ou Bearer)
  const authHeader = req.headers.get("authorization")
  const cronHeader = req.headers.get("x-cron-secret")

  let authorized = false

  if (cronHeader && (await safeCompare(cronHeader, cronSecret))) {
    authorized = true
  } else if (authHeader && authHeader.startsWith("Bearer ") && (await safeCompare(authHeader.slice(7), cronSecret))) {
    authorized = true
  }

  if (!authorized) {
    return new Response(
      JSON.stringify({ error: "Unauthorized" }),
      {
        status: 401,
        headers: { "Content-Type": "application/json" },
      }
    )
  }

  // 4. Inicialização do cliente administrativo Supabase (service_role existe apenas internamente na Edge Function)
  const supabaseUrl = Deno.env.get("SUPABASE_URL")
  const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    console.error("[process-email-queue] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment.")
    return new Response(
      JSON.stringify({ error: "Internal Server Error" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    )
  }

  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })

  // 5. Execução segura do lote de reprocessamento da fila
  try {
    const batchSize = 10
    const summary = await processEmailQueueBatch({
      batchSize,
      supabaseAdmin,
    })

    return new Response(
      JSON.stringify({
        success: true,
        summary,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    )
  } catch (err) {
    const safeError = sanitizeErrorMessage(err)
    console.error("[process-email-queue] Error executing email queue worker:", safeError)

    return new Response(
      JSON.stringify({
        success: false,
        error: "Failed to process email queue",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    )
  }
})
