import { EMAIL_THEME } from "./email-theme.ts"
import { escapeHtml } from "../email-utils.ts"

export interface EmailLayoutOptions {
  title: string
  preheaderText?: string
  heroContent: string
  bodyContent: string
}

/**
 * Estrutura base de e-mail (HTML Skeleton) de alta tecnologia e compatibilidade universal.
 * Design editorial: barra superior branca com logo, hero em dark navy #0b1020, corpo em branco #ffffff
 * com divisórias finas e footer escuro #0b1020.
 */
export function renderEmailLayout(options: EmailLayoutOptions): string {
  const { title, preheaderText = "", heroContent, bodyContent } = options

  // Preheader invisível com caracteres de preenchimento para evitar puxar textos indesejados
  const preheaderHtml = preheaderText
    ? `
  <!-- Preheader Invisível para Leitores de E-mail -->
  <div style="display: none; font-size: 1px; line-height: 1px; max-height: 0px; max-width: 0px; opacity: 0; overflow: hidden; mso-hide: all; font-family: sans-serif; color: ${EMAIL_THEME.colors.heroBackground};">
    ${escapeHtml(preheaderText)}
    &#847;&zwnj;&nbsp;&#8199;&shy;&#847;&zwnj;&nbsp;&#8199;&shy;&#847;&zwnj;&nbsp;&#8199;&shy;&#847;&zwnj;&nbsp;&#8199;&shy;&#847;&zwnj;&nbsp;&#8199;&shy;
  </div>`
    : ""

  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="pt-BR">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="x-apple-disable-message-reformatting" />
  <title>${escapeHtml(title)}</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
  <style type="text/css">
    body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { -ms-interpolation-mode: bicubic; border: 0; outline: none; text-decoration: none; }
    body { margin: 0; padding: 0; width: 100% !important; height: 100% !important; background-color: #0b1020; }
    @media only screen and (max-width: 620px) {
      .email-container { width: 100% !important; max-width: 100% !important; border-radius: 0 !important; }
      .hero-cell { padding: 36px 20px 24px 20px !important; }
      .hero-title { font-size: 26px !important; line-height: 1.25 !important; }
      .hero-product-img { width: 240px !important; max-width: 240px !important; }
      .body-cell { padding: 28px 18px !important; }
      .product-box { padding: 16px 14px !important; }
      .product-stack-img { display: block !important; width: 100% !important; text-align: center !important; margin: 0 auto 14px auto !important; }
      .product-stack-info { display: block !important; width: 100% !important; padding: 0 !important; }
      .product-item-img { width: 120px !important; height: 120px !important; margin: 0 auto !important; }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: ${EMAIL_THEME.colors.outerBackground}; font-family: ${EMAIL_THEME.typography.fontFamily}; color: ${EMAIL_THEME.colors.textPrimary}; -webkit-font-smoothing: antialiased;">
${preheaderHtml}

  <!-- Tabela Envolvente Externa -->
  <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: ${EMAIL_THEME.colors.outerBackground}; width: 100%; margin: 0 auto; padding: 0;">
    <tr>
      <td align="center" style="padding: 0;">

        <!-- Container Centralizado (Max 600px) -->
        <!--[if (gte mso 9)|(IE)]>
        <table role="presentation" width="600" align="center" border="0" cellspacing="0" cellpadding="0">
        <tr>
        <td>
        <![endif]-->
        <table role="presentation" class="email-container" width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: ${EMAIL_THEME.dimensions.containerMaxWidth}; background-color: ${EMAIL_THEME.colors.bodyBackground}; margin: 0 auto; overflow: hidden;">

          <!-- 1. Hero Escuro Premium #0b1020 (Início do e-mail) -->
          <tr>
            <td class="hero-cell" align="center" style="padding: 38px 32px 32px 32px; background-color: ${EMAIL_THEME.colors.heroBackground}; color: ${EMAIL_THEME.colors.heroTextPrimary}; text-align: center;">
              ${heroContent}
            </td>
          </tr>

          <!-- 3. Corpo Principal Branco #ffffff com Alto Contraste -->
          <tr>
            <td class="body-cell" style="padding: 36px 32px 28px 32px; background-color: ${EMAIL_THEME.colors.bodyBackground};">
              ${bodyContent}
            </td>
          </tr>

          <!-- 4. Rodapé Escuro Institucional #0b1020 -->
          <tr>
            <td align="center" style="padding: 34px 24px; background-color: ${EMAIL_THEME.colors.heroBackground}; text-align: center;">
              <a href="${EMAIL_THEME.assets.siteUrl}" target="_blank" rel="noopener noreferrer" style="text-decoration: none; display: inline-block;">
                <span style="font-size: 20px; font-weight: 800; color: #ffffff; letter-spacing: 3px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; display: inline-block;">PLAUD</span>
              </a>
              <div style="font-size: 13px; font-weight: 600; color: #ffffff; margin-top: 14px; letter-spacing: 0.2px;">
                Plaud Note Brasil
              </div>
              <div style="font-size: 12px; color: ${EMAIL_THEME.colors.heroTagline}; margin-top: 6px; line-height: 1.5;">
                Em caso de dúvida, responda diretamente a este e-mail.
              </div>
              <div style="margin-top: 10px;">
                <a href="${EMAIL_THEME.assets.siteUrl}" target="_blank" rel="noopener noreferrer" style="font-size: 12px; color: ${EMAIL_THEME.colors.heroTagline}; text-decoration: underline;">
                  plaudai.site
                </a>
              </div>
            </td>
          </tr>

        </table>
        <!--[if (gte mso 9)|(IE)]>
        </td>
        </tr>
        </table>
        <![endif]-->

      </td>
    </tr>
  </table>

</body>
</html>`
}
