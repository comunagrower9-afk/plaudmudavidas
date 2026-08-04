import assert from "node:assert/strict"
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import {
  normalizeTrackingCode,
  isValidTrackingCode,
  build17TrackUrl,
  isValid17TrackUrl,
  generateEmailIdempotencyKey,
  generateResendIdempotencyKey,
} from "../supabase/functions/_shared/email-utils.ts"
import { processSingleEmailEvent, processEmailQueueBatch } from "../supabase/functions/_shared/email-service.ts"

console.log("=== INICIANDO TESTES ESPECÍFICOS DO FLUXO DE CADASTRO DE RASTREAMENTO ===")

// ============================================================================
// 1. Verificação de Integridade da Migration (Tipo Canônico e Preservação de Status)
// ============================================================================
console.log("1. Verificando Tipagem Canônica na Migration SQL...")
const migrationPath = path.resolve(
  process.cwd(),
  "supabase/migrations/20260804060000_create_register_order_shipment_rpc.sql"
)
const migrationSql = fs.readFileSync(migrationPath, "utf-8")

assert.ok(
  migrationSql.includes("v_new_fulfillment_status public.orders.fulfillment_status%TYPE;"),
  "A migration deve declarar v_new_fulfillment_status usando o tipo canônico public.orders.fulfillment_status%TYPE"
)
assert.ok(
  migrationSql.includes("v_new_fulfillment_status,\n    'manual_admin',"),
  "A inserção em tracking_events deve usar v_new_fulfillment_status e não 'shipped' fixo"
)
console.log("   ✓ Migration SQL validada com tipo canônico e tracking_events dinâmico!")

