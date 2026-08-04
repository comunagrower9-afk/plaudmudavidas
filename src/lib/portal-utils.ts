import type { FulfillmentStatus, PaymentStatus } from '../types/portal.types'

/**
 * Gera URL segura da 17TRACK com validação rigorosa.
 */
export function build17TrackUrl(trackingCode: string): string {
  const cleanCode = (trackingCode || '').trim().toUpperCase()
  if (!cleanCode) return ''
  return `https://www.17track.net/pt?nums=${encodeURIComponent(cleanCode)}`
}

/**
 * Valida se uma URL pertence estritamente ao domínio oficial da 17TRACK (/pt?nums=...)
 */
export function isValid17TrackUrl(url: string, expectedCode?: string): boolean {
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'https:') return false
    if (parsed.hostname !== 'www.17track.net') return false
    if (parsed.pathname !== '/pt') return false

    if (expectedCode) {
      const codeParam = parsed.searchParams.get('nums')
      if (codeParam?.toUpperCase() !== expectedCode.toUpperCase()) return false
    }
    return true
  } catch {
    return false
  }
}

/**
 * Valida o formato canônico de código de rastreamento (6 a 50 caracteres alfanuméricos)
 */
export function isValidTrackingCode(code: string): boolean {
  const clean = (code || '').trim().toUpperCase()
  return /^[A-Z0-9]{6,50}$/.test(clean)
}

/**
 * Formata valores monetários em BRL.
 */
export function formatCurrencyBRL(amount: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(amount)
}

/**
 * Formata datas ISO em formato brasileiro amigável.
 */
export function formatDateBRL(isoString: string): string {
  try {
    const date = new Date(isoString)
    if (isNaN(date.getTime())) return isoString
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date)
  } catch {
    return isoString
  }
}

/**
 * Extrai o primeiro nome de um nome completo.
 */
export function extractFirstName(fullName: string | null | undefined): string {
  if (!fullName) return 'Cliente'
  const trimmed = fullName.trim()
  const first = trimmed.split(/\s+/)[0]
  return first || 'Cliente'
}

/**
 * Mapeia fulfillment_status para rótulo amigável em português.
 */
export function getFulfillmentStatusLabel(status: FulfillmentStatus): string {
  switch (status) {
    case 'unfulfilled':
      return 'Pedido confirmado'
    case 'processing':
      return 'Em preparação'
    case 'shipped':
      return 'Pedido enviado'
    case 'in_transit':
      return 'Em trânsito'
    case 'out_for_delivery':
      return 'Saiu para entrega'
    case 'delivered':
      return 'Entregue'
    case 'exception':
      return 'Atualização necessária'
    case 'returned':
      return 'Devolvido'
    case 'cancelled':
      return 'Cancelado'
    default:
      return status
  }
}

/**
 * Mapeia payment_status para rótulo em português.
 */
export function getPaymentStatusLabel(status: PaymentStatus): string {
  switch (status) {
    case 'paid':
      return 'Pago'
    case 'pending':
      return 'Pendente'
    case 'failed':
      return 'Falhou'
    case 'cancelled':
      return 'Cancelado'
    case 'refunded':
      return 'Reembolsado'
    case 'chargeback':
      return 'Chargeback'
    default:
      return status
  }
}

/**
 * Verifica se a numeração é declarada explicitamente como sem número (S/N, SN, SEM NUMERO, etc.)
 */
export function isExplicitlyWithoutNumber(val: unknown): boolean {
  if (val === null || val === undefined) return false
  const str = String(val).trim().toLowerCase()
  return ['sn', 's/n', 's.n.', 's/nº', 'sem numero', 'sem número', 'sem-numero'].includes(str)
}

/**
 * Verifica se o número do endereço está verdadeiramente ausente (null, undefined, vazio ou espaços).
 */
export function isMissingAddressNumber(val: unknown): boolean {
  if (val === null || val === undefined) return true
  const str = String(val).trim()
  if (!str) return true
  const lower = str.toLowerCase()
  if (['nao informado', 'não informado', 'n/a', 'nenhum'].includes(lower)) return true
  return false
}

/**
 * Formata o número do endereço:
 * - Se verdadeiramente ausente: "Número não informado"
 * - Se explicitamente sem número (S/N, etc.): "S/N"
 * - Se preenchido com valor: retorna o próprio valor sanitizado
 */
export function formatAddressNumber(val: unknown): string {
  if (isMissingAddressNumber(val)) {
    return 'Número não informado'
  }
  if (isExplicitlyWithoutNumber(val)) {
    return 'S/N'
  }
  return String(val).trim()
}

export interface AddressValidationResult {
  isIncomplete: boolean
  isMissingNumber: boolean
  missingFields: string[]
}

/**
 * Valida a completude do endereço de entrega.
 * Trata S/N como endereço válido (não incompleto).
 * Identifica ausências de street, number, city, state e zip_code.
 */
export function validateShippingAddress(address: Record<string, unknown> | null | undefined): AddressValidationResult {
  if (!address) {
    return {
      isIncomplete: true,
      isMissingNumber: true,
      missingFields: ['Endereço completo'],
    }
  }

  const missingFields: string[] = []

  const street = typeof address.street === 'string' ? address.street.trim() : ''
  if (!street) missingFields.push('Logradouro/Rua')

  // Número é considerado ausente somente se não foi informado e não for S/N explícito
  const isNumMissing = isMissingAddressNumber(address.number)
  if (isNumMissing) {
    missingFields.push('Número')
  }

  const city = typeof address.city === 'string' ? address.city.trim() : ''
  if (!city) missingFields.push('Cidade')

  const state = typeof address.state === 'string' ? address.state.trim() : ''
  if (!state) missingFields.push('Estado')

  const zip = typeof address.zip_code === 'string' ? address.zip_code.trim() : ''
  if (!zip) missingFields.push('CEP')

  return {
    isIncomplete: missingFields.length > 0,
    isMissingNumber: isNumMissing,
    missingFields,
  }
}
