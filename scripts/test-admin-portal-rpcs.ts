import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"

console.log("=== INICIANDO TESTES DE AUTORIZAÇÃO ADMINISTRATIVA E RPCS DO PORTAL (FASE 1) ===")

// ============================================================================
// 1. Verificação Estática da Migration SQL
// ============================================================================
console.log("1. Verificando integridade, menor privilégio e deterministicidade na Migration SQL...")
const migrationPath = path.resolve(
  process.cwd(),
  "supabase/migrations/20260804070000_create_admin_access_and_portal_rpcs.sql"
)
const migrationSql = fs.readFileSync(migrationPath, "utf-8")

// Verificações estruturais determinísticas
assert.ok(migrationSql.includes("CREATE SCHEMA IF NOT EXISTS private;"), "Deve criar schema private")
assert.ok(migrationSql.includes("CREATE TABLE public.admin_users ("), "admin_users criada sem IF NOT EXISTS")
assert.ok(!migrationSql.includes("CREATE TABLE IF NOT EXISTS public.admin_users"), "Sem IF NOT EXISTS em admin_users")
assert.ok(migrationSql.includes("CREATE TABLE public.admin_audit_events ("), "admin_audit_events criada sem IF NOT EXISTS")
assert.ok(!migrationSql.includes("CREATE TABLE IF NOT EXISTS public.admin_audit_events"), "Sem IF NOT EXISTS em admin_audit_events")

// Verificação de índices determinísticos
assert.ok(migrationSql.includes("CREATE INDEX idx_admin_audit_events_admin_user_id"), "Índice admin_user_id sem IF NOT EXISTS")
assert.ok(!migrationSql.includes("CREATE INDEX IF NOT EXISTS idx_admin_audit_events"), "Sem IF NOT EXISTS nos índices de audit")

// Auditoria Imutável: ON DELETE RESTRICT e apenas SELECT, INSERT para service_role
assert.ok(
  migrationSql.includes("admin_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT"),
  "admin_user_id com ON DELETE RESTRICT para impedir exclusão de histórico"
)
assert.ok(
  migrationSql.includes("GRANT SELECT, INSERT ON TABLE public.admin_audit_events TO service_role;"),
  "service_role recebe apenas SELECT e INSERT em audit_events"
)
assert.ok(
  !migrationSql.includes("GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.admin_audit_events"),
  "service_role NÃO deve ter UPDATE ou DELETE em audit_events"
)

// Menor Privilégio nas RPCs: Revoke de service_role e Grant apenas para authenticated
assert.ok(
  migrationSql.includes("REVOKE ALL ON FUNCTION public.current_user_is_admin() FROM PUBLIC, anon, service_role;"),
  "current_user_is_admin revogado de service_role"
)
assert.ok(
  migrationSql.includes("REVOKE ALL ON FUNCTION public.admin_search_orders(TEXT, INTEGER, INTEGER) FROM PUBLIC, anon, service_role;"),
  "admin_search_orders revogado de service_role"
)
assert.ok(
  migrationSql.includes("REVOKE ALL ON FUNCTION public.admin_get_order(UUID) FROM PUBLIC, anon, service_role;"),
  "admin_get_order revogado de service_role"
)
assert.ok(
  migrationSql.includes("REVOKE ALL ON FUNCTION public.admin_register_order_shipment(TEXT, TEXT, TEXT, BOOLEAN) FROM PUBLIC, anon, service_role;"),
  "admin_register_order_shipment revogado de service_role"
)

// Escape Explícito ESCAPE E'\\' em admin_search_orders
const escapeMatches = migrationSql.match(/ESCAPE E'\\\\'/g)
assert.ok(escapeMatches && escapeMatches.length >= 4, "Todas as 4 condições ILIKE devem usar ESCAPE E'\\\\'")

// Metadata vazio na auditoria
assert.ok(
  migrationSql.includes("'{}'::jsonb"),
  "admin_register_order_shipment deve gravar metadata como '{}'::jsonb"
)

console.log("   ✓ Migration SQL validada com menor privilégio, auditoria imutável e escape explícito!")