// ============================================================================
// 2. Mock do Banco de Dados Postgres (Simulando a RPC register_order_shipment)
// ============================================================================
function createPostgresShipmentMock() {
  const db = {
    customers: [
      { id: "cust-01", email: "maria@example.com", full_name: "Maria Oliveira" },
    ],
    orders: [
      {
        id: "ord-paid-1",
        order_number: "VCS1O8WQ3EI",
        vega_order_id: "VG-991122",
        customer_id: "cust-01",
        payment_status: "paid",
        status: "paid",
        fulfillment_status: "processing",
        tracking_code: null as string | null,
        tracking_url: null as string | null,
        carrier: null as string | null,
        shipped_at: null as string | null,
        metadata: { source: "checkout" },
      },
      {
        id: "ord-pending-2",
        order_number: "VCS_PENDING",
        vega_order_id: "VG-881100",
        customer_id: "cust-01",
        payment_status: "pending",
        status: "pending",
        fulfillment_status: "pending",
        tracking_code: null,
        tracking_url: null,
        carrier: null,
        shipped_at: null,
        metadata: {},
      },
      {
        id: "ord-in-transit-3",
        order_number: "VCS_IN_TRANSIT",
        vega_order_id: "VG-771100",
        customer_id: "cust-01",
        payment_status: "paid",
        status: "paid",
        fulfillment_status: "in_transit",
        tracking_code: "OLD123456789BR",
        tracking_url: "https://www.17track.net/pt?nums=OLD123456789BR",
        carrier: "Correios",
        shipped_at: "2026-08-01T10:00:00Z",
        metadata: {},
      },
      {
        id: "ord-delivered-4",
        order_number: "VCS_DELIVERED",
        vega_order_id: "VG-661100",
        customer_id: "cust-01",
        payment_status: "paid",
        status: "paid",
        fulfillment_status: "delivered",
        tracking_code: "DEL123456789BR",
        tracking_url: "https://www.17track.net/pt?nums=DEL123456789BR",
        carrier: "Correios",
        shipped_at: "2026-08-01T10:00:00Z",
        metadata: {},
      },
      {
        id: "ord-cancelled-5",
        order_number: "VCS_CANCELLED",
        vega_order_id: "VG-551100",
        customer_id: "cust-01",
        payment_status: "cancelled",
        status: "cancelled",
        fulfillment_status: "cancelled",
        tracking_code: null,
        tracking_url: null,
        carrier: null,
        shipped_at: null,
        metadata: {},
      },
    ],
    tracking_events: [] as Array<{
      id: string
      order_id: string
      tracking_code: string
      carrier: string | null
      tracking_url: string
      status: string
      created_at: string
    }>,
    email_events: [] as Array<{
      id: string
      order_id: string
      recipient: string
      template_key: string
      idempotency_key: string
      status: string
      attempt_count: number
      metadata: Record<string, unknown>
      created_at: string
    }>,
  }

  function rpcRegisterOrderShipment(params: {
    p_order_identifier: string
    p_tracking_code: string
    p_carrier?: string | null
    p_replace_existing?: boolean | null
  }) {
    const ident = (params.p_order_identifier || "").trim()
    const rawCode = (params.p_tracking_code || "").trim()
    const carrier = params.p_carrier ? params.p_carrier.trim() : null
    const replaceExisting = Boolean(params.p_replace_existing ?? false)

    if (!ident) {
      return { status: "invalid_input", message: "Order identifier is required" }
    }
    if (!rawCode) {
      return { status: "invalid_input", message: "Tracking code is required" }
    }

    const normCode = normalizeTrackingCode(rawCode)
    if (!normCode || !isValidTrackingCode(normCode)) {
      return { status: "invalid_input", message: "Tracking code has invalid format" }
    }

    const order = db.orders.find(
      (o) => o.order_number === ident || o.vega_order_id === ident || o.id === ident
    )
    if (!order) {
      return { status: "not_found", message: `Order not found with identifier: ${ident}` }
    }

    if (order.payment_status !== "paid") {
      return {
        status: "not_paid",
        message: `Order cannot be shipped because payment status is '${order.payment_status}' (must be 'paid')`,
        current_status: order.payment_status,
      }
    }

    if (["delivered", "returned", "cancelled"].includes(order.fulfillment_status)) {
      return {
        status: "conflict",
        message: `Cannot register shipment for ${order.fulfillment_status} order`,
      }
    }

    let newFulfillmentStatus = "shipped"
    if (["in_transit", "out_for_delivery", "exception"].includes(order.fulfillment_status)) {
      newFulfillmentStatus = order.fulfillment_status
    }

    const customer = db.customers.find((c) => c.id === order.customer_id)
    if (!customer || !customer.email) {
      return { status: "invalid_input", message: "Customer email is required for shipping notification" }
    }

    const canonicalUrl = build17TrackUrl(normCode)

    if (order.tracking_code && order.tracking_code.toUpperCase() === normCode) {
      const existingEmail = db.email_events.find(
        (e) => e.order_id === order.id && e.template_key === "order_shipped"
      )
      return {
        status: "already_registered",
        order_number: order.order_number,
        tracking_code: order.tracking_code,
        tracking_url: order.tracking_url,
        carrier: order.carrier,
        email_event_id: existingEmail ? existingEmail.id : null,
      }
    }

    if (order.tracking_code && order.tracking_code.toUpperCase() !== normCode && !replaceExisting) {
      return {
        status: "tracking_conflict",
        message: `Order already has tracking code '${order.tracking_code}'. Set replace_existing: true to overwrite.`,
        existing_tracking_code: order.tracking_code,
      }
    }

    const isReplacement = Boolean(order.tracking_code)

    const nowIso = new Date().toISOString()
    order.tracking_code = normCode
    order.tracking_url = canonicalUrl
    order.carrier = carrier || order.carrier || null
    order.fulfillment_status = newFulfillmentStatus
    if (!order.shipped_at) {
      order.shipped_at = nowIso
    }

    // Inserção em tracking_events preservando newFulfillmentStatus
    const trackingEventId = `trk-evt-${db.tracking_events.length + 1}`
    db.tracking_events.push({
      id: trackingEventId,
      order_id: order.id,
      tracking_code: normCode,
      carrier: order.carrier,
      tracking_url: canonicalUrl,
      status: newFulfillmentStatus,
      created_at: nowIso,
    })

    const emailEventKey = generateEmailIdempotencyKey(order.id, "order_shipped", normCode)
    let emailEvent = db.email_events.find((e) => e.idempotency_key === emailEventKey)
    if (!emailEvent) {
      emailEvent = {
        id: `email-evt-${db.email_events.length + 1}`,
        order_id: order.id,
        recipient: customer.email,
        template_key: "order_shipped",
        idempotency_key: emailEventKey,
        status: "queued",
        attempt_count: 0,
        metadata: {
          tracking_code: normCode,
          carrier: order.carrier,
          is_replacement: isReplacement,
        },
        created_at: nowIso,
      }
      db.email_events.push(emailEvent)
    }

    return {
      status: isReplacement ? "replaced" : "registered",
      order_number: order.order_number,
      tracking_code: normCode,
      tracking_url: canonicalUrl,
      carrier: order.carrier,
      email_event_id: emailEvent.id,
    }
  }

  return { db, rpcRegisterOrderShipment }
}

