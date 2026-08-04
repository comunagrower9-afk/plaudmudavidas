import assert from "node:assert/strict"
import {
  escapeHtml,
  extractFirstName,
  formatCurrencyBRL,
  formatDateBRL,
  formatPaymentMethod,
  formatShippingAddress,
  generateOrderConfirmedSubject,
  generateOrderShippedSubject,
  generateEmailIdempotencyKey,
  generateResendIdempotencyKey,
  resolveProductImage,
  sanitizeErrorMessage,
  normalizeTrackingCode,
  isValidTrackingCode,
  build17TrackUrl,
  isValid17TrackUrl,
} from "../supabase/functions/_shared/email-utils.ts"
import { renderOrderConfirmedEmail } from "../supabase/functions/_shared/email-templates/order-confirmed.ts"
import { renderOrderShippedEmail } from "../supabase/functions/_shared/email-templates/order-shipped.ts"

console.log("=== INICIANDO TESTES UNITÁRIOS DE E-MAIL ===")

// 1. Teste de escapeHtml
console.log("1. Testando escapeHtml...")
assert.equal(escapeHtml("<script>alert('xss')</script>"), "&lt;script&gt;alert(&#039;xss&#039;)&lt;/script&gt;")
assert.equal(escapeHtml('Hello "World" & <Friends>'), "Hello &quot;World&quot; &amp; &lt;Friends&gt;")
assert.equal(escapeHtml(null), "")
assert.equal(escapeHtml(undefined), "")
assert.equal(escapeHtml(12345), "12345")
console.log("   ✓ escapeHtml passou em todos os casos!")

// 2. Teste de formatCurrencyBRL
console.log("2. Testando formatCurrencyBRL...")
const formatted119 = formatCurrencyBRL(119.90).replace(/\u00a0/g, " ") // Trata non-breaking space
assert.ok(formatted119.includes("119,90"), `Esperado 119,90 em ${formatted119}`)
assert.ok(formatted119.includes("R$"), `Esperado R$ em ${formatted119}`)

const formattedZero = formatCurrencyBRL(0).replace(/\u00a0/g, " ")
assert.ok(formattedZero.includes("0,00"), `Esperado 0,00 em ${formattedZero}`)

const formattedInvalid = formatCurrencyBRL("invalid").replace(/\u00a0/g, " ")
assert.ok(formattedInvalid.includes("0,00"), `Esperado 0,00 em ${formattedInvalid}`)
console.log("   ✓ formatCurrencyBRL passou em todos os casos!")

// 3. Teste de extractFirstName
console.log("3. Testando extractFirstName...")
assert.equal(extractFirstName("Carlos Eduardo Silva"), "Carlos")
assert.equal(extractFirstName("MARIA APARECIDA"), "Maria")
assert.equal(extractFirstName("  joão  "), "João")
assert.equal(extractFirstName(""), "")
assert.equal(extractFirstName(null), "")
assert.equal(extractFirstName(undefined), "")
console.log("   ✓ extractFirstName passou em todos os casos!")

// 4. Teste de formatDateBRL e formatPaymentMethod
console.log("4. Testando formatDateBRL e formatPaymentMethod...")
assert.ok(formatDateBRL("2026-08-04T05:30:00.000Z").includes("04/08/2026"))
assert.equal(formatDateBRL(null), "")
assert.equal(formatDateBRL("invalid-date"), "")

assert.equal(formatPaymentMethod("pix"), "Pix")
assert.equal(formatPaymentMethod("credit_card"), "Cartão de Crédito")
assert.equal(formatPaymentMethod("boleto"), "Boleto")
assert.equal(formatPaymentMethod(null), "")
console.log("   ✓ Formatações de data e pagamento passaram em todos os casos!")