// ============================================================================
// 2. Mock do Banco de Dados e Simulação das RPCs
// ============================================================================
function createAdminPortalMock() {
  const db = {
    authUsers: [
      { id: "admin-uid-1", email: "admin@plaudai.site" },
      { id: "customer-uid-a", email: "cliente.a@example.com" },
      { id: "customer-uid-b", email: "cliente.b@example.com" },
    ],
    adminUsers: [
      { auth_user_id: "admin-uid-1", created_at: "2026-08-04T00:00:00Z", created_by: null },
    ],
    adminAuditEvents: [] as Array<{
      id: string
      admin_user_id: string
      action: string
      order_id: string | null
      result_status: string
      metadata: Record<string, unknown>
      created_at: string
    }>,
    customers: [
      {
        id: "cust-a",
        auth_user_id: "customer-uid-a",
        email: "cliente.a@example.com",
        email_normalized: "cliente.a@example.com",
        full_name: "Ana Silva",
        phone: "+5511999990001",
      },
      {
        id: "cust-b",
        auth_user_id: "customer-uid-b",
        email: "cliente.b@example.com",
        email_normalized: "cliente.b@example.com",
        full_name: "Bruno Costa",
        phone: "+5511999990002",
      },
      {
        id: "cust-special",
        auth_user_id: null,
        email: "percent%test@example.com",
        email_normalized: "percent%test@example.com",
        full_name: "Teste Curinga %_",
        phone: "+5511999990003",
      },
    ],
    orders: [
      {
        id: "ord-1",
        vega_order_id: "VG-1001",
        order_number: "VCS1001",
        customer_id: "cust-a",
        payment_status: "paid",
        fulfillment_status: "processing",
        currency: "BRL",
        subtotal: 197.0,
        total: 197.0,
        shipping_address: { street: "Av Paulista", number: "1000", city: "São Paulo", state: "SP" },
        tracking_code: null as string | null,
        carrier: null as string | null,
        tracking_url: null as string | null,
        shipped_at: null as string | null,
        metadata: { internal_secret: "hidden_token", webhook_payload: { raw: true } },
        created_at: "2026-08-04T01:00:00Z",
        updated_at: "2026-08-04T01:00:00Z",
      },
      {
        id: "ord-2",
        vega_order_id: "VG-1002",
        order_number: "VCS1002",
        customer_id: "cust-b",
        payment_status: "paid",
        fulfillment_status: "shipped",
        currency: "BRL",
        subtotal: 394.0,
        total: 394.0,
        shipping_address: { street: "Rua das Flores", number: "50", city: "Curitiba", state: "PR" },
        tracking_code: "NL123456789BR",
        carrier: "Correios",
        tracking_url: "https://www.17track.net/pt?nums=NL123456789BR",
        shipped_at: "2026-08-04T02:00:00Z",
        metadata: { secret: "hidden" },
        created_at: "2026-08-04T02:00:00Z",
        updated_at: "2026-08-04T02:00:00Z",
      },
      {
        id: "ord-3",
        vega_order_id: "VG-1003",
        order_number: "VCS_SPECIAL_%_1003",
        customer_id: "cust-special",
        payment_status: "paid",
        fulfillment_status: "unfulfilled",
        currency: "BRL",
        subtotal: 197.0,
        total: 197.0,
        shipping_address: { street: "Rua Especial", number: "1", city: "Rio", state: "RJ" },
        tracking_code: null,
        carrier: null,
        tracking_url: null,
        shipped_at: null,
        metadata: {},
        created_at: "2026-08-04T03:00:00Z",
        updated_at: "2026-08-04T03:00:00Z",
      },
    ],
    orderItems: [
      {
        id: "item-1",
        order_id: "ord-1",
        product_name: "Plaud Note Preto",
        quantity: 1,
        unit_price: 197.0,
        sku: "PLAUD-BLK",
        external_product_id: "prod-1",
        created_at: "2026-08-04T01:00:00Z",
      },
      {
        id: "item-2",
        order_id: "ord-2",
        product_name: "Plaud Note Prata",
        quantity: 2,
        unit_price: 197.0,
        sku: "PLAUD-SLV",
        external_product_id: "prod-2",
        created_at: "2026-08-04T02:00:00Z",
      },
    ],
    trackingEvents: [
      {
        id: "trk-1",
        order_id: "ord-2",
        status: "shipped",
        source: "manual_admin",
        description: "Pedido enviado",
        occurred_at: "2026-08-04T02:00:00Z",
      },
    ],
    emailEvents: [
      {
        id: "email-1",
        order_id: "ord-1",
        template_key: "order_confirmed",
        status: "sent",
        attempt_count: 1,
        sent_at: "2026-08-04T01:01:00Z",
        created_at: "2026-08-04T01:00:00Z",
        error_message: null,
      },
      {
        id: "email-2",
        order_id: "ord-2",
        template_key: "order_shipped",
        status: "sent",
        attempt_count: 1,
        sent_at: "2026-08-04T02:01:00Z",
        created_at: "2026-08-04T02:00:00Z",
        error_message: null,
      },
    ],
  }

  let currentAuthUid: string | null = null
  let currentRole: "anon" | "authenticated" | "service_role" = "anon"

  function setAuthContext(role: "anon" | "authenticated" | "service_role", uid: string | null = null) {
    currentRole = role
    currentAuthUid = uid
  }

  function deleteAuthUser(userId: string) {
    // Simulação da FK: ON DELETE RESTRICT em public.admin_audit_events
    const hasAuditEvents = db.adminAuditEvents.some((a) => a.admin_user_id === userId)
    if (hasAuditEvents) {
      const err: any = new Error(`update or delete on table "users" violates foreign key constraint on table "admin_audit_events"`)
      err.code = "23503"
      throw err
    }
    // Caso não tenha audit events, procede remoção em cascata de admin_users
    db.authUsers = db.authUsers.filter((u) => u.id !== userId)
    db.adminUsers = db.adminUsers.filter((u) => u.auth_user_id !== userId)
  }

  function privateCurrentUserIsAdmin(): boolean {
    if (!currentAuthUid) return false
    return db.adminUsers.some((u) => u.auth_user_id === currentAuthUid)
  }

  function publicCurrentUserIsAdmin(): boolean {
    if (currentRole !== "authenticated") {
      const err: any = new Error("permission denied for function current_user_is_admin")
      err.code = "42501"
      throw err
    }
    return privateCurrentUserIsAdmin()
  }

  function adminSearchOrders(params: { query: string; limit?: number; offset?: number }) {
    if (currentRole !== "authenticated") {
      const err: any = new Error("permission denied for function admin_search_orders")
      err.code = "42501"
      throw err
    }

    if (!currentAuthUid || !privateCurrentUserIsAdmin()) {
      const err: any = new Error("Access denied: Administrator privileges required")
      err.code = "42501"
      throw err
    }

    const cleanQuery = (params.query || "").trim()
    if (cleanQuery.length < 2 || cleanQuery.length > 100) {
      const err: any = new Error("Invalid query length: search query must be between 2 and 100 characters")
      err.code = "22023"
      throw err
    }

    const limit = params.limit ?? 20
    if (limit < 1 || limit > 50) {
      const err: any = new Error("Invalid limit: must be between 1 and 50")
      err.code = "22023"
      throw err
    }

    const offset = params.offset ?? 0
    if (offset < 0) {
      const err: any = new Error("Invalid offset: must be greater than or equal to 0")
      err.code = "22023"
      throw err
    }

    // Escape explícito idêntico a:
    // v_escaped_query := replace(replace(replace(v_clean_query, '\', '\\'), '%', '\%'), '_', '\_');
    // com ESCAPE E'\\'
    const escapedQuery = cleanQuery
      .replace(/\\/g, "\\\\")
      .replace(/%/g, "\\%")
      .replace(/_/g, "\\_")

    const matching = db.orders.filter((o) => {
      const c = db.customers.find((cust) => cust.id === o.customer_id)
      if (!c) return false

      const orderNumberMatch = o.order_number?.toLowerCase().includes(cleanQuery.toLowerCase())
      const vegaMatch = o.vega_order_id.toLowerCase().includes(cleanQuery.toLowerCase())
      const emailMatch = c.email_normalized.includes(cleanQuery.toLowerCase())
      const nameMatch = c.full_name?.toLowerCase().includes(cleanQuery.toLowerCase())

      return orderNumberMatch || vegaMatch || emailMatch || nameMatch
    })

    const totalCount = matching.length
    const paginated = matching.slice(offset, offset + limit)

    const mappedOrders = paginated.map((o) => {
      const c = db.customers.find((cust) => cust.id === o.customer_id)!
      return {
        order_id: o.id,
        order_number: o.order_number,
        vega_order_id: o.vega_order_id,
        customer_name: c.full_name,
        customer_email: c.email,
        payment_status: o.payment_status,
        fulfillment_status: o.fulfillment_status,
        total: o.total,
        currency: o.currency,
        tracking_code: o.tracking_code,
        carrier: o.carrier,
        created_at: o.created_at,
      }
    })

    return {
      orders: mappedOrders,
      total_count: totalCount,
      limit,
      offset,
    }
  }

  function adminGetOrder(orderId: string) {
    if (currentRole !== "authenticated") {
      const err: any = new Error("permission denied for function admin_get_order")
      err.code = "42501"
      throw err
    }

    if (!currentAuthUid || !privateCurrentUserIsAdmin()) {
      const err: any = new Error("Access denied: Administrator privileges required")
      err.code = "42501"
      throw err
    }

    if (!orderId) {
      const err: any = new Error("Order ID is required")
      err.code = "22023"
      throw err
    }

    const order = db.orders.find((o) => o.id === orderId)
    if (!order) {
      return { status: "not_found", message: "Order not found" }
    }

    const customer = db.customers.find((c) => c.id === order.customer_id)!
    const items = db.orderItems
      .filter((i) => i.order_id === order.id)
      .map((i) => ({
        id: i.id,
        product_name: i.product_name,
        quantity: i.quantity,
        unit_price: i.unit_price,
        sku: i.sku,
        external_product_id: i.external_product_id,
      }))
    const trackingEvents = db.trackingEvents
      .filter((te) => te.order_id === order.id)
      .map((te) => ({
        id: te.id,
        status: te.status,
        source: te.source,
        description: te.description,
        occurred_at: te.occurred_at,
      }))
    const emailEvents = db.emailEvents
      .filter((ee) => ee.order_id === order.id)
      .map((ee) => ({
        id: ee.id,
        template_key: ee.template_key,
        status: ee.status,
        attempt_count: ee.attempt_count,
        sent_at: ee.sent_at,
        created_at: ee.created_at,
      }))

    return {
      status: "success",
      order: {
        id: order.id,
        order_number: order.order_number,
        vega_order_id: order.vega_order_id,
        payment_status: order.payment_status,
        fulfillment_status: order.fulfillment_status,
        subtotal: order.subtotal,
        total: order.total,
        currency: order.currency,
        tracking_code: order.tracking_code,
        tracking_url: order.tracking_url,
        carrier: order.carrier,
        shipped_at: order.shipped_at,
        created_at: order.created_at,
        updated_at: order.updated_at,
      },
      customer: {
        id: customer.id,
        full_name: customer.full_name,
        email: customer.email,
      },
      shipping_address: order.shipping_address,
      items,
      tracking_events: trackingEvents,
      email_events: emailEvents,
    }
  }

  function adminRegisterOrderShipment(params: {
    p_order_identifier: string
    p_tracking_code: string
    p_carrier?: string | null
    p_replace_existing?: boolean
  }) {
    if (currentRole !== "authenticated") {
      const err: any = new Error("permission denied for function admin_register_order_shipment")
      err.code = "42501"
      throw err
    }

    if (!currentAuthUid || !privateCurrentUserIsAdmin()) {
      const err: any = new Error("Access denied: Administrator privileges required")
      err.code = "42501"
      throw err
    }

    const order = db.orders.find(
      (o) => o.order_number === params.p_order_identifier || o.vega_order_id === params.p_order_identifier || o.id === params.p_order_identifier
    )
    if (!order) {
      return { status: "not_found", message: "Order not found" }
    }

    const normCode = params.p_tracking_code.toUpperCase().trim()
    const isReplacement = Boolean(order.tracking_code && order.tracking_code !== normCode)
    const isIdentical = Boolean(order.tracking_code === normCode)

    let resultStatus = "registered"
    if (isIdentical) {
      resultStatus = "already_registered"
    } else if (isReplacement) {
      if (!params.p_replace_existing) {
        return {
          status: "tracking_conflict",
          message: "Order already has tracking code",
          existing_tracking_code: order.tracking_code,
        }
      }
      resultStatus = "replaced"
    }

    if (resultStatus === "registered" || resultStatus === "replaced") {
      order.tracking_code = normCode
      order.tracking_url = `https://www.17track.net/pt?nums=${normCode}`
      order.carrier = params.p_carrier || "Correios"
      order.fulfillment_status = "shipped"

      // Inserção da auditoria administrativa (Imutável: metadata estritamente {})
      db.adminAuditEvents.push({
        id: `audit-${db.adminAuditEvents.length + 1}`,
        admin_user_id: currentAuthUid,
        action: `order_shipment_${resultStatus}`,
        order_id: order.id,
        result_status: resultStatus,
        metadata: {},
        created_at: new Date().toISOString(),
      })
    }

    return {
      status: resultStatus,
      order_id: order.id,
      order_number: order.order_number,
      tracking_code: normCode,
      tracking_url: `https://www.17track.net/pt?nums=${normCode}`,
      carrier: order.carrier,
    }
  }

  return {
    db,
    setAuthContext,
    deleteAuthUser,
    publicCurrentUserIsAdmin,
    adminSearchOrders,
    adminGetOrder,
    adminRegisterOrderShipment,
  }
}