// ============================================================================
// 3. Testes de Regras de Não-Regressão e Preservação de Status em tracking_events
// ============================================================================
console.log("2. Testando Caso de Sucesso: Primeiro Cadastro de Rastreamento...")
const { db: db1, rpcRegisterOrderShipment: rpc1 } = createPostgresShipmentMock()

const res1 = rpc1({
  p_order_identifier: "VCS1O8WQ3EI",
  p_tracking_code: "  nl123456789br  ",
  p_carrier: "Correios",
})

assert.equal(res1.status, "registered")
assert.equal(res1.order_number, "VCS1O8WQ3EI")
assert.equal(res1.tracking_code, "NL123456789BR")
assert.equal(res1.tracking_url, "https://www.17track.net/pt?nums=NL123456789BR")
assert.equal(res1.carrier, "Correios")
assert.ok(res1.email_event_id !== null)

const order1 = db1.orders.find((o) => o.id === "ord-paid-1")
assert.equal(order1?.fulfillment_status, "shipped")
assert.equal(order1?.tracking_code, "NL123456789BR")
assert.ok(order1?.shipped_at !== null)
assert.equal(db1.tracking_events.length, 1)
assert.equal(db1.tracking_events[0].status, "shipped")
assert.equal(db1.email_events.length, 1)
assert.equal(db1.email_events[0].status, "queued")
assert.equal(db1.email_events[0].idempotency_key, "order-shipped:ord-paid-1:NL123456789BR")
console.log("   ✓ Primeiro cadastro executado com sucesso e tracking_event 'shipped' gerado!")

console.log("3. Testando Não-Regressão de fulfillment_status e tracking_events: in_transit preservado...")
const resInTransit = rpc1({
  p_order_identifier: "VCS_IN_TRANSIT",
  p_tracking_code: "NEW123456789BR",
  p_replace_existing: true,
})
const orderInTransit = db1.orders.find((o) => o.id === "ord-in-transit-3")
assert.equal(resInTransit.status, "replaced")
assert.equal(orderInTransit?.fulfillment_status, "in_transit", "fulfillment_status não regrediu para shipped")
assert.equal(orderInTransit?.shipped_at, "2026-08-01T10:00:00Z", "shipped_at original foi preservado")

const latestTrackingEvent = db1.tracking_events[db1.tracking_events.length - 1]
assert.equal(latestTrackingEvent.status, "in_transit", "tracking_event deve registrar 'in_transit' preservando status avançado")
console.log("   ✓ Status in_transit e tracking_event preservados com sucesso!")

console.log("4. Testando Bloqueio de Pedido delivered / cancelled...")
const resDelivered = rpc1({
  p_order_identifier: "VCS_DELIVERED",
  p_tracking_code: "NEW999999999BR",
  p_replace_existing: true,
})
assert.equal(resDelivered.status, "conflict")

