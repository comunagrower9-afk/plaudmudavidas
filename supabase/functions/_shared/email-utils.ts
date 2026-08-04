/**
 * Utilitários puros para formatação, sanitização e geração de templates de e-mail
 */

/**
 * Escapa caracteres HTML para mitigar XSS em e-mails
 */
export function escapeHtml(str: unknown): string {
  if (str == null) return ""
  const stringVal = String(str)
  const map: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  }
  return stringVal.replace(/[&<>"']/g, (char) => map[char] || char)
}

/**
 * Formata um valor numérico para a moeda Real Brasileiro (BRL)
 * Ex: 119.9 -> "R$ 119,90"
 */
export function formatCurrencyBRL(amount: number | string | null | undefined): string {
  const num = typeof amount === "number" ? amount : Number(amount)
  if (!Number.isFinite(num)) {
    return "R$ 0,00"
  }
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(num)
}

/**
 * Extrai apenas o primeiro nome do cliente para uma saudação cordial
 * Ex: "Carlos Eduardo Silva" -> "Carlos"
 */
export function extractFirstName(fullName: unknown): string {
  if (typeof fullName !== "string" || fullName.trim() === "") {
    return ""
  }
  const cleanName = fullName.trim()
  const parts = cleanName.split(/\s+/)
  const firstName = parts[0] || ""
  if (!firstName) return ""
  // Capitaliza a primeira letra preservando o restante em minúsculas
  return firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase()
}

export interface FormattedAddress {
  line1: string // Logradouro, Número, Complemento
  line2: string // Bairro
  line3: string // Cidade - UF
  line4: string // CEP
  fullInline: string
  lines: string[]
}

/**
 * Formata com segurança o endereço de entrega vindo da Vega
 */
export function formatShippingAddress(
  rawAddress: Record<string, unknown> | null | undefined
): FormattedAddress | null {
  if (!rawAddress || typeof rawAddress !== "object" || Object.keys(rawAddress).length === 0) {
    return null
  }

  const street = String(rawAddress.street || rawAddress.logradouro || rawAddress.address || "").trim()
  const number = String(rawAddress.number || rawAddress.numero || "").trim()
  const complement = String(rawAddress.complement || rawAddress.complemento || "").trim()
  const neighborhood = String(rawAddress.neighborhood || rawAddress.bairro || "").trim()
  const city = String(rawAddress.city || rawAddress.cidade || "").trim()
  const state = String(rawAddress.state || rawAddress.uf || rawAddress.estado || "").trim().toUpperCase()
  const zipCode = String(rawAddress.zip_code || rawAddress.zipcode || rawAddress.cep || "").trim()

  const line1Parts = [street, number ? `nº ${number}` : "", complement].filter(Boolean)
  const line1 = line1Parts.join(", ")

  const line2 = neighborhood ? `Bairro: ${neighborhood}` : ""

  const line3Parts = [city, state].filter(Boolean)
  const line3 = line3Parts.join(" - ")

  const line4 = zipCode ? `CEP: ${zipCode}` : ""

  const lines = [line1, line2, line3, line4].filter(Boolean)
  const fullInline = lines.join(" | ")

  if (lines.length === 0) {
    return null
  }

  return {
    line1,
    line2,
    line3,
    line4,
    fullInline,
    lines,
  }
}

/**
 * Gera o assunto padrão do e-mail de confirmação de pagamento/pedido
 */
export function generateOrderConfirmedSubject(orderNumber: string): string {
  const cleanOrderNumber = String(orderNumber || "").trim() || "---"
  return `Pagamento aprovado — pedido #${cleanOrderNumber}`
}

/**
 * Formata data no padrão brasileiro pt-BR (ex: "04/08/2026")
 */
export function formatDateBRL(dateInput: string | number | Date | null | undefined): string {
  if (!dateInput) return ""
  try {
    const date = typeof dateInput === "string" || typeof dateInput === "number" ? new Date(dateInput) : dateInput
    if (isNaN(date.getTime())) return ""
    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      timeZone: "America/Sao_Paulo",
    }).format(date)
  } catch {
    return ""
  }
}

/**
 * Formata método de pagamento para exibição amigável
 */