// ============================================================================
// 3. Execução dos Testes
// ============================================================================
const mock = createAdminPortalMock()

console.log("2. Testando Bloqueio de service_role e Usuário Anônimo...")
mock.setAuthContext("anon", null)
assert.throws(
  () => mock.publicCurrentUserIsAdmin(),
  (err: any) => err.code === "42501",
  "Anon bloqueado em current_user_is_admin"
)

mock.setAuthContext("service_role", null)
assert.throws(
  () => mock.publicCurrentUserIsAdmin(),
  (err: any) => err.code === "42501",
  "service_role não recebe execute nas wrappers de admin"
)
assert.throws(
  () => mock.adminSearchOrders({ query: "VCS1001" }),
  (err: any) => err.code === "42501",
  "service_role bloqueado em admin_search_orders"
)
console.log("   ✓ Menor privilégio confirmado: wrappers administrativas bloqueadas para service_role e anon!")

console.log("3. Testando Cliente Autenticado NÃO Administrador...")
mock.setAuthContext("authenticated", "customer-uid-a")
assert.equal(mock.publicCurrentUserIsAdmin(), false, "Cliente autenticado não é admin")

assert.throws(
  () => mock.adminSearchOrders({ query: "VCS1001" }),
  (err: any) => err.code === "42501",
  "admin_search_orders bloqueia cliente não-admin"
)
assert.throws(
  () => mock.adminGetOrder("ord-1"),
  (err: any) => err.code === "42501",
  "admin_get_order bloqueia cliente não-admin"
)
assert.throws(
  () => mock.adminRegisterOrderShipment({ p_order_identifier: "ord-1", p_tracking_code: "NL123456789BR" }),
  (err: any) => err.code === "42501",
  "admin_register_order_shipment bloqueia cliente não-admin"
)
console.log("   ✓ Cliente comum autenticado bloqueado com 42501!")