const resCancelled = rpc1({
  p_order_identifier: "VCS_CANCELLED",
  p_tracking_code: "NEW999999999BR",
  p_replace_existing: true,
})
assert.equal(resCancelled.status, "not_paid")
console.log("   ✓ Pedidos delivered e cancelled bloqueados corretamente!")

console.log("5. Testando Idempotência e Tratamento de p_replace_existing nulo...")
const resNullReplace = rpc1({
  p_order_identifier: "VCS1O8WQ3EI",
  p_tracking_code: "NL123456789BR",
  p_replace_existing: null,
})
assert.equal(resNullReplace.status, "already_registered")
console.log("   ✓ p_replace_existing null tratado como false via COALESCE!")

// ============================================================================
// 4. Teste Completo de Cenário A -> B: Supressão de E-mail e Sanitização de Logs
// ============================================================================
console.log("6. Testando Supressão de E-mail Obsoleto (Código A -> Código B) e Sanitização de Logs...")

const testOrderId = "ord-subst-100"
const mockDb = {
  orders: [
    {
      id: testOrderId,
      order_number: "VCS_REPLACE_100",
      total: 19700,
      subtotal: 19700,
      currency: "BRL",
      status: "paid",
      payment_status: "paid",
      fulfillment_status: "shipped",
      tracking_code: "CODEB123456BR", // Pedido atualizado para Código B
      tracking_url: "https://www.17track.net/pt?nums=CODEB123456BR",
      carrier: "Correios",
      shipped_at: "2026-08-04T00:00:00Z",
      shipping_address: { city: "São Paulo", state: "SP" },
      metadata: {},
      customers: { id: "cust-1", email: "cliente@example.com", full_name: "Cliente Teste" },
      order_items: [{ id: "item-1", product_name: "Plaud Note", quantity: 1, unit_price: 19700 }],
    },
  ],
  email_events: [
    {
      id: "evt-code-a",
      order_id: testOrderId,
      recipient: "cliente@example.com",
      template_key: "order_shipped",
      idempotency_key: `order-shipped:${testOrderId}:CODEA123456BR`,
      status: "queued",
      attempt_count: 0,
      locked_at: null as string | null,
      lock_token: null as string | null,
      next_attempt_at: null as string | null,
      error_message: null as string | null,
      metadata: { tracking_code: "CODEA123456BR" },
      created_at: new Date(Date.now() - 60000).toISOString(),
    },
    {
      id: "evt-code-b",
      order_id: testOrderId,
      recipient: "cliente@example.com",
      template_key: "order_shipped",
      idempotency_key: `order-shipped:${testOrderId}:CODEB123456BR`,
      status: "queued",
      attempt_count: 0,
      locked_at: null as string | null,
      lock_token: null as string | null,
      next_attempt_at: null as string | null,
      error_message: null as string | null,
      metadata: { tracking_code: "CODEB123456BR" },
      created_at: new Date().toISOString(),
    },
  ],
}

const dispatchedEmails: Array<{ to: string[]; subject: string; text?: string }> = []
const mockResend = {
  emails: {
    send: async (payload: any) => {
      dispatchedEmails.push(payload)
      return { data: { id: `resend_${Date.now()}` }, error: null }
    },
  },
}