export function formatPaymentMethod(methodInput: unknown): string {
  if (!methodInput || typeof methodInput !== "string") return ""
  const normalized = methodInput.trim().toLowerCase()
  if (normalized === "pix") return "Pix"
  if (normalized === "credit_card" || normalized === "credit" || normalized === "cartao") return "Cartão de Crédito"
  if (normalized === "bank_slip" || normalized === "billet" || normalized === "boleto") return "Boleto"
  return normalized.charAt(0).toUpperCase() + normalized.slice(1)
}

export interface ResolvedProductImage {
  url: string
  alt: string
  width: string
  height: string
}

/**
 * Mapa estrito e allowlisted de imagens de produtos hospedadas no domínio canônico plaudai.site
 */
export const ALLOWED_PRODUCT_IMAGES: Record<string, { url: string; alt: string }> = {
  "plaud-note": {
    url: "https://www.plaudai.site/images/email/plaud-note-confirmed.png",
    alt: "PLAUD NOTE AI Voice Recorder",
  },
  "plaud-note-cinza": {
    url: "https://www.plaudai.site/images/email/plaud-note-confirmed.png",
    alt: "PLAUD NOTE Cinza",
  },
  "plaud-note-preto": {
    url: "https://www.plaudai.site/images/email/plaud-note-confirmed.png",
    alt: "PLAUD NOTE Preto",
  },
  "plaud-note-prata": {
    url: "https://www.plaudai.site/images/email/plaud-note-confirmed.png",
    alt: "PLAUD NOTE Prata",
  },
  "plaud-note-azul": {
    url: "https://www.plaudai.site/images/email/plaud-note-confirmed.png",
    alt: "PLAUD NOTE Azul",
  },
  "plaud-note-starlight": {
    url: "https://www.plaudai.site/images/email/plaud-note-confirmed.png",
    alt: "PLAUD NOTE Starlight",
  },
}

/**
 * Resolve com segurança a imagem oficial do produto a partir de allowlist interna
 * Nunca utiliza URLs vindas de requisição externa ou metadata inseguro.
 */
export function resolveProductImage(
  productName?: string | null,
  sku?: string | null,
  externalProductId?: string | null
): ResolvedProductImage | null {
  const identifiers = [sku, externalProductId, productName]
    .filter((v): v is string => typeof v === "string" && v.trim().length > 0)
    .map((v) => v.toLowerCase().trim())

  if (identifiers.length === 0) {
    return null
  }

  // Verifica mapeamento exato
  for (const id of identifiers) {
    if (ALLOWED_PRODUCT_IMAGES[id]) {
      return {
        url: ALLOWED_PRODUCT_IMAGES[id].url,
        alt: ALLOWED_PRODUCT_IMAGES[id].alt,
        width: "150",
        height: "150",
      }
    }
  }

  // Se qualquer identificador contiver "plaud" ou "note", usa a imagem oficial canônica
  const isPlaudProduct = identifiers.some(
    (id) => id.includes("plaud") || id.includes("note") || id.includes("gravador")
  )

  if (isPlaudProduct) {
    return {
      url: "https://www.plaudai.site/images/email/plaud-note-confirmed.png",
      alt: productName ? String(productName).trim() : "PLAUD NOTE AI Voice Recorder",
      width: "150",
      height: "150",
    }
  }

  // Não inventa URL e não usa imagens externas; retorna null para renderizar placeholder neutro
  return null
}

/**
 * Gera o assunto padrão do e-mail de confirmação de envio
 */
export function generateOrderShippedSubject(_orderNumber?: string): string {
  return "Seu pedido foi enviado — acompanhe a entrega"
}

/**
 * Normaliza e valida um código de rastreamento (6-50 caracteres alfanuméricos)
 */
export function normalizeTrackingCode(code: unknown): string | null {
  if (typeof code !== "string") return null
  const cleaned = code.trim().toUpperCase()
  if (/^[A-Z0-9]{6,50}$/.test(cleaned)) {
    return cleaned
  }
  return null
}

/**
 * Valida se um código de rastreamento atende às regras alfanuméricas
 */
export function isValidTrackingCode(code: unknown): boolean {
  return normalizeTrackingCode(code) !== null
}