// 5. Teste de formatShippingAddress
console.log("5. Testando formatShippingAddress...")
const rawAddr1 = {
  street: "Av. Paulista",
  number: "1000",
  complement: "Apt 42",
  neighborhood: "Bela Vista",
  city: "São Paulo",
  state: "SP",
  zip_code: "01310-100",
}
const formattedAddr1 = formatShippingAddress(rawAddr1)
assert.ok(formattedAddr1 !== null)
assert.equal(formattedAddr1.line1, "Av. Paulista, nº 1000, Apt 42")
assert.equal(formattedAddr1.line2, "Bairro: Bela Vista")
assert.equal(formattedAddr1.line3, "São Paulo - SP")
assert.equal(formattedAddr1.line4, "CEP: 01310-100")

const rawAddrPortugueseKeys = {
  logradouro: "Rua das Flores",
  numero: "50",
  bairro: "Centro",
  cidade: "Curitiba",
  uf: "pr",
  cep: "80000-000",
}
const formattedAddrPt = formatShippingAddress(rawAddrPortugueseKeys)
assert.ok(formattedAddrPt !== null)
assert.equal(formattedAddrPt.line1, "Rua das Flores, nº 50")
assert.equal(formattedAddrPt.line2, "Bairro: Centro")
assert.equal(formattedAddrPt.line3, "Curitiba - PR")
assert.equal(formattedAddrPt.line4, "CEP: 80000-000")

assert.equal(formatShippingAddress(null), null)
assert.equal(formatShippingAddress({}), null)
console.log("   ✓ formatShippingAddress passou em todos os casos!")

// 6. Teste de resolveProductImage (Allowlist)
console.log("6. Testando resolveProductImage...")
const imgPlaud = resolveProductImage("PLAUD NOTE AI Voice Recorder", "PLAUD-NOTE-GRAY")
assert.ok(imgPlaud !== null)
assert.equal(imgPlaud.url, "https://www.plaudai.site/images/email/plaud-note-confirmed.png")
assert.equal(imgPlaud.width, "150")
assert.equal(imgPlaud.height, "150")

const imgUnknown = resolveProductImage("Item Totalmente Desconhecido Sem Mapeamento", "UNKNOWN-SKU-99")
assert.equal(imgUnknown, null, "Item sem mapeamento não deve inventar URL e deve retornar null")
console.log("   ✓ resolveProductImage allowlist validada com sucesso!")

// 7. Teste de Assuntos de E-mail
console.log("7. Testando geradores de assunto...")
assert.equal(generateOrderConfirmedSubject("VCS1O8WQ3EI"), "Pagamento aprovado — pedido #VCS1O8WQ3EI")
assert.equal(generateOrderConfirmedSubject("  98765  "), "Pagamento aprovado — pedido #98765")
assert.equal(generateOrderConfirmedSubject(""), "Pagamento aprovado — pedido #---")
assert.equal(generateOrderShippedSubject("VCS1O8WQ3EI"), "Seu pedido foi enviado — acompanhe a entrega")
assert.equal(generateOrderShippedSubject(), "Seu pedido foi enviado — acompanhe a entrega")
console.log("   ✓ Geradores de assunto passaram em todos os casos!")

// 8. Teste de Rastreamento (Normalização, Validação e URL 17TRACK)
console.log("8. Testando utilitários de rastreamento...")
assert.equal(normalizeTrackingCode("  nl123456789br  "), "NL123456789BR")
assert.equal(normalizeTrackingCode("AB123456CD"), "AB123456CD")
assert.equal(normalizeTrackingCode("inv@lid-code"), null)
assert.equal(normalizeTrackingCode("short"), null)
assert.equal(normalizeTrackingCode(null), null)

assert.equal(isValidTrackingCode("NL123456789BR"), true)
assert.equal(isValidTrackingCode("1234567890"), true)
assert.equal(isValidTrackingCode("INVALID CODE WITH SPACES"), false)
assert.equal(isValidTrackingCode(""), false)

assert.equal(build17TrackUrl("NL123456789BR"), "https://www.17track.net/pt?nums=NL123456789BR")
assert.throws(() => build17TrackUrl("bad code"), /Invalid tracking code/)

