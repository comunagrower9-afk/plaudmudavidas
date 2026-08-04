/**
 * Módulo de sanitização rigorosa para a página de obrigado (/obrigado).
 * Trata todos os parâmetros da URL como entrada potencialmente hostil.
 */

export interface SanitizedCustomerContext {
  firstName: string | null
  maskedEmail: string | null
}

/**
 * Sanitiza o parâmetro customer_name:
 * - Decodifica e normaliza Unicode (NFC)
 * - Remove caracteres de controle
 * - Aceita exclusivamente letras Unicode, acentos/diacríticos, espaços, hífen e apóstrofo
 * - Elimina espaços repetidos e extrai apenas o primeiro nome
 * - Limita o resultado a 40 caracteres
 * - Retorna null caso contenha tags HTML, caracteres inválidos ou formatação inadequada
 */
export function sanitizeCustomerName(rawName: unknown): string | null {
  if (typeof rawName !== 'string') return null

  // 1. Normalizar Unicode e remover caracteres de controle
  const normalized = rawName
    .normalize('NFC')
    // Remove caracteres de controle ASCII e Unicode (0x00-0x1F, 0x7F-0x9F)
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, '')
    .trim()

  if (!normalized) return null

  // 2. Rejeitar qualquer caractere que não seja letra Unicode, marca de acentuação, espaço, hífen ou apóstrofo
  // Rejeita explicitamente tags HTML (<, >), aspas, dígitos, símbolos especiais, barras, etc.
  const validNameRegex = /^[\p{L}\p{M}\s'-]+$/u
  if (!validNameRegex.test(normalized)) {
    return null
  }

  // 3. Eliminar espaços múltiplos e extrair apenas o primeiro nome
  const collapsed = normalized.replace(/\s+/g, ' ').trim()
  const firstName = collapsed.split(' ')[0]

  if (!firstName || firstName.length === 0) return null

  // 4. Limitar a 40 caracteres
  const trimmedLength = firstName.slice(0, 40)

  // Re-validar se a string resultante ainda contém pelo menos uma letra Unicode
  if (!/\p{L}/u.test(trimmedLength)) {
    return null
  }

  return trimmedLength
}

/**
 * Sanitiza e mascara o parâmetro customer_email:
 * - Limita o valor bruto a 254 caracteres
 * - Valida a estrutura canônica de e-mail (local@domain.tld)
 * - Nunca expõe o e-mail completo
 * - Retorna formato mascarado: primeira letra + '***@' + domínio (ex: carlos@gmail.com -> c***@gmail.com)
 * - Retorna null em caso de formato inválido
 */
export function sanitizeAndMaskEmail(rawEmail: unknown): string | null {
  if (typeof rawEmail !== 'string') return null

  const trimmed = rawEmail.trim()
  // Limite máximo de tamanho do RFC 5321 (254 caracteres)
  if (!trimmed || trimmed.length > 254) return null

  // E-mails são case-insensitive para o domínio e para o propósito de exibição
  const lower = trimmed.toLowerCase()

  // Validação de estrutura canônica de e-mail
  const parts = lower.split('@')
  if (parts.length !== 2) return null

  const [localPart, domainPart] = parts
  if (!localPart || !domainPart) return null

  // Local part deve ter entre 1 e 64 caracteres e caracteres válidos
  if (localPart.length < 1 || localPart.length > 64) return null
  const validLocalRegex = /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+$/
  if (!validLocalRegex.test(localPart)) return null

  // Domínio deve ter entre 3 e 253 caracteres, conter pelo menos um ponto e TLD válido
  if (domainPart.length < 3 || domainPart.length > 253) return null
  const validDomainRegex = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/
  if (!validDomainRegex.test(domainPart)) return null

  // Primeira letra da parte local para a máscara
  const firstChar = localPart.charAt(0)
  if (!/[a-z0-9]/.test(firstChar)) return null

  return `${firstChar}***@${domainPart}`
}

/**
 * Type guard rigoroso para validar o objeto SanitizedCustomerContext
 */
export function isSanitizedCustomerContext(value: unknown): value is SanitizedCustomerContext {
  if (!value || typeof value !== 'object') return false
  const ctx = value as Record<string, unknown>

  const isValidFirstName =
    ctx.firstName === null ||
    (typeof ctx.firstName === 'string' &&
      ctx.firstName.length > 0 &&
      ctx.firstName.length <= 40 &&
      /^[\p{L}\p{M}'-]+$/u.test(ctx.firstName))

  const isValidMaskedEmail =
    ctx.maskedEmail === null ||
    (typeof ctx.maskedEmail === 'string' &&
      /^[a-z0-9]\*\*\*@[a-z0-9.-]+\.[a-z]{2,}$/i.test(ctx.maskedEmail))

  return Boolean(isValidFirstName && isValidMaskedEmail)
}

/**
 * Processa a query string e limpa a URL imediatamente através de history.replaceState,
 * descartando integralmente CPF, telefone, UTMs e qualquer outro dado não autorizado.
 */
export function extractAndCleanUrlParams(): SanitizedCustomerContext {
  if (typeof window === 'undefined') {
    return { firstName: null, maskedEmail: null }
  }

  // 1. Verificar se já existe contexto sanitizado seguro em history.state
  const existingState = window.history.state
  if (
    existingState &&
    typeof existingState === 'object' &&
    'sanitizedCustomerContext' in existingState &&
    isSanitizedCustomerContext(existingState.sanitizedCustomerContext)
  ) {
    return existingState.sanitizedCustomerContext
  }

  // 2. Se houver query parameters na URL, extrair SOMENTE nome e e-mail e sanitizá-los
  const search = window.location.search
  let firstName: string | null = null
  let maskedEmail: string | null = null

  if (search && search.length > 1) {
    try {
      const params = new URLSearchParams(search)
      const rawName = params.get('customer_name')
      const rawEmail = params.get('customer_email')

      firstName = sanitizeCustomerName(rawName)
      maskedEmail = sanitizeAndMaskEmail(rawEmail)
    } catch {
      // Falha segura
      firstName = null
      maskedEmail = null
    }

    // 3. Limpeza imediata da URL: remover todos os parâmetros da barra de endereços
    try {
      const prevState = (existingState && typeof existingState === 'object') ? existingState : {}
      const safeState = {
        ...prevState,
        sanitizedCustomerContext: {
          firstName,
          maskedEmail,
        },
      }
      window.history.replaceState(safeState, '', window.location.pathname)
    } catch {
      // Ignorar erros de history se ambiente restrito
    }
  }

  return { firstName, maskedEmail }
}