/**
 * Constrói a URL canônica da 17TRACK para consulta de rastreamento
 */
export function build17TrackUrl(trackingCode: string): string {
  const normalized = normalizeTrackingCode(trackingCode)
  if (!normalized) {
    throw new Error(`Invalid tracking code: ${trackingCode}`)
  }
  return `https://www.17track.net/pt?nums=${encodeURIComponent(normalized)}`
}

/**
 * Valida estritamente se uma URL de rastreamento é da 17TRACK e corresponde ao código
 */
export function isValid17TrackUrl(url: unknown, expectedTrackingCode?: string): boolean {
  if (typeof url !== "string" || !url.trim()) return false
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== "https:") return false
    if (parsed.hostname !== "www.17track.net") return false
    if (parsed.pathname !== "/pt") return false

    const nums = parsed.searchParams.get("nums")
    if (!nums || !isValidTrackingCode(nums)) return false

    if (expectedTrackingCode) {
      const cleanExpected = normalizeTrackingCode(expectedTrackingCode)
      if (nums.toUpperCase() !== cleanExpected) return false
    }

    return true
  } catch {
    return false
  }
}

/**
 * Gera a idempotency key para o banco de dados (public.email_events)
 */
export function generateEmailIdempotencyKey(
  orderId: string,
  templateKey = "order_confirmed",
  trackingCode?: string
): string {
  const prefix = templateKey.replace(/_/g, "-")
  if (trackingCode && templateKey === "order_shipped") {
    const cleanCode = normalizeTrackingCode(trackingCode) || trackingCode.trim().toUpperCase()
    return `${prefix}:${orderId}:${cleanCode}`
  }
  return `${prefix}:${orderId}`
}

/**
 * Gera a chave de idempotência para o cabeçalho Idempotency-Key da API do Resend
 * Limite de 256 caracteres respeitado.
 */
export function generateResendIdempotencyKey(
  orderId: string,
  templateKey = "order_confirmed",
  trackingCode?: string
): string {
  const prefix = templateKey.replace(/_/g, "-")
  if (trackingCode && templateKey === "order_shipped") {
    const cleanCode = normalizeTrackingCode(trackingCode) || trackingCode.trim().toUpperCase()
    return `${prefix}/${orderId}/${cleanCode}`.slice(0, 256)
  }
  const key = `${prefix}/${orderId}`
  return key.slice(0, 256)
}

/**
 * Sanitiza mensagens de erro removendo e-mails, chaves de API, tokens Bearer,
 * JWTs, URLs com queries sensíveis e senhas antes de registrar em logs ou banco de dados.
 */
export function sanitizeErrorMessage(error: unknown): string {
  if (error == null) return "Unknown error"
  let message = error instanceof Error ? error.message : String(error)

  // 1. Resend API Keys (re_[a-zA-Z0-9_]+)
  message = message.replace(/re_[a-zA-Z0-9_\-]+/gi, "[REDACTED_API_KEY]")

  // 2. Bearer tokens
  message = message.replace(/Bearer\s+[a-zA-Z0-9_\-\.]+/gi, "Bearer [REDACTED_TOKEN]")

  // 3. JWTs / long tokens (eyJ...)
  message = message.replace(/eyJ[a-zA-Z0-9_\-]+\.[a-zA-Z0-9_\-]+\.[a-zA-Z0-9_\-]+/gi, "[REDACTED_JWT]")

  // 4. Emails
  message = message.replace(/[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+/gi, "[REDACTED_EMAIL]")

  // 5. URLs with query strings
  message = message.replace(/https?:\/\/[^\s"'<>]+\?[^\s"'<>]+/gi, (matched) => {
    try {
      const url = new URL(matched)
      return `${url.origin}${url.pathname}?[REDACTED_QUERY]`
    } catch {
      return "[REDACTED_URL_WITH_QUERY]"
    }
  })

  // 6. Generic sensitive parameters (password, secret, token, apikey, api_key, etc.)
  message = message.replace(/(password|secret|token|apikey|api_key|transaction_token)\s*[:=]\s*["']?[^,\s"'}]+/gi, "$1=[REDACTED]")

  return message.slice(0, 500)
}
