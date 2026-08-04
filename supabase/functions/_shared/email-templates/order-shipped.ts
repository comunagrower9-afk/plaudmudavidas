import { EMAIL_THEME } from "./email-theme.ts"
import { renderEmailLayout } from "./email-layout.ts"
import {
  escapeHtml,
  extractFirstName,
  formatDateBRL,
  formatShippingAddress,
  resolveProductImage,
  normalizeTrackingCode,
  build17TrackUrl,
  isValid17TrackUrl,
  generateOrderShippedSubject,
} from "../email-utils.ts"

export interface OrderShippedItem {
  product_name: string
  quantity: number
  unit_price?: number
  sku?: string | null
  external_product_id?: string | null
}

export interface OrderShippedEmailData {
  order_number: string
  customer_name?: string | null
  customer_email: string
  tracking_code: string
  tracking_url?: string | null
  carrier?: string | null
  shipped_at?: string | Date | null
  estimated_delivery_start?: string | Date | null
  estimated_delivery_end?: string | Date | null
  shipping_address?: Record<string, unknown> | null
  items?: OrderShippedItem[]
}

export interface RenderedEmail {
  subject: string
  html: string
  text: string
}

/**
 * Renderiza o template de e-mail "Pedido enviado" em padrão visual ultra-premium
 */