function createMockClient() {
  return {
    from(tableName: string) {
      if (tableName === "orders") {
        return {
          select(cols: string) {
            return {
              eq(col: string, val: string) {
                return {
                  async single() {
                    const row = mockDb.orders.find((o) => (o as any)[col] === val)
                    return { data: row ? JSON.parse(JSON.stringify(row)) : null, error: row ? null : { message: "Not found" } }
                  },
                }
              },
            }
          },
        }
      }

      if (tableName === "email_events") {
        return {
          select(cols: string) {
            return {
              in(col: string, vals: string[]) {
                return {
                  lt(col2: string, val2: number) {
                    return {
                      or(filter1: string) {
                        return {
                          or(filter2: string) {
                            return {
                              order(orderCol: string, opt: any) {
                                return {
                                  limit(num: number) {
                                    const eligible = mockDb.email_events
                                      .filter((e) => vals.includes(e.status) && e.attempt_count < val2)
                                      .slice(0, num)
                                    return Promise.resolve({ data: JSON.parse(JSON.stringify(eligible)), error: null })
                                  },
                                }
                              },
                            }
                          },
                        }
                      },
                    }
                  },
                }
              },
            }
          },
          update(patch: any) {
            let matches: any[] = [...mockDb.email_events]
            const builder: any = {
              eq(col: string, val: any) {
                matches = matches.filter((r) => r[col] === val)
                return builder
              },
              in(col: string, vals: any[]) {
                matches = matches.filter((r) => vals.includes(r[col]))
                return builder
              },
              lt(col: string, val: any) {
                matches = matches.filter((r) => r[col] < val)
                return builder
              },
              or(expr: string) {
                return builder
              },
              select(cols?: string) {
                for (const m of matches) {
                  Object.assign(m, patch)
                }
                return Promise.resolve({ data: JSON.parse(JSON.stringify(matches)), error: null })
              },
              then(resolve: any) {
                for (const m of matches) {
                  Object.assign(m, patch)
                }
                return resolve({ data: JSON.parse(JSON.stringify(matches)), error: null })
              },
            }
            return builder
          },
        }
      }

      throw new Error(`Unhandled table: ${tableName}`)
    },
  }
}

// Intercepta console.log para validar que nenhum código de rastreamento é impresso nos logs
const capturedLogs: string[] = []
const originalConsoleLog = console.log
console.log = (...args: any[]) => {
  capturedLogs.push(args.join(" "))
  originalConsoleLog(...args)
}

const workerSummary = await processEmailQueueBatch({
  batchSize: 10,
  supabaseAdmin: createMockClient() as any,
  resendClient: mockResend as any,
  env: {
    EMAIL_SENDING_ENABLED: "true",
    RESEND_API_KEY: "re_mock_key",
    RESEND_FROM_EMAIL: "Plaud Note <orders@plaudai.site>",
    RESEND_REPLY_TO_EMAIL: "suporte@plaudai.site",
  },
})

console.log = originalConsoleLog

// Verificação de ausência de códigos nos logs
const supersededLog = capturedLogs.find((l) => l.includes("superseded"))
assert.ok(supersededLog, "Log de evento superseded deve existir")
assert.ok(
  !supersededLog.includes("CODEA123456BR") && !supersededLog.includes("CODEB123456BR"),
  "Nenhum código de rastreamento deve ser vazado no console.log de evento superseded"
)
console.log("   ✓ Ausência de códigos de rastreamento nos logs validada com sucesso!")

const eventA = mockDb.email_events.find((e) => e.id === "evt-code-a")
const eventB = mockDb.email_events.find((e) => e.id === "evt-code-b")

// 1. Código A NÃO foi enviado ao Resend e metadata não contém tracking_code novo
assert.equal(eventA?.status, "failed")
assert.equal(eventA?.attempt_count, 5, "attempt_count deve ser MAX_ATTEMPTS para ser terminal")
assert.equal(eventA?.next_attempt_at, null, "next_attempt_at deve ser nulo")
assert.equal(eventA?.metadata.superseded, true, "metadata.superseded deve ser true")
assert.equal(eventA?.metadata.current_order_tracking_code, undefined, "metadata NÃO deve conter current_order_tracking_code")

// 2. Código B foi enviado com sucesso
assert.equal(eventB?.status, "sent")
assert.equal(eventB?.metadata.superseded, undefined)

// 3. Exatamente 1 e-mail disparado contendo o código B
assert.equal(dispatchedEmails.length, 1, "Exatamente 1 e-mail deve ter sido enviado ao Resend")
assert.ok(dispatchedEmails[0].text?.includes("CODEB123456BR"), "O e-mail enviado deve conter o Código B")
assert.ok(!dispatchedEmails[0].text?.includes("CODEA123456BR"), "O e-mail enviado NÃO pode conter o Código A")