assert.equal(isValid17TrackUrl("https://www.17track.net/pt?nums=NL123456789BR"), true)
assert.equal(isValid17TrackUrl("https://www.17track.net/pt?nums=NL123456789BR", "nl123456789br"), true)
assert.equal(isValid17TrackUrl("https://www.17track.net/pt?nums=OTHERCODE", "NL123456789BR"), false)
assert.equal(isValid17TrackUrl("https://malicious-site.com/pt?nums=NL123456789BR"), false)
assert.equal(isValid17TrackUrl("http://www.17track.net/pt?nums=NL123456789BR"), false)
assert.equal(isValid17TrackUrl(null), false)
console.log("   ✓ Utilitários de rastreamento passaram em todos os casos!")

// 9. Teste de Idempotency Keys
console.log("9. Testando chaves de idempotência...")
const orderId = "c89b8823-1d0f-4f64-9a88-751be67b36f1"
assert.equal(generateEmailIdempotencyKey(orderId, "order_confirmed"), `order-confirmed:${orderId}`)
assert.equal(generateResendIdempotencyKey(orderId, "order_confirmed"), `order-confirmed/${orderId}`)
assert.equal(
  generateEmailIdempotencyKey(orderId, "order_shipped", "NL123456789BR"),
  `order-shipped:${orderId}:NL123456789BR`
)
assert.equal(
  generateResendIdempotencyKey(orderId, "order_shipped", "NL123456789BR"),
  `order-shipped/${orderId}/NL123456789BR`
)
assert.ok(generateResendIdempotencyKey(orderId, "order_shipped", "NL123456789BR").length <= 256)
console.log("   ✓ Chaves de idempotência passaram em todos os casos!")

// 10. Teste de renderOrderConfirmedEmail (Padrão Completo)
console.log("10. Testando renderização de template order_confirmed...")
const emailConfirmedData = {
  order_number: "VCS1O8WQ3EI",
  customer_name: "Carlos Silva",
  customer_email: "carlos@example.com",
  total: 119.90,
  subtotal: 119.90,
  created_at: "2026-08-04T05:30:00.000Z",
  payment_method: "pix",
  shipping_address: rawAddr1,
  items: [
    {
      product_name: "Plaud Note - Cinza",
      quantity: 1,
      unit_price: 119.90,
      sku: "PLAUD-NOTE-GRAY",
    },
  ],
}

const renderedConfirmed = renderOrderConfirmedEmail(emailConfirmedData)
assert.equal(renderedConfirmed.subject, "Pagamento aprovado — pedido #VCS1O8WQ3EI")
assert.ok(renderedConfirmed.html.includes("Olá, Carlos."), "HTML deve conter saudação com primeiro nome")
assert.ok(renderedConfirmed.html.includes("#VCS1O8WQ3EI"), "HTML deve conter número do pedido")
assert.ok(renderedConfirmed.html.includes("Plaud Note - Cinza"), "HTML deve conter o item")
assert.ok(renderedConfirmed.html.includes("PAGAMENTO APROVADO"), "HTML deve conter badge PAGAMENTO APROVADO")
assert.ok(renderedConfirmed.text.includes("Olá, Carlos."), "Texto puro deve conter saudação")
console.log("   ✓ renderOrderConfirmedEmail validado com sucesso!")

// 11. Teste de renderOrderShippedEmail (Padrão e Variações)
console.log("11. Testando renderização de template order_shipped...")
const emailShippedData = {
  order_number: "VCS1O8WQ3EI",
  customer_name: "Carlos Silva",
  customer_email: "carlos@example.com",
  tracking_code: "NL123456789BR",
  carrier: "Correios",
  shipped_at: "2026-08-04T10:00:00.000Z",
  estimated_delivery_start: "2026-08-09T12:00:00.000Z",
  estimated_delivery_end: "2026-08-14T12:00:00.000Z",
  shipping_address: rawAddr1,
  items: [
    {
      product_name: "Plaud Note - Cinza",
      quantity: 1,
      unit_price: 119.90,
      sku: "PLAUD-NOTE-GRAY",
    },
  ],
}

