import assert from "node:assert/strict"
import {
  ensureOrderConfirmedEmailQueued,
  processSingleEmailEvent,
  processEmailQueueBatch,
  acquireEmailLock,
  calculateNextAttemptAt,
  LOCK_LEASE_MS,
  MAX_ATTEMPTS,
} from "../supabase/functions/_shared/email-service.ts"

console.log("=== INICIANDO TESTES DE CONFIABILIDADE DO SISTEMA DE E-MAILS ===")

/**
 * Cria um Mock Supabase Client em memória para testar atomicidade,
 * concorrência, locks de 10 minutos, retries e idempotência.
 */
function createMockSupabase() {
  const db = {
    customers: [
      {
        id: "cust-001",
        email: "carlos@example.com",
        full_name: "Carlos Silva",
      },
    ],
    orders: [
      {
        id: "ord-100",
        order_number: "VG-100200",
        customer_id: "cust-001",
        total: 119.90,
        subtotal: 119.90,
        currency: "BRL",
        shipping_address: {
          street: "Rua Augusta",
          number: "500",
          neighborhood: "Consolação",
          city: "São Paulo",
          state: "SP",
          zip_code: "01304-000",
        },
        customers: {
          id: "cust-001",
          email: "carlos@example.com",
          full_name: "Carlos Silva",
        },
        order_items: [
          {
            id: "item-001",
            product_name: "PLAUD NOTE AI Voice Recorder",
            quantity: 1,
            unit_price: 119.90,
          },
        ],
      },
    ],
    email_events: [] as Array<{
      id: string
      order_id: string
      recipient: string
      template_key: string
      idempotency_key: string
      status: string
      attempt_count: number
      next_attempt_at: string | null
      locked_at: string | null
      lock_token: string | null
      provider_message_id: string | null
      sent_at: string | null
      error_message: string | null
      metadata: Record<string, unknown>
      created_at: string
      updated_at: string
    }>,
  }

  const client: any = {
    db,
    from(tableName: string) {
      if (tableName === "orders") {
        return {
          select(columns: string) {
            return {
              eq(col: string, val: string) {
                return {
                  async single() {
                    const found = db.orders.find((o) => (o as any)[col] === val)
                    if (!found) return { data: null, error: { message: "Order not found" } }
                    return { data: JSON.parse(JSON.stringify(found)), error: null }
                  },
                  async maybeSingle() {
                    const found = db.orders.find((o) => (o as any)[col] === val)
                    return { data: found ? JSON.parse(JSON.stringify(found)) : null, error: null }
                  },
                }
              },
            }
          },
        }
      }

      if (tableName === "email_events") {
        return {
          select(columns: string) {
            return {
              eq(col: string, val: string) {
                return {
                  async single() {
                    const found = db.email_events.find((e) => (e as any)[col] === val)
                    if (!found) return { data: null, error: { message: "Not found" } }
                    return { data: JSON.parse(JSON.stringify(found)), error: null }
                  },
                  async maybeSingle() {
                    const found = db.email_events.find((e) => (e as any)[col] === val)
                    return { data: found ? JSON.parse(JSON.stringify(found)) : null, error: null }
                  },
                }
              },
              in(col: string, vals: string[]) {
                return {
                  lt(ltCol: string, ltVal: number) {
                    return {
                      or(orClause: string) {
                        return {
                          or(secondOrClause: string) {
                            return {
                              order(orderCol: string, opts: any) {
                                return {
                                  limit(limitCount: number) {
                                    const now = new Date()
                                    const leaseThreshold = new Date(now.getTime() - LOCK_LEASE_MS)

                                    const filtered = db.email_events.filter((e) => {
                                      if (!vals.includes(e.status)) return false
                                      if ((e as any)[ltCol] >= ltVal) return false
                                      const nextAttemptReady = !e.next_attempt_at || new Date(e.next_attempt_at) <= now
                                      const lockReady = !e.locked_at || new Date(e.locked_at) <= leaseThreshold
                                      return nextAttemptReady && lockReady
                                    })

                                    return {
                                      data: filtered.slice(0, limitCount).map((e) => ({ id: e.id })),
                                      error: null,
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
            }
          },
          insert(record: any) {
            return {
              select(retCols: string) {
                return {
                  async single() {
                    const existing = db.email_events.find((e) => e.idempotency_key === record.idempotency_key)
                    if (existing) {
                      return {
                        data: null,
                        error: {
                          code: "23505",
                          message: "duplicate key value violates unique constraint idx_email_events_idempotency_key",
                        },
                      }
                    }

                    const newRow = {
                      id: "evt-" + (db.email_events.length + 1),
                      order_id: record.order_id,
                      recipient: record.recipient,
                      template_key: record.template_key,
                      idempotency_key: record.idempotency_key,
                      status: record.status || "queued",
                      attempt_count: record.attempt_count || 0,
                      next_attempt_at: record.next_attempt_at || null,
                      locked_at: record.locked_at || null,
                      lock_token: record.lock_token || null,
                      provider_message_id: null,
                      sent_at: null,
                      error_message: null,
                      metadata: record.metadata || {},
                      created_at: new Date().toISOString(),
                      updated_at: new Date().toISOString(),
                    }
                    db.email_events.push(newRow)
                    return { data: JSON.parse(JSON.stringify(newRow)), error: null }
                  },
                }
              },
            }
          },
          update(updates: any) {
            return {
              eq(col: string, val: string) {
                return {
                  in(statusCol: string, statusVals: string[]) {
                    return {
                      lt(ltCol: string, ltVal: number) {
                        return {
                          or(orCond1: string) {
                            return {
                              or(orCond2: string) {
                                return {
                                  select(selCols: string) {
                                    // Implementação do UPDATE ATÔMICO CONDICIONAL para Lock
                                    const now = new Date()
                                    const leaseThreshold = new Date(now.getTime() - LOCK_LEASE_MS)

                                    const foundIndex = db.email_events.findIndex((e) => {
                                      if ((e as any)[col] !== val) return false
                                      if (!statusVals.includes(e.status)) return false
                                      if ((e as any)[ltCol] >= ltVal) return false

                                      const nextAttemptReady = !e.next_attempt_at || new Date(e.next_attempt_at) <= now
                                      const lockReady = !e.locked_at || new Date(e.locked_at) <= leaseThreshold
                                      return nextAttemptReady && lockReady
                                    })

                                    if (foundIndex === -1) {
                                      return { data: [], error: null }
                                    }

                                    Object.assign(db.email_events[foundIndex], updates, { updated_at: now.toISOString() })
                                    return {
                                      data: [JSON.parse(JSON.stringify(db.email_events[foundIndex]))],
                                      error: null,
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
                  eq(col2: string, val2: string) {
                    // Update condicionado ao lock_token
                    const found = db.email_events.find((e) => (e as any)[col] === val && (e as any)[col2] === val2)
                    if (found) {
                      Object.assign(found, updates, { updated_at: new Date().toISOString() })
                    }
                    return { error: null }
                  },
                  async then(resolve: any) {
                    const found = db.email_events.find((e) => (e as any)[col] === val)
                    if (found) {
                      Object.assign(found, updates, { updated_at: new Date().toISOString() })
                    }
                    return resolve({ error: null })
                  },
                }
              },
            }
          },
        }
      }

      throw new Error(`Unhandled table in mock: ${tableName}`)
    },
  }

  return client
}

/**
 * Cria um Mock Resend Client com rastreamento de chamadas e controle de respostas
 */
function createMockResend() {
  const calls: Array<{ payload: any; options: any }> = []
  let nextResponse: { data?: any; error?: any } = {
    data: { id: "resend_msg_" + Math.random().toString(36).substring(2, 9) },
    error: null,
  }

  return {
    calls,
    setResponse(res: { data?: any; error?: any }) {
      nextResponse = res
    },
    emails: {
      async send(payload: any, options?: any) {
        calls.push({ payload, options })
        return nextResponse
      },
    },
  }
}

async function runReliabilityTests() {
  // =========================================================================
  // TESTE 1: Kill switch desligado: cria queued e zero chamadas ao provedor
  // =========================================================================
  console.log("\n1. Testando Kill Switch Desligado...")
  const supabase1 = createMockSupabase()
  const resend1 = createMockResend()

  const outbox1 = await ensureOrderConfirmedEmailQueued({
    orderId: "ord-100",
    recipientEmail: "carlos@example.com",
    supabaseAdmin: supabase1,
  })

  assert.equal(outbox1.status, "queued")
  assert.equal(supabase1.db.email_events.length, 1)
  assert.equal(supabase1.db.email_events[0].attempt_count, 0)
  assert.equal(supabase1.db.email_events[0].locked_at, null)

  const process1 = await processSingleEmailEvent({
    emailEventId: outbox1.emailEventId,
    supabaseAdmin: supabase1,
    resendClient: resend1,
    env: { EMAIL_SENDING_ENABLED: "false" },
  })

  assert.equal(process1.skipped, true)
  assert.equal(process1.reason, "kill_switch_disabled")
  assert.equal(resend1.calls.length, 0, "Resend NUNCA deve ser chamado quando Kill Switch estiver desligado")
  assert.equal(supabase1.db.email_events[0].attempt_count, 0, "attempt_count não pode aumentar quando kill switch estiver desligado")
  assert.equal(supabase1.db.email_events[0].locked_at, null, "Nenhum lock deve ser adquirido")
  console.log("   ✓ Kill Switch desligado passou com sucesso (0 chamadas, 0 locks)!")

  // =========================================================================
  // TESTE 2: Duas execuções concorrentes: exatamente UMA chamada ao provedor
  // =========================================================================
  console.log("\n2. Testando Duas Execuções Concorrentes (Atomic Lock)...")
  const supabase2 = createMockSupabase()
  const resend2 = createMockResend()

  const outbox2 = await ensureOrderConfirmedEmailQueued({
    orderId: "ord-100",
    recipientEmail: "carlos@example.com",
    supabaseAdmin: supabase2,
  })

  const envConfig = {
    EMAIL_SENDING_ENABLED: "true",
    RESEND_API_KEY: "re_test_123",
    RESEND_FROM_EMAIL: "PLAUD NOTE <pedidos@plaudai.site>",
    RESEND_REPLY_TO_EMAIL: "suporte@plaudai.site",
  }

  // Dispara duas execuções simultâneas
  const [resA, resB] = await Promise.all([
    processSingleEmailEvent({
      emailEventId: outbox2.emailEventId,
      supabaseAdmin: supabase2,
      resendClient: resend2,
      env: envConfig,
    }),
    processSingleEmailEvent({
      emailEventId: outbox2.emailEventId,
      supabaseAdmin: supabase2,
      resendClient: resend2,
      env: envConfig,
    }),
  ])

  assert.equal(resend2.calls.length, 1, "Exatamente UMA chamada deve ser realizada ao Resend")
  const successCount = [resA, resB].filter((r) => r.success && !r.skipped).length
  const skippedCount = [resA, resB].filter((r) => r.skipped && r.reason === "lock_not_acquired_or_not_eligible").length

  assert.equal(successCount, 1, "Exatamente uma execução deve ter sucesso")
  assert.equal(skippedCount, 1, "A segunda execução concorrente deve ser dispensada por falha na aquisição do lock")
  assert.equal(supabase2.db.email_events[0].status, "sent")
  assert.equal(supabase2.db.email_events[0].attempt_count, 1)
  assert.equal(supabase2.db.email_events[0].locked_at, null, "Lock deve ser liberado após envio")
  assert.equal(supabase2.db.email_events[0].lock_token, null)
  console.log("   ✓ Atomic Lock impediu execução concorrente duplicada com perfeição!")

  // =========================================================================
  // TESTE 3: Falha temporária: status failed, attempt_count incrementado e next_attempt_at definido
  // =========================================================================
  console.log("\n3. Testando Falha Temporária de Provedor e Backoff...")
  const supabase3 = createMockSupabase()
  const resend3 = createMockResend()
  resend3.setResponse({ data: null, error: { message: "503 Service Unavailable / concurrent_idempotent_requests" } })

  const outbox3 = await ensureOrderConfirmedEmailQueued({
    orderId: "ord-100",
    recipientEmail: "carlos@example.com",
    supabaseAdmin: supabase3,
  })

  const failRes = await processSingleEmailEvent({
    emailEventId: outbox3.emailEventId,
    supabaseAdmin: supabase3,
    resendClient: resend3,
    env: envConfig,
  })

  assert.equal(failRes.success, false)
  const failedEvent = supabase3.db.email_events[0]
  assert.equal(failedEvent.status, "failed")
  assert.equal(failedEvent.attempt_count, 1)
  assert.ok(failedEvent.next_attempt_at !== null, "next_attempt_at deve estar preenchido para retry")
  assert.ok(new Date(failedEvent.next_attempt_at!).getTime() > Date.now(), "next_attempt_at deve estar no futuro")
  assert.equal(failedEvent.locked_at, null, "Lock deve ser limpo na falha")
  assert.equal(failedEvent.lock_token, null)
  assert.ok(failedEvent.error_message?.includes("503 Service Unavailable"), "Erro sanitizado gravado")
  console.log("   ✓ Falha temporária registrou status failed, attempt_count=1 e next_attempt_at futuro!")

  // =========================================================================
  // TESTE 4: Lease Expirado: evento pode ser recuperado
  // =========================================================================
  console.log("\n4. Testando Recuperação de Lock com Lease Expirado (> 10 min)...")
  const supabase4 = createMockSupabase()
  const resend4 = createMockResend()

  // Simula um evento que ficou travado há 15 minutos atrás por crash de processo
  const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString()
  supabase4.db.email_events.push({
    id: "evt-stuck",
    order_id: "ord-100",
    recipient: "carlos@example.com",
    template_key: "order_confirmed",
    idempotency_key: "order-confirmed:ord-100",
    status: "queued",
    attempt_count: 0,
    next_attempt_at: null,
    locked_at: fifteenMinutesAgo, // Expirado!
    lock_token: "old-dead-token-uuid",
    provider_message_id: null,
    sent_at: null,
    error_message: null,
    metadata: {},
    created_at: fifteenMinutesAgo,
    updated_at: fifteenMinutesAgo,
  })

  const recoverRes = await processSingleEmailEvent({
    emailEventId: "evt-stuck",
    supabaseAdmin: supabase4,
    resendClient: resend4,
    env: envConfig,
  })

  assert.equal(recoverRes.success, true)
  assert.equal(resend4.calls.length, 1)
  assert.equal(supabase4.db.email_events[0].status, "sent")
  console.log("   ✓ Lock expirado (> 10min) foi recuperado e processado com sucesso!")

  // =========================================================================
  // TESTE 5: sent/delivered: ZERO reenvios
  // =========================================================================
  console.log("\n5. Testando Proteção de Estado Terminal (sent/delivered: ZERO reenvios)...")
  const supabase5 = createMockSupabase()
  const resend5 = createMockResend()

  supabase5.db.email_events.push({
    id: "evt-already-sent",
    order_id: "ord-100",
    recipient: "carlos@example.com",
    template_key: "order_confirmed",
    idempotency_key: "order-confirmed:ord-100",
    status: "sent",
    attempt_count: 1,
    next_attempt_at: null,
    locked_at: null,
    lock_token: null,
    provider_message_id: "resend_12345",
    sent_at: new Date().toISOString(),
    error_message: null,
    metadata: {},
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  })

  const skipRes = await processSingleEmailEvent({
    emailEventId: "evt-already-sent",
    supabaseAdmin: supabase5,
    resendClient: resend5,
    env: envConfig,
  })

  assert.equal(skipRes.skipped, true)
  assert.equal(resend5.calls.length, 0, "NUNCA deve chamar o Resend se o status for sent/delivered")
  console.log("   ✓ Evento 'sent' protegido: 0 reenvios!")

  // =========================================================================
  // TESTE 6: Worker processa fila de queued criados anteriormente
  // =========================================================================
  console.log("\n6. Testando Worker de Fila (processEmailQueueBatch)...")
  const supabase6 = createMockSupabase()
  const resend6 = createMockResend()

  // Cria 1 evento queued no banco
  supabase6.db.email_events.push({
    id: "evt-q1",
    order_id: "ord-100",
    recipient: "carlos@example.com",
    template_key: "order_confirmed",
    idempotency_key: "order-confirmed:ord-100",
    status: "queued",
    attempt_count: 0,
    next_attempt_at: null,
    locked_at: null,
    lock_token: null,
    provider_message_id: null,
    sent_at: null,
    error_message: null,
    metadata: {},
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  })

  const batchSummary = await processEmailQueueBatch({
    batchSize: 10,
    supabaseAdmin: supabase6,
    resendClient: resend6,
    env: envConfig,
  })

  assert.equal(batchSummary.totalEligible, 1)
  assert.equal(batchSummary.processed, 1)
  assert.equal(batchSummary.sent, 1)
  assert.equal(resend6.calls.length, 1)
  assert.equal(supabase6.db.email_events[0].status, "sent")
  console.log("   ✓ Worker processou a fila com sucesso!")

  // =========================================================================
  // TESTE 7: Verificação do padrão de chamada ao Resend e Idempotência
  // =========================================================================
  console.log("\n7. Verificando Padrão do SDK Resend, replyTo e Idempotência...")
  const lastCall = resend6.calls[0]
  assert.equal(lastCall.options.idempotencyKey, "order-confirmed/ord-100")
  assert.equal(lastCall.payload.from, "PLAUD NOTE <pedidos@plaudai.site>")
  assert.deepEqual(lastCall.payload.to, ["carlos@example.com"])
  assert.equal(lastCall.payload.replyTo, "suporte@plaudai.site")
  assert.equal(lastCall.payload.subject, "Pagamento aprovado — pedido #VG-100200")
  assert.ok(lastCall.payload.html.includes("Olá, Carlos."))
  assert.ok(lastCall.payload.html.includes("Rua Augusta, nº 500"))
  console.log("   ✓ Chamada ao Resend com replyTo e Idempotência validadas no formato oficial!")

  // =========================================================================
  // TESTE 8: Limite Máximo de Tentativas (MAX_ATTEMPTS = 5)
  // =========================================================================
  console.log("\n8. Testando Limite Máximo de Tentativas (MAX_ATTEMPTS = 5)...")
  assert.equal(calculateNextAttemptAt(1) !== null, true)
  assert.equal(calculateNextAttemptAt(4) !== null, true)
  assert.equal(calculateNextAttemptAt(5), null, "Tentativa 5 (MAX_ATTEMPTS) deve retornar next_attempt_at null")
  assert.equal(calculateNextAttemptAt(6), null, "Tentativas acima de MAX_ATTEMPTS devem retornar null")

  const supabase8 = createMockSupabase()
  const resend8 = createMockResend()
  supabase8.db.email_events.push({
    id: "evt-max-attempts",
    order_id: "ord-100",
    recipient: "carlos@example.com",
    template_key: "order_confirmed",
    idempotency_key: "order-confirmed:ord-100",
    status: "failed",
    attempt_count: 5, // Atingiu o máximo
    next_attempt_at: null,
    locked_at: null,
    lock_token: null,
    provider_message_id: null,
    sent_at: null,
    error_message: "Persistent error",
    metadata: {},
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  })

  // Lock não deve ser adquirido para registro com attempt_count >= 5
  const lock8 = await acquireEmailLock("evt-max-attempts", supabase8)
  assert.equal(lock8.acquired, false, "acquireEmailLock não deve adquirir lock para attempt_count >= MAX_ATTEMPTS")

  const batch8 = await processEmailQueueBatch({
    batchSize: 10,
    supabaseAdmin: supabase8,
    resendClient: resend8,
    env: envConfig,
  })
  assert.equal(batch8.totalEligible, 0, "processEmailQueueBatch não deve selecionar registros com attempt_count >= MAX_ATTEMPTS")
  assert.equal(resend8.calls.length, 0, "Zero chamadas ao provedor para registros esgotados")
  console.log("   ✓ Limite MAX_ATTEMPTS validado com sucesso!")

  // =========================================================================
  // TESTE 9: Obrigatoriedade de RESEND_REPLY_TO_EMAIL com envio ativado
  // =========================================================================
  console.log("\n9. Testando Validação Obrigatória de RESEND_REPLY_TO_EMAIL...")
  const supabase9 = createMockSupabase()
  const resend9 = createMockResend()

  const outbox9 = await ensureOrderConfirmedEmailQueued({
    orderId: "ord-100",
    recipientEmail: "carlos@example.com",
    supabaseAdmin: supabase9,
  })

  const failConfigRes = await processSingleEmailEvent({
    emailEventId: outbox9.emailEventId,
    supabaseAdmin: supabase9,
    resendClient: resend9,
    env: {
      EMAIL_SENDING_ENABLED: "true",
      RESEND_API_KEY: "re_test_123",
      RESEND_FROM_EMAIL: "PLAUD NOTE <pedidos@plaudai.site>",
      // RESEND_REPLY_TO_EMAIL ausente!
    },
  })

  assert.equal(failConfigRes.success, false)
  assert.ok(failConfigRes.error?.includes("Missing required email configuration"), "Deve exigir RESEND_REPLY_TO_EMAIL")
  console.log("   ✓ Validação estrita de configurações passou com sucesso!")

  // =========================================================================
  // TESTE 10: Processamento e Idempotência de E-mail "order_shipped"
  // =========================================================================
  console.log("\n10. Testando Processamento e Idempotência de 'order_shipped'...")
  const supabase10 = createMockSupabase()
  const resend10 = createMockResend()

  // Adiciona pedido com dados de rastreamento
  supabase10.db.orders.push({
    id: "ord-shipped-200",
    order_number: "VG-200300",
    customer_id: "cust-001",
    total: 119.90,
    subtotal: 119.90,
    currency: "BRL",
    tracking_code: "NL123456789BR",
    tracking_url: "https://www.17track.net/pt?nums=NL123456789BR",
    carrier: "Correios",
    shipped_at: "2026-08-04T10:00:00.000Z",
    shipping_address: {
      street: "Rua Augusta",
      number: "500",
      neighborhood: "Consolação",
      city: "São Paulo",
      state: "SP",
      zip_code: "01304-000",
    },
    customers: {
      id: "cust-001",
      email: "carlos@example.com",
      full_name: "Carlos Silva",
    },
    order_items: [
      {
        id: "item-001",
        product_name: "PLAUD NOTE AI Voice Recorder",
        quantity: 1,
        unit_price: 119.90,
      },
    ],
  } as any)

  // Enfileira evento order_shipped
  supabase10.db.email_events.push({
    id: "evt-shipped-1",
    order_id: "ord-shipped-200",
    recipient: "carlos@example.com",
    template_key: "order_shipped",
    idempotency_key: "order-shipped:ord-shipped-200:NL123456789BR",
    status: "queued",
    attempt_count: 0,
    next_attempt_at: new Date().toISOString(),
    locked_at: null,
    lock_token: null,
    provider_message_id: null,
    sent_at: null,
    error_message: null,
    metadata: { tracking_code: "NL123456789BR" },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  })

  const shippedProcessResult = await processSingleEmailEvent({
    emailEventId: "evt-shipped-1",
    supabaseAdmin: supabase10,
    resendClient: resend10,
    env: envConfig,
  })

  assert.equal(shippedProcessResult.success, true, "Envio de order_shipped deve ter sucesso")
  assert.equal(resend10.calls.length, 1, "Exatamente 1 chamada ao Resend")
  const shippedCall = resend10.calls[0]
  assert.equal(shippedCall.payload.subject, "Seu pedido foi enviado — acompanhe a entrega")
  assert.ok(shippedCall.payload.html.includes("NL123456789BR"), "HTML do e-mail enviado deve conter o código de rastreamento")
  assert.ok(shippedCall.payload.html.includes("https://www.17track.net/pt?nums=NL123456789BR"), "HTML do e-mail enviado deve conter URL da 17TRACK")
  assert.equal(shippedCall.options?.idempotencyKey, "order-shipped/ord-shipped-200/NL123456789BR", "Chave de idempotência do Resend formatada corretamente")

  const updatedEvt10 = supabase10.db.email_events.find((e) => e.id === "evt-shipped-1")
  assert.equal(updatedEvt10?.status, "sent")
  assert.equal(updatedEvt10?.attempt_count, 1)

  // Re-tentativa em evento já enviado não deve disparar novamente
  const retryResult = await processSingleEmailEvent({
    emailEventId: "evt-shipped-1",
    supabaseAdmin: supabase10,
    resendClient: resend10,
    env: envConfig,
  })
  assert.equal(retryResult.skipped, true, "Evento já enviado deve ser pulado (skipped: true)")
  assert.equal(resend10.calls.length, 1, "Zero chamadas extras ao Resend")
  console.log("   ✓ Processamento e Idempotência de 'order_shipped' validados com sucesso!")

  console.log("\n TODOS OS TESTES DE CONFIABILIDADE PASSARAM COM 100% DE SUCESSO!")
}

runReliabilityTests().catch((err) => {
  console.error("ERRO NO TESTE:", err)
  process.exit(1)
})