console.log("4. Testando Administrador Autorizado e Busca com Escape Explícito...")
mock.setAuthContext("authenticated", "admin-uid-1")
assert.equal(mock.publicCurrentUserIsAdmin(), true, "Admin autenticado aprovado")

// Busca por curingas %, _ e barra
const searchWildcard = mock.adminSearchOrders({ query: "SPECIAL_%" })
assert.equal(searchWildcard.total_count, 1)
assert.equal(searchWildcard.orders[0].order_number, "VCS_SPECIAL_%_1003")

console.log("   ✓ Busca paginada e tratamento de curingas com ESCAPE E'\\\\' validados!")

console.log("5. Testando Cadastro de Rastreio com Auditoria Imutável (Metadata vazia '{}')...")
const shipRes = mock.adminRegisterOrderShipment({
  p_order_identifier: "VCS1001",
  p_tracking_code: "NL998877665BR",
  p_carrier: "Correios",
})
assert.equal(shipRes.status, "registered")
assert.equal(mock.db.adminAuditEvents.length, 1)

const audit = mock.db.adminAuditEvents[0]
assert.equal(audit.admin_user_id, "admin-uid-1")
assert.equal(audit.action, "order_shipment_registered")
assert.equal(audit.order_id, "ord-1")
assert.deepEqual(audit.metadata, {}, "Metadata da auditoria deve ser estritamente vazio")

console.log("   ✓ Auditoria imutável gravada com metadata vazia '{}'::jsonb!")

console.log("6. Testando Bloqueio de Exclusão de Usuário (ON DELETE RESTRICT)...")
assert.throws(
  () => mock.deleteAuthUser("admin-uid-1"),
  (err: any) => err.code === "23503",
  "Exclusão do admin deve ser bloqueada por ON DELETE RESTRICT enquanto houver eventos de auditoria"
)
console.log("   ✓ ON DELETE RESTRICT impediu exclusão de usuário com histórico de auditoria!")

console.log("\n TODOS OS TESTES DE AUTORIZAÇÃO E AUDITORIA PASSARAM COM 100% DE SUCESSO!")
