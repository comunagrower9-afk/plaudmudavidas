import { EMAIL_THEME } from "./email-theme.ts"
import {
  escapeHtml,
  extractFirstName,
  formatCurrencyBRL,
  formatDateBRL,
  formatPaymentMethod,
  formatShippingAddress,
  generateOrderConfirmedSubject,
  resolveProductImage,
} from "../email-utils.ts"
import { renderEmailLayout } from "./email-layout.ts"

export interface OrderConfirmedItem {
  product_name: string
  quantity: number
  unit_price: number
  sku?: string | null
  external_product_id?: string | null
}

export interface OrderConfirmedEmailData {
  order_number: string
  customer_name?: string | null
  customer_email?: string | null
  total: number
  subtotal?: number
  shipping_address?: Record<string, unknown> | null
  created_at?: string | null
  payment_method?: string | null
  items: OrderConfirmedItem[]
}

export interface RenderedEmail {
  subject: string
  html: string
  text: string
}

/**
 * Renderiza o template de e-mail de "Pedido confirmado" na nova direção de arte:
 * Editorial, minimalista, alto contraste, hero dark navy #0b1020, produto como protagonista,
 * timeline vertical, detalhes do pedido sem card cinza, footer escuro #0b1020.
 */
export function renderOrderConfirmedEmail(data: OrderConfirmedEmailData): RenderedEmail {
  const {
    order_number,
    customer_name,
    total,
    shipping_address,
    created_at,
    payment_method,
    items = [],
  } = data

  const firstName = extractFirstName(customer_name)
  const greetingName = firstName ? `Olá, ${firstName}.` : "Olá."
  const greetingPlain = firstName ? `Olá, ${firstName}.` : "Olá."
  const subject = generateOrderConfirmedSubject(order_number)
  const preheaderText = "Recebemos seu pagamento e seu pedido já entrou na fila de preparação."

  const formattedAddress = formatShippingAddress(shipping_address)
  const dateFormatted = formatDateBRL(created_at) || formatDateBRL(new Date())
  const paymentFormatted = formatPaymentMethod(payment_method)
  const totalFormatted = formatCurrencyBRL(total)

  // =========================================================================
  // 1. HERO CONTENT (Dark Navy #0b1020 com imagem grande do Plaud Note)
  // =========================================================================
  const heroContent = `
    <!-- Selo Verde PAGAMENTO APROVADO -->
    <div style="margin-bottom: 16px;">
      <span style="display: inline-block; background-color: ${EMAIL_THEME.colors.successBadgeBg}; border: 1px solid ${EMAIL_THEME.colors.successBadgeBorder}; border-radius: 16px; padding: 4px 14px; font-size: 11px; font-weight: 700; color: ${EMAIL_THEME.colors.successBadgeText}; letter-spacing: 0.8px; text-transform: uppercase;">
        PAGAMENTO APROVADO
      </span>
    </div>

    <!-- Título Principal Branco -->
    <h1 class="hero-title" style="margin: 0 0 14px 0; font-size: 32px; font-weight: 700; color: #ffffff; line-height: 1.25; letter-spacing: -0.5px;">
      Seu novo PLAUD está confirmado.
    </h1>

    <!-- Texto de Confirmação -->
    <p style="margin: 0 0 8px 0; font-size: 15px; font-weight: 500; color: #ffffff; line-height: 1.5;">
      ${escapeHtml(greetingName)} Seu pagamento foi aprovado e o seu pedido já entrou na fila de preparação.
    </p>
    <p style="margin: 0 auto 20px auto; font-size: 14px; line-height: 1.6; color: ${EMAIL_THEME.colors.heroTextSecondary}; max-width: 480px;">
      Assim que ele for enviado, o código de rastreamento chegará neste mesmo e-mail.
    </p>

    <!-- Imagem Protagonista do Plaud Note (Hero 300px) -->
    <div style="margin: 24px auto 12px auto; text-align: center;">
      <img src="${EMAIL_THEME.assets.heroProductImageUrl}" alt="PLAUD NOTE" width="${EMAIL_THEME.dimensions.heroProductWidth}" height="${EMAIL_THEME.dimensions.heroProductHeight}" class="hero-product-img" style="display: block; margin: 0 auto; width: 300px; max-width: 300px; height: auto;" border="0" />
    </div>

    <!-- Tagline Discreta da Marca -->
    <div style="font-size: 11px; font-weight: 600; color: ${EMAIL_THEME.colors.heroTagline}; letter-spacing: 2.5px; text-transform: uppercase; margin-top: 12px;">
      GRAVE &middot; TRANSCREVA &middot; ORGANIZE
    </div>
  `

  // =========================================================================
  // 2. DETALHES DO PEDIDO (Editorial, linhas limpas sem card externo)
  // =========================================================================
  const orderDetailsHtml = `
    <div style="margin-bottom: 32px;">
      <h2 style="margin: 0 0 16px 0; font-size: 20px; font-weight: 700; color: ${EMAIL_THEME.colors.textPrimary}; letter-spacing: -0.3px;">
        Detalhes do pedido
      </h2>
      <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
        <tr>
          <td style="padding: 7px 0; font-size: 12px; font-weight: 500; color: ${EMAIL_THEME.colors.textMuted}; text-transform: uppercase; letter-spacing: 0.5px;">
            Pedido
          </td>
          <td align="right" style="padding: 7px 0; font-size: 15px; font-weight: 600; color: ${EMAIL_THEME.colors.textPrimary}; text-align: right;">
            #${escapeHtml(order_number)}
          </td>
        </tr>
        <tr>
          <td style="padding: 7px 0; font-size: 12px; font-weight: 500; color: ${EMAIL_THEME.colors.textMuted}; text-transform: uppercase; letter-spacing: 0.5px;">
            Data
          </td>
          <td align="right" style="padding: 7px 0; font-size: 15px; font-weight: 600; color: ${EMAIL_THEME.colors.textPrimary}; text-align: right;">
            ${escapeHtml(dateFormatted)}
          </td>
        </tr>
        ${
          paymentFormatted
            ? `<tr>
          <td style="padding: 7px 0; font-size: 12px; font-weight: 500; color: ${EMAIL_THEME.colors.textMuted}; text-transform: uppercase; letter-spacing: 0.5px;">
            Pagamento
          </td>
          <td align="right" style="padding: 7px 0; font-size: 15px; font-weight: 600; color: ${EMAIL_THEME.colors.textPrimary}; text-align: right;">
            ${escapeHtml(paymentFormatted)}
          </td>
        </tr>`
            : ""
        }
        <tr>
          <td style="padding: 12px 0 0 0; font-size: 13px; font-weight: 700; color: ${EMAIL_THEME.colors.textPrimary}; text-transform: uppercase; letter-spacing: 0.5px; border-top: 1px solid ${EMAIL_THEME.colors.divider};">
            Total
          </td>
          <td align="right" style="padding: 12px 0 0 0; font-size: 18px; font-weight: 800; color: ${EMAIL_THEME.colors.textPrimary}; text-align: right; border-top: 1px solid ${EMAIL_THEME.colors.divider};">
            ${escapeHtml(totalFormatted)}
          </td>
        </tr>
      </table>
    </div>
  `

  // =========================================================================
  // 3. PRODUTO COMO PROTAGONISTA (Box #f7f8fa, imagem 140–180px e frase de marca)
  // =========================================================================
  const productRowsHtml = items.map((item, idx) => {
    const itemTotal = (item.quantity || 1) * (item.unit_price || 0)
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
              ${item.quantity} ${item.quantity === 1 ? "unidade" : "unidades"} &bull; ${escapeHtml(formatCurrencyBRL(item.unit_price))}
            </div>
            ${
              item.sku
                ? `<div style="font-size: 11px; color: ${EMAIL_THEME.colors.textSubtle}; margin-top: 3px;">SKU: ${escapeHtml(item.sku)}</div>`
                : ""
            }
            <div style="font-size: 16px; font-weight: 800; color: ${EMAIL_THEME.colors.textPrimary}; margin-top: 8px;">
              ${escapeHtml(formatCurrencyBRL(itemTotal))}
            </div>
          </td>
        </tr>
      </table>
    `
  }).join("")

  const productSectionHtml = `
    <div class="product-box" style="margin-bottom: 36px; background-color: ${EMAIL_THEME.colors.productSectionBackground}; border: 1px solid ${EMAIL_THEME.colors.borderLight}; border-radius: 8px; padding: 24px;">
      ${productRowsHtml}
      <div style="margin-top: 18px; padding-top: 16px; border-top: 1px solid ${EMAIL_THEME.colors.borderLight}; font-size: 13px; font-style: italic; color: ${EMAIL_THEME.colors.textMuted}; text-align: center; line-height: 1.5;">
        &ldquo;Um novo jeito de registrar ideias, reuniões e conversas importantes.&rdquo;
      </div>
    </div>
  `

  // =========================================================================
  // 4. TIMELINE VERTICAL ("O que acontece agora" - Tabela HTML pura)
  // =========================================================================
  const verticalTimelineHtml = `
    <div style="margin-bottom: 36px;">
      <h2 style="margin: 0 0 20px 0; font-size: 20px; font-weight: 700; color: ${EMAIL_THEME.colors.textPrimary}; letter-spacing: -0.3px;">
        O que acontece agora
      </h2>
      <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">

        <!-- Etapa 1: Pedido confirmado -->
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

        <!-- Conector 1 -->
        <tr>
          <td width="36" style="width: 36px; padding: 0; text-align: center;">
            <div style="width: 2px; height: 26px; background-color: ${EMAIL_THEME.colors.timelineLine}; margin: 0 auto;"></div>
          </td>
          <td style="padding: 0;"></td>
        </tr>

        <!-- Etapa 2: Preparação -->
        <tr>
          <td width="36" valign="top" style="width: 36px; padding: 0 0 4px 0; text-align: center;">
            <table role="presentation" width="30" height="30" border="0" cellspacing="0" cellpadding="0" align="center" style="margin: 0 auto;">
              <tr>
                <td align="center" valign="middle" style="width: 30px; height: 30px; background-color: #ffffff; border: 2px solid ${EMAIL_THEME.colors.timelineInactiveBorder}; color: ${EMAIL_THEME.colors.textSecondary}; border-radius: 50%; font-size: 13px; font-weight: 700; text-align: center; line-height: 26px;">
                  2
                </td>
              </tr>
            </table>
          </td>
          <td valign="top" style="padding: 3px 0 4px 14px;">
            <div style="font-size: 15px; font-weight: 600; color: ${EMAIL_THEME.colors.textPrimary}; line-height: 1.3;">
              Preparação
            </div>
            <div style="font-size: 13px; color: ${EMAIL_THEME.colors.textMuted}; margin-top: 2px;">
              Seu pedido será separado para envio
            </div>
          </td>
        </tr>

        <!-- Conector 2 -->
        <tr>
          <td width="36" style="width: 36px; padding: 0; text-align: center;">
            <div style="width: 2px; height: 26px; background-color: ${EMAIL_THEME.colors.timelineLine}; margin: 0 auto;"></div>
          </td>
          <td style="padding: 0;"></td>
        </tr>

        <!-- Etapa 3: Envio -->
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
              Envio
            </div>
            <div style="font-size: 13px; color: ${EMAIL_THEME.colors.textSubtle}; margin-top: 2px;">
              Você receberá o rastreamento por e-mail
            </div>
          </td>
        </tr>

      </table>
    </div>
  `

  // =========================================================================
  // 5. ENTREGA (Com divisórias finas)
  // =========================================================================
  const deliveryHtml = formattedAddress
    ? `
    <div style="margin-bottom: 32px; padding: 24px 0; border-top: 1px solid ${EMAIL_THEME.colors.divider}; border-bottom: 1px solid ${EMAIL_THEME.colors.divider};">
      <h2 style="margin: 0 0 12px 0; font-size: 18px; font-weight: 700; color: ${EMAIL_THEME.colors.textPrimary}; letter-spacing: -0.3px;">
        Entrega
      </h2>
      ${customer_name ? `<div style="font-size: 14px; font-weight: 700; color: ${EMAIL_THEME.colors.textPrimary}; margin-bottom: 4px;">${escapeHtml(customer_name)}</div>` : ""}
      ${formattedAddress.lines.map((l) => `<div style="font-size: 14px; line-height: 1.5; color: ${EMAIL_THEME.colors.textSecondary};">${escapeHtml(l)}</div>`).join("")}
    </div>
  `
    : `
    <div style="margin-bottom: 32px; padding-top: 16px; border-top: 1px solid ${EMAIL_THEME.colors.divider};"></div>
  `

  // =========================================================================
  // 6. SUPORTE HUMANO E PREVENÇÃO DE CONTESTAÇÃO
  // =========================================================================
  const supportHtml = `
    <div style="margin-bottom: 12px;">
      <h3 style="margin: 0 0 6px 0; font-size: 15px; font-weight: 700; color: ${EMAIL_THEME.colors.textPrimary};">
        Não reconhece este pedido?
      </h3>
      <p style="margin: 0; font-size: 13px; line-height: 1.5; color: ${EMAIL_THEME.colors.textMuted};">
        Responda diretamente a este e-mail. Nossa equipe verificará a compra com você e ajudará a resolver a situação.
      </p>
      <div style="margin-top: 8px; font-size: 11px; color: ${EMAIL_THEME.colors.textSubtle};">
        Esta confirmação foi enviada porque uma compra foi realizada em plaudai.site.
      </div>
    </div>
  `

  const bodyContent = `
    ${orderDetailsHtml}
    ${productSectionHtml}
    ${verticalTimelineHtml}
    ${deliveryHtml}
    ${supportHtml}
  `

  const html = renderEmailLayout({
    title: subject,
    preheaderText,
    heroContent,
    bodyContent,
  })

  // =========================================================================
  // VERSÃO TEXTO PURO (PLAIN TEXT)
  // =========================================================================
  const itemsText = items
    .map((item) => {
      const unit = formatCurrencyBRL(item.unit_price)
      const itemTot = formatCurrencyBRL((item.quantity || 1) * (item.unit_price || 0))
      const skuLine = item.sku ? ` (SKU: ${item.sku})` : ""
      return `- ${item.product_name}${skuLine}\n  Qtd: ${item.quantity} | Unit: ${unit} | Subtotal: ${itemTot}`
    })
    .join("\n")

  const addressText = formattedAddress
    ? `\nENTREGA:\n${customer_name ? customer_name + "\n" : ""}${formattedAddress.lines.join("\n")}\n`
    : ""

  const text = `PLAUD NOTE — GRAVADOR DE VOZ COM INTELIGÊNCIA ARTIFICIAL
https://www.plaudai.site

PAGAMENTO APROVADO
============================================================
SEU NOVO PLAUD ESTÁ CONFIRMADO.

${greetingPlain} Seu pagamento foi aprovado e o seu pedido já entrou na fila de preparação.
Assim que ele for enviado, o código de rastreamento chegará neste mesmo e-mail.

GRAVE · TRANSCREVA · ORGANIZE

DETALHES DO PEDIDO:
------------------------------------------------------------
Pedido: #${order_number}
Data: ${dateFormatted}${paymentFormatted ? `\nPagamento: ${paymentFormatted}` : ""}
Total: ${totalFormatted}

ITENS DO PEDIDO:
------------------------------------------------------------
${itemsText}

"Um novo jeito de registrar ideias, reuniões e conversas importantes."

O QUE ACONTECE AGORA:
------------------------------------------------------------
[✓] 1. Pedido confirmado — Pagamento aprovado
[ ] 2. Preparação — Seu pedido será separado para envio
[ ] 3. Envio — Você receberá o rastreamento por e-mail
${addressText}
NÃO RECONHECE ESTE PEDIDO?
------------------------------------------------------------
Responda diretamente a este e-mail. Nossa equipe verificará a compra com você e ajudará a resolver a situação.
Esta confirmação foi enviada porque uma compra foi realizada em plaudai.site.

------------------------------------------------------------
Plaud Note Brasil
Em caso de dúvida, responda diretamente a este e-mail.
https://www.plaudai.site
`

  return {
    subject,
    html,
    text,
  }
}