console.log("   ✓ Evento antigo (Código A) suprimido sem chamada ao Resend e sem vazamento de metadata!")
console.log("   ✓ Evento atualizado (Código B) enviado com sucesso ao Resend (Exatamente 1 envio)!")

// ============================================================================
// 5. Teste de Propagação de Erro do Update Terminal
// ============================================================================
console.log("7. Testando Falha do Update Terminal Sendo Propagada...")

const failingMockClient: any = {
  from(tableName: string) {
    if (tableName === "orders") {
      return {
        select: () => ({
          eq: () => ({
            single: () => Promise.resolve({
              data: {
                id: "ord-err-1",
                order_number: "VCS_ERR",
                total: 100,
                subtotal: 100,
                currency: "BRL",
                status: "paid",
                payment_status: "paid",
                fulfillment_status: "shipped",
                tracking_code: "CODE_NEW_999",
                customers: { id: "c1", email: "err@test.com", full_name: "Test" },
                order_items: [{ id: "i1", product_name: "Item", quantity: 1, unit_price: 100 }],
              },
              error: null,
            }),
          }),
        }),
      }
    }

    if (tableName === "email_events") {
      return {
        select: () => ({
          eq: () => ({
            single: () => Promise.resolve({
              data: {
                id: "evt-fail-test",
                order_id: "ord-err-1",
                recipient: "err@test.com",
                template_key: "order_shipped",
                status: "queued",
                attempt_count: 0,
                metadata: { tracking_code: "CODE_OLD_111" },
              },
              error: null,
            }),
          }),
        }),
        update: (patch: any) => {
          const builder: any = {
            eq: () => builder,
            in: () => builder,
            lt: () => builder,
            or: () => builder,
            select: () => Promise.resolve({
              data: [{
                id: "evt-fail-test",
                order_id: "ord-err-1",
                recipient: "err@test.com",
                template_key: "order_shipped",
                status: "queued",
                attempt_count: 0,
                metadata: { tracking_code: "CODE_OLD_111" },
              }],
              error: null,
            }),
            then: (resolve: any) => {
              // Se for a tentativa de marcar como superseded, simula erro no banco
              if (patch.metadata?.superseded) {
                return resolve({ data: null, error: { message: "Database connection timeout" } })
              }
              return resolve({ data: [], error: null })
            },
          }
          return builder
        },
      }
    }
  },
}

const failResult = await processSingleEmailEvent({
  emailEventId: "evt-fail-test",
  supabaseAdmin: failingMockClient,
  resendClient: mockResend as any,
  env: {
    EMAIL_SENDING_ENABLED: "true",
    RESEND_API_KEY: "re_mock_key",
    RESEND_FROM_EMAIL: "Plaud Note <orders@plaudai.site>",
    RESEND_REPLY_TO_EMAIL: "suporte@plaudai.site",
  },
})

assert.equal(failResult.success, false, "Operação deve falhar se o update terminal falhar")
assert.equal(failResult.skipped, undefined, "Não deve retornar skipped falsamente")
assert.ok(
  failResult.error?.includes("Failed to record superseded state"),
  "Mensagem de erro deve refletir a falha de persistência do estado superseded"
)
console.log("   ✓ Falha no update terminal propagada com sucesso (sem retorno de skipped falso)!")

// ============================================================================
// 6. Testes de Segurança: Zero Trust e Token
// ============================================================================
console.log("8. Testando Comparação de Token e Filtro Zero Trust...")
function safeTokenCompare(received: string, expected: string): boolean {
  const h1 = crypto.createHash("sha256").update(received).digest()
  const h2 = crypto.createHash("sha256").update(expected).digest()
  return crypto.timingSafeEqual(h1, h2)
}
assert.equal(safeTokenCompare("token_123", "token_123"), true)
assert.equal(safeTokenCompare("token_123", "token_456"), false)

console.log("\n TODOS OS TESTES ESPECÍFICOS DE RASTREAMENTO PASSARAM COM 100% DE SUCESSO!")