export function renderOrderShippedEmail(data: OrderShippedEmailData): RenderedEmail {
  const {
    order_number,
    customer_name,
    customer_email,
    tracking_code,
    tracking_url,
    carrier,
    shipped_at,
    estimated_delivery_start,
    estimated_delivery_end,
    shipping_address,
    items = [],
  } = data

  const cleanTrackingCode = normalizeTrackingCode(tracking_code)
  if (!cleanTrackingCode) {
    throw new Error(`Invalid tracking code provided for order_shipped template: ${String(tracking_code)}`)
  }

  // Validação estrita da URL da 17TRACK: se for inválida ou não corresponder, usa a canônica segura
  let secureTrackingUrl: string
  if (tracking_url && isValid17TrackUrl(tracking_url, cleanTrackingCode)) {
    secureTrackingUrl = tracking_url.trim()
  } else {
    secureTrackingUrl = build17TrackUrl(cleanTrackingCode)
  }

  const firstName = extractFirstName(customer_name)
  const greetingName = firstName ? firstName : "Cliente"
  const orderNumberDisplay = String(order_number || "").trim() || "---"
  const shippedDateFormatted = shipped_at ? formatDateBRL(shipped_at) : formatDateBRL(new Date())

  // Estimativa de entrega segura (apenas se ambas as datas canônicas existirem)
  let deliveryEstimateFormatted: string | null = null
  if (estimated_delivery_start && estimated_delivery_end) {
    const startStr = formatDateBRL(estimated_delivery_start)
    const endStr = formatDateBRL(estimated_delivery_end)
    if (startStr && endStr) {
      deliveryEstimateFormatted = startStr === endStr ? startStr : `${startStr} a ${endStr}`
    }
  }

  const cleanCarrier = typeof carrier === "string" && carrier.trim().length > 0 ? carrier.trim() : null
  const formattedAddress = formatShippingAddress(shipping_address)

  const subject = generateOrderShippedSubject(orderNumberDisplay)
  const preheaderText = `O código de rastreamento do pedido #${orderNumberDisplay} já está disponível.`

  // =========================================================================
  // 1. HERO ESCURO PREMIUM (#0b1020)
  // =========================================================================
  const heroContent = `
    <!-- Badge de Status -->
    <table role="presentation" border="0" cellspacing="0" cellpadding="0" align="center" style="margin: 0 auto 18px auto;">
      <tr>
        <td style="padding: 6px 14px; background-color: rgba(255, 255, 255, 0.08); border: 1px solid rgba(255, 255, 255, 0.18); border-radius: 9999px; font-size: 11px; font-weight: 700; letter-spacing: 1.5px; color: ${EMAIL_THEME.colors.badgeShippedColor}; text-transform: uppercase; text-align: center;">
          PEDIDO ENVIADO
        </td>
      </tr>
    </table>

    <!-- Título Principal -->
    <h1 class="hero-title" style="margin: 0 0 12px 0; font-size: 30px; font-weight: 800; color: ${EMAIL_THEME.colors.heroTextPrimary}; letter-spacing: -0.5px; line-height: 1.2;">
      Seu PLAUD está a caminho.
    </h1>

    <!-- Saudação e Mensagem -->
    <p style="margin: 0 0 12px 0; font-size: 16px; color: ${EMAIL_THEME.colors.heroTextSecondary}; line-height: 1.6; max-width: 480px; margin-left: auto; margin-right: auto;">
      Olá, ${escapeHtml(greetingName)}. Seu pedido foi preparado e já recebeu um código de rastreamento.
    </p>

    <!-- Subtexto -->
    <p style="margin: 0 0 24px 0; font-size: 14px; color: ${EMAIL_THEME.colors.heroTagline}; line-height: 1.5; max-width: 480px; margin-left: auto; margin-right: auto;">
      As primeiras movimentações podem levar algum tempo para aparecer depois da postagem.
    </p>

    <!-- Imagem Hero do Produto -->
    <table role="presentation" border="0" cellspacing="0" cellpadding="0" align="center" style="margin: 0 auto;">
      <tr>
        <td align="center">
          <img src="${EMAIL_THEME.assets.heroProductImageUrl}" alt="PLAUD NOTE" width="${EMAIL_THEME.dimensions.heroImageWidth}" height="${EMAIL_THEME.dimensions.heroImageHeight}" class="hero-product-img" style="display: block; width: ${EMAIL_THEME.dimensions.heroImageWidth}px; max-width: ${EMAIL_THEME.dimensions.heroImageWidth}px; height: auto; margin: 0 auto;" border="0" />
        </td>
      </tr>
    </table>
  `

  // =========================================================================
  // 2. BLOCO DE RASTREAMENTO EM DESTAQUE (#f7f8fa + Monospace + Bulletproof CTA)
  // =========================================================================
  const trackingBoxHtml = `
    <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 26px 20px; text-align: center; margin-bottom: 32px;">
      <div style="font-size: 12px; font-weight: 700; color: ${EMAIL_THEME.colors.textMuted}; text-transform: uppercase; letter-spacing: 1.5px; margin-bottom: 10px;">
        CÓDIGO DE RASTREAMENTO
      </div>
      <div style="font-family: 'Courier New', Courier, monospace; font-size: 24px; font-weight: 800; color: ${EMAIL_THEME.colors.textPrimary}; letter-spacing: 2px; margin-bottom: 20px; word-break: break-all;">
        ${escapeHtml(cleanTrackingCode)}
      </div>

      <!-- Botão Bulletproof para 17TRACK -->
      <table role="presentation" border="0" cellspacing="0" cellpadding="0" align="center" style="margin: 0 auto;">
        <tr>
          <td align="center" style="border-radius: 6px; background-color: #0b1020;">
            <a href="${escapeHtml(secureTrackingUrl)}" target="_blank" rel="noopener noreferrer" style="display: inline-block; padding: 14px 28px; font-family: ${EMAIL_THEME.typography.fontFamily}; font-size: 13px; font-weight: 700; color: #ffffff; text-decoration: none; text-transform: uppercase; letter-spacing: 0.8px; border-radius: 6px; border: 1px solid #0b1020;">
              ACOMPANHAR NA 17TRACK &rarr;
            </a>
          </td>
        </tr>
      </table>

      <!-- Nota da 17TRACK -->
      <div style="font-size: 12px; color: ${EMAIL_THEME.colors.textMuted}; line-height: 1.5; margin-top: 18px; max-width: 440px; margin-left: auto; margin-right: auto;">
        A 17TRACK reúne informações fornecidas pelas transportadoras. Se o código ainda não apresentar movimentações, tente novamente mais tarde.
      </div>
    </div>
  `

  // =========================================================================
  // 3. TIMELINE VERTICAL ("Status da entrega" - 4 etapas)
  // =========================================================================
  const verticalTimelineHtml = `
    <div style="margin-bottom: 34px;">
      <h2 style="margin: 0 0 20px 0; font-size: 19px; font-weight: 700; color: ${EMAIL_THEME.colors.textPrimary}; letter-spacing: -0.3px;">
        Status da entrega
      </h2>
      <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">

        <!-- Etapa 1: Pedido confirmado (Ativa) -->
        <tr>
          <td width="36" valign="top" style="width: 36px; padding: 0 0 4px 0; text-align: center;">
            <table role="presentation" width="30" height="30" border="0" cellspacing="0" cellpadding="0" align="center" style="margin: 0 auto;">
              <tr>
                <td align="center" valign="middle" style="width: 30px; height: 30px; background-color: ${EMAIL_THEME.colors.timelineActiveCircle}; color: #ffffff; border-radius: 50%; font-size: 14px; font-weight: 700; text-align: center; line-height: 30px;">
                  &#10003;
                </td>
              </tr>
            </table>
          </td>
          <td valign="top" style="padding: 3px 0 4px 14px;">
            <div style="font-size: 15px; font-weight: 700; color: ${EMAIL_THEME.colors.timelineActiveText}; line-height: 1.3;">
              Pedido confirmado
            </div>
            <div style="font-size: 13px; color: ${EMAIL_THEME.colors.textMuted}; margin-top: 2px;">
              Pagamento aprovado
            </div>
          </td>
        </tr>

        <!-- Conector 1 (Ativo) -->
        <tr>
          <td width="36" style="width: 36px; padding: 0; text-align: center;">
            <div style="width: 2px; height: 26px; background-color: ${EMAIL_THEME.colors.timelineActiveCircle}; margin: 0 auto;"></div>
          </td>
          <td style="padding: 0;"></td>
        </tr>

        <!-- Etapa 2: Pedido enviado (Ativa) -->
        <tr>
          <td width="36" valign="top" style="width: 36px; padding: 0 0 4px 0; text-align: center;">
            <table role="presentation" width="30" height="30" border="0" cellspacing="0" cellpadding="0" align="center" style="margin: 0 auto;">
              <tr>
                <td align="center" valign="middle" style="width: 30px; height: 30px; background-color: ${EMAIL_THEME.colors.timelineActiveCircle}; color: #ffffff; border-radius: 50%; font-size: 14px; font-weight: 700; text-align: center; line-height: 30px;">
                  &#10003;
                </td>
              </tr>
            </table>
          </td>
          <td valign="top" style="padding: 3px 0 4px 14px;">
            <div style="font-size: 15px; font-weight: 700; color: ${EMAIL_THEME.colors.timelineActiveText}; line-height: 1.3;">
              Pedido enviado
            </div>
            <div style="font-size: 13px; color: ${EMAIL_THEME.colors.textMuted}; margin-top: 2px;">
              Código de rastreamento gerado
            </div>
          </td>
        </tr>

        <!-- Conector 2 (Inativo) -->
        <tr>
          <td width="36" style="width: 36px; padding: 0; text-align: center;">
            <div style="width: 2px; height: 26px; background-color: ${EMAIL_THEME.colors.timelineLine}; margin: 0 auto;"></div>
          </td>
          <td style="padding: 0;"></td>
        </tr>

        <!-- Etapa 3: Em trânsito (Inativa) -->
        <tr>
          <td width="36" valign="top" style="width: 36px; padding: 0; text-align: center;">
            <table role="presentation" width="30" height="30" border="0" cellspacing="0" cellpadding="0" align="center" style="margin: 0 auto;">
              <tr>
                <td align="center" valign="middle" style="width: 30px; height: 30px; background-color: #ffffff; border: 2px solid ${EMAIL_THEME.colors.timelineInactiveBorder}; color: ${EMAIL_THEME.colors.textSubtle}; border-radius: 50%; font-size: 13px; font-weight: 700; text-align: center; line-height: 26px;">
                  3
                </td>
              </tr>
            </table>
          </td>
          <td valign="top" style="padding: 3px 0 0 14px;">
            <div style="font-size: 15px; font-weight: 600; color: ${EMAIL_THEME.colors.textMuted}; line-height: 1.3;">
              Em trânsito
            </div>
            <div style="font-size: 13px; color: ${EMAIL_THEME.colors.textSubtle}; margin-top: 2px;">
              Acompanhe as movimentações no link da 17TRACK
            </div>
          </td>
        </tr>

        <!-- Conector 3 (Inativo) -->
        <tr>
          <td width="36" style="width: 36px; padding: 0; text-align: center;">
            <div style="width: 2px; height: 26px; background-color: ${EMAIL_THEME.colors.timelineLine}; margin: 0 auto;"></div>
          </td>
          <td style="padding: 0;"></td>
        </tr>

        <!-- Etapa 4: Entrega (Inativa) -->
        <tr>
          <td width="36" valign="top" style="width: 36px; padding: 0; text-align: center;">
            <table role="presentation" width="30" height="30" border="0" cellspacing="0" cellpadding="0" align="center" style="margin: 0 auto;">
              <tr>
                <td align="center" valign="middle" style="width: 30px; height: 30px; background-color: #ffffff; border: 2px solid ${EMAIL_THEME.colors.timelineInactiveBorder}; color: ${EMAIL_THEME.colors.textSubtle}; border-radius: 50%; font-size: 13px; font-weight: 700; text-align: center; line-height: 26px;">
                  4
                </td>
              </tr>
            </table>
          </td>
          <td valign="top" style="padding: 3px 0 0 14px;">
            <div style="font-size: 15px; font-weight: 600; color: ${EMAIL_THEME.colors.textMuted}; line-height: 1.3;">
              Entregue
            </div>
            <div style="font-size: 13px; color: ${EMAIL_THEME.colors.textSubtle}; margin-top: 2px;">
              Pacote entregue no seu endereço
            </div>
          </td>
        </tr>

      </table>
    </div>
  `

  // =========================================================================
  // 4. DETALHES DO PEDIDO E PRODUTOS
  // =========================================================================
  const productRowsHtml = items.map((item, idx) => {
    const resolvedImg = resolveProductImage(item.product_name, item.sku, item.external_product_id)
    const isLast = idx === items.length - 1

    const imageHtml = resolvedImg
      ? `<img src="${resolvedImg.url}" alt="${escapeHtml(resolvedImg.alt)}" width="140" height="140" class="product-item-img" style="display: block; width: 140px; max-width: 140px; height: auto; object-fit: contain; margin: 0 auto;" border="0" />`
      : `<table role="presentation" width="130" height="130" border="0" cellspacing="0" cellpadding="0" class="product-item-img" style="width: 130px; height: 130px; background-color: #f1f5f9; border: 1px solid #e2e8f0; border-radius: 6px; margin: 0 auto;">
          <tr>
            <td align="center" valign="middle" style="font-size: 12px; font-weight: 600; color: #64748b; text-align: center; line-height: 1.3; padding: 6px;">
              Plaud Note
            </td>
          </tr>
        </table>`

    return `
      <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="${isLast ? "" : "margin-bottom: 20px; padding-bottom: 20px; border-bottom: 1px solid #edf2f7;"}">
        <tr>
          <td width="150" valign="middle" class="product-stack-img" style="width: 150px; text-align: center; vertical-align: middle;">
            ${imageHtml}
          </td>
          <td valign="middle" class="product-stack-info" style="padding-left: 20px; vertical-align: middle;">
            <div style="font-size: 18px; font-weight: 700; color: ${EMAIL_THEME.colors.textPrimary}; line-height: 1.3;">
              ${escapeHtml(item.product_name)}
            </div>
            <div style="font-size: 14px; color: ${EMAIL_THEME.colors.textMuted}; margin-top: 6px;">
              ${item.quantity} ${item.quantity === 1 ? "unidade" : "unidades"}
            </div>
          </td>
        </tr>
      </table>
    `
  }).join("")

  const productBoxHtml = items.length > 0
    ? `
    <div class="product-box" style="background-color: ${EMAIL_THEME.colors.cardBackground}; border-radius: 8px; padding: 24px 22px; margin-bottom: 34px; border: 1px solid #f1f5f9;">
      ${productRowsHtml}
    </div>
  `
    : ""

  // =========================================================================
  // 5. INFORMAÇÕES DE ENVIO E ENDEREÇO
  // =========================================================================
  const infoRows = [
    `<tr>
      <td style="padding: 7px 0; font-size: 12px; font-weight: 500; color: ${EMAIL_THEME.colors.textMuted}; text-transform: uppercase; letter-spacing: 0.5px;">
        Pedido
      </td>
      <td align="right" style="padding: 7px 0; font-size: 15px; font-weight: 700; color: ${EMAIL_THEME.colors.textPrimary}; text-align: right;">
        #${escapeHtml(orderNumberDisplay)}
      </td>
    </tr>`,
    `<tr>
      <td style="padding: 7px 0; font-size: 12px; font-weight: 500; color: ${EMAIL_THEME.colors.textMuted}; text-transform: uppercase; letter-spacing: 0.5px;">
        Data de envio
      </td>
      <td align="right" style="padding: 7px 0; font-size: 15px; font-weight: 600; color: ${EMAIL_THEME.colors.textPrimary}; text-align: right;">
        ${escapeHtml(shippedDateFormatted)}
      </td>
    </tr>`,
  ]

  if (cleanCarrier) {
    infoRows.push(`
      <tr>
        <td style="padding: 7px 0; font-size: 12px; font-weight: 500; color: ${EMAIL_THEME.colors.textMuted}; text-transform: uppercase; letter-spacing: 0.5px;">
          Transportadora
        </td>
        <td align="right" style="padding: 7px 0; font-size: 15px; font-weight: 600; color: ${EMAIL_THEME.colors.textPrimary}; text-align: right;">
          ${escapeHtml(cleanCarrier)}
        </td>
      </tr>
    `)
  }

  if (deliveryEstimateFormatted) {
    infoRows.push(`
      <tr>
        <td style="padding: 7px 0; font-size: 12px; font-weight: 500; color: ${EMAIL_THEME.colors.textMuted}; text-transform: uppercase; letter-spacing: 0.5px;">
          Previsão de entrega
        </td>
        <td align="right" style="padding: 7px 0; font-size: 15px; font-weight: 600; color: ${EMAIL_THEME.colors.textPrimary}; text-align: right;">
          ${escapeHtml(deliveryEstimateFormatted)}
        </td>
      </tr>
    `)
  }

  const shippingInfoHtml = `
    <div style="border-top: 1px solid ${EMAIL_THEME.colors.divider}; padding-top: 24px; margin-bottom: 28px;">
      <h2 style="margin: 0 0 16px 0; font-size: 18px; font-weight: 700; color: ${EMAIL_THEME.colors.textPrimary}; letter-spacing: -0.3px;">
        Dados da remessa
      </h2>
      <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
        ${infoRows.join("")}
      </table>
    </div>
  `

  const addressHtml = formattedAddress
    ? `
    <div style="border-top: 1px solid ${EMAIL_THEME.colors.divider}; padding-top: 24px; margin-bottom: 28px;">
      <div style="font-size: 12px; font-weight: 700; color: ${EMAIL_THEME.colors.textMuted}; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px;">
        Endereço de Entrega
      </div>
      <div style="font-size: 15px; font-weight: 500; color: ${EMAIL_THEME.colors.textPrimary}; line-height: 1.5;">
        ${formattedAddress.lines.map((l) => escapeHtml(l)).join("<br />")}
      </div>
    </div>
  `
    : ""

  // =========================================================================
  // 6. BLOCO DE SUPORTE
  // =========================================================================
  const supportHtml = `
    <div style="border-top: 1px solid ${EMAIL_THEME.colors.divider}; padding-top: 22px; text-align: center;">
      <div style="font-size: 13px; color: ${EMAIL_THEME.colors.textMuted}; line-height: 1.5;">
        Precisa de ajuda com a entrega? Responda diretamente a este e-mail.
      </div>
    </div>
  `

  const bodyContent = `
    ${trackingBoxHtml}
    ${verticalTimelineHtml}
    ${productBoxHtml}
    ${shippingInfoHtml}
    ${addressHtml}
    ${supportHtml}
  `

  const html = renderEmailLayout({
    title: subject,
    preheaderText,
    heroContent,
    bodyContent,
  })

  // =========================================================================
  // 7. VERSÃO EM TEXTO PURO (UNIVERSAL FALLBACK)
  // =========================================================================
  const textItems = items
    .map((item) => `- ${item.product_name} (Qtd: ${item.quantity})`)
    .join("\n")

  const textLines: string[] = [
    "PLAUD NOTE",
    "====================================",
    "SEU PLAUD ESTÁ A CAMINHO",
    "====================================",
    "",
    `Olá, ${greetingName}.`,
    "Seu pedido foi preparado e já recebeu um código de rastreamento.",
    "As primeiras movimentações podem levar algum tempo para aparecer depois da postagem.",
    "",
    "CÓDIGO DE RASTREAMENTO:",
    cleanTrackingCode,
    "",
    "ACOMPANHAR NA 17TRACK:",
    secureTrackingUrl,
    "",
    "STATUS DA ENTREGA:",
    "[✓] Pedido confirmado - Pagamento aprovado",
    "[✓] Pedido enviado - Código de rastreamento gerado",
    "[ ] Em trânsito",
    "[ ] Entregue",
    "",
    "DADOS DA REMESSA:",
    `Pedido: #${orderNumberDisplay}`,
    `Data de envio: ${shippedDateFormatted}`,
  ]

  if (cleanCarrier) {
    textLines.push(`Transportadora: ${cleanCarrier}`)
  }

  if (deliveryEstimateFormatted) {
    textLines.push(`Previsão de entrega: ${deliveryEstimateFormatted}`)
  }

  if (textItems) {
    textLines.push("", "PRODUTOS:", textItems)
  }

  if (formattedAddress) {
    textLines.push(
      "",
      "ENDEREÇO DE ENTREGA:",
      formattedAddress.lines.join("\n")
    )
  }

  textLines.push(
    "",
    "A 17TRACK reúne informações fornecidas pelas transportadoras.",
    "Se o código ainda não apresentar movimentações, tente novamente mais tarde.",
    "",
    "Precisa de ajuda com a entrega? Responda diretamente a este e-mail.",
    "Plaud Note Brasil - https://www.plaudai.site"
  )

  const text = textLines.join("\n")

  return {
    subject,
    html,
    text,
  }
}