const renderedShipped = renderOrderShippedEmail(emailShippedData)
assert.equal(renderedShipped.subject, "Seu pedido foi enviado — acompanhe a entrega")
assert.ok(renderedShipped.html.includes("PEDIDO ENVIADO"), "HTML deve conter badge PEDIDO ENVIADO")
assert.ok(renderedShipped.html.includes("Seu PLAUD está a caminho."), "HTML deve conter título principal")
assert.ok(renderedShipped.html.includes("NL123456789BR"), "HTML deve conter código de rastreamento")
assert.ok(renderedShipped.html.includes("https://www.17track.net/pt?nums=NL123456789BR"), "HTML deve conter link canônico 17TRACK")
assert.ok(renderedShipped.html.includes("ACOMPANHAR NA 17TRACK"), "HTML deve conter CTA da 17TRACK")
assert.ok(renderedShipped.html.includes("Status da entrega"), "HTML deve conter título da timeline")
assert.ok(renderedShipped.html.includes("Correios"), "HTML deve conter transportadora")
assert.ok(renderedShipped.html.includes("09/08/2026 a 14/08/2026"), "HTML deve conter previsão de entrega")
assert.ok(renderedShipped.text.includes("NL123456789BR"), "Texto puro deve conter código")
assert.ok(renderedShipped.text.includes("https://www.17track.net/pt?nums=NL123456789BR"), "Texto puro deve conter link")

// Variações sem transportadora e sem previsão
const emailShippedVariations = {
  order_number: "VG-9999",
  customer_name: null,
  customer_email: "anon@example.com",
  tracking_code: "BR998877665AA",
  tracking_url: "https://invalid-external.com/tracking", // Insegura -> deve substituir pela 17TRACK
  carrier: null,
  shipped_at: null,
  estimated_delivery_start: null,
  estimated_delivery_end: null,
}
const renderedShippedVar = renderOrderShippedEmail(emailShippedVariations)
assert.ok(renderedShippedVar.html.includes("Olá, Cliente."), "HTML deve ter saudação fallback")
assert.ok(renderedShippedVar.html.includes("https://www.17track.net/pt?nums=BR998877665AA"), "URL inválida deve sofrer fallback para 17TRACK segura")
assert.ok(!renderedShippedVar.html.includes("Transportadora"), "Não deve exibir campo transportadora quando nulo")
assert.ok(!renderedShippedVar.html.includes("Previsão de entrega"), "Não deve exibir previsão quando nula")
assert.ok(!renderedShippedVar.html.includes("undefined"), "HTML não deve conter undefined")
assert.ok(!renderedShippedVar.html.includes("null"), "HTML não deve conter null")
console.log("   ✓ renderOrderShippedEmail validado com sucesso!")

// 12. Teste de sanitizeErrorMessage
console.log("12. Testando sanitizeErrorMessage...")
const dirtyError1 = "API Error: Invalid key re_1234567890abcdef_secret for user carlos@domain.com with Bearer token_xyz_123"
const sanitized1 = sanitizeErrorMessage(dirtyError1)
assert.ok(!sanitized1.includes("re_1234567890abcdef_secret"), "Deve remover chave Resend")
assert.ok(sanitized1.includes("[REDACTED_API_KEY]"), "Deve substituir chave Resend por [REDACTED_API_KEY]")
assert.ok(!sanitized1.includes("carlos@domain.com"), "Deve remover e-mail")
assert.ok(sanitized1.includes("[REDACTED_EMAIL]"), "Deve substituir e-mail por [REDACTED_EMAIL]")
assert.ok(!sanitized1.includes("token_xyz_123"), "Deve remover token Bearer")
assert.ok(sanitized1.includes("Bearer [REDACTED_TOKEN]"), "Deve substituir token Bearer")

console.log("   ✓ sanitizeErrorMessage passou em todos os casos de segurança!")

console.log("\n TODOS OS TESTES UNITÁRIOS FORAM EXECUTADOS COM SUCESSO!")
