import fs from "node:fs"
import path from "node:path"
import http from "node:http"
import { execSync } from "node:child_process"

const UI_PREVIEWS_DIR = path.join(process.cwd(), "ui-previews")
const PUBLIC_DIR = path.join(process.cwd(), "public")
const CSS_PATH = path.join(process.cwd(), "src", "index.css")

if (!fs.existsSync(UI_PREVIEWS_DIR)) {
  fs.mkdirSync(UI_PREVIEWS_DIR, { recursive: true })
}

const cssContent = fs.existsSync(CSS_PATH) ? fs.readFileSync(CSS_PATH, "utf-8") : ""

const otpEmailTemplatePath = path.join(process.cwd(), "supabase", "templates", "otp-login.html")
const otpEmailRaw = fs.existsSync(otpEmailTemplatePath) ? fs.readFileSync(otpEmailTemplatePath, "utf-8") : ""
const otpEmailWithMockCode = otpEmailRaw.replace(/\{\{\s*\.Token\s*\}\}/g, "123456")

function wrapHtml(title: string, bodyContent: string, isCustomer = true): string {
  return `<!DOCTYPE html>
<html lang="pt-BR" class="${isCustomer ? '' : 'admin-portal-body'}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@500;600;700&display=swap" rel="stylesheet">
  <style>
    ${cssContent}
    body {
      margin: 0;
      padding: 0;
      -webkit-font-smoothing: antialiased;
    }
  </style>
</head>
<body class="${isCustomer ? 'portal-body' : 'admin-portal-body'}">
  ${bodyContent}
</body>
</html>`
}

// 1. Customer Login Page HTML
const customerLoginHtml = wrapHtml("Entrar na sua conta — Plaud Note", `
  <div class="portal-login-page">
    <div class="portal-login-card">
      <div class="portal-login-header">
        <a href="/" class="portal-logo-link">
          <img src="/images/logo.png" alt="PLAUD" class="portal-logo-img" />
        </a>
        <h1 class="portal-login-title">Acesse sua conta</h1>
        <p class="portal-login-subtitle">
          Informe seu e-mail de compra para receber o código de verificação por e-mail.
        </p>
      </div>

      <form class="portal-form" onsubmit="event.preventDefault();">
        <div class="portal-form-group">
          <label class="portal-label" for="email">E-mail</label>
          <input
            id="email"
            type="email"
            class="portal-input"
            placeholder="seu@email.com"
            value="carlos.silva@exemplo.com"
            autocomplete="email"
          />
        </div>

        <button type="button" class="portal-btn portal-btn-primary portal-btn-block">
          Enviar código de acesso
        </button>
      </form>

      <div class="portal-login-footer">
        <p class="portal-text-muted">
          Não precisa de senha. Enviamos um código seguro de 6 dígitos diretamente para a sua caixa de entrada.
        </p>
      </div>
    </div>
  </div>
`)

// 2. Customer Orders Page HTML
const customerOrdersHtml = wrapHtml("Meus Pedidos — Plaud Note", `
  <div class="portal-layout">
    <header class="portal-header">
      <div class="portal-header-container">
        <a href="/" class="portal-brand">
          <img src="/images/logo.png" alt="PLAUD" class="portal-logo-img" />
        </a>
        <div class="portal-header-nav">
          <span class="portal-user-email">carlos.silva@exemplo.com</span>
          <button type="button" class="portal-btn-ghost portal-btn-sm">Sair</button>
        </div>
      </div>
    </header>

    <main class="portal-main">
      <div class="portal-container">
        <div class="portal-page-header">
          <h1 class="portal-title">Meus Pedidos</h1>
          <p class="portal-subtitle">Acompanhe o status e a entrega dos seus pedidos Plaud Note.</p>
        </div>

        <div class="portal-orders-list">
          <a href="/minha-conta/pedidos/ord-1" class="portal-order-card" style="text-decoration: none; color: inherit; display: block;">
            <div class="portal-order-card-header">
              <div>
                <span class="portal-order-number">Pedido #VCS1O8WQ3EI</span>
                <span class="portal-order-date">04 de agosto de 2026, 05:30</span>
              </div>
              <span class="portal-status-badge portal-status-in_transit">Em trânsito</span>
            </div>

            <div class="portal-order-items-preview">
              <div class="portal-item-preview">
                <span class="portal-item-preview-name">1x Plaud Note — Cinza</span>
                <span class="portal-item-preview-price">R$ 119,90</span>
              </div>
            </div>

            <div class="portal-order-card-footer">
              <span class="portal-order-total-label">Total: <strong>R$ 119,90</strong></span>
              <span class="portal-link-arrow">Ver detalhes do envio →</span>
            </div>
          </a>
        </div>
      </div>
    </main>
  </div>
`)

// 3. Customer Order Detail Page HTML
const customerOrderDetailHtml = wrapHtml("Pedido #VCS1O8WQ3EI — Plaud Note", `
  <div class="portal-layout">
    <header class="portal-header">
      <div class="portal-header-container">
        <a href="/" class="portal-brand">
          <img src="/images/logo.png" alt="PLAUD" class="portal-logo-img" />
        </a>
        <div class="portal-header-nav">
          <span class="portal-user-email">carlos.silva@exemplo.com</span>
          <button type="button" class="portal-btn-ghost portal-btn-sm">Sair</button>
        </div>
      </div>
    </header>

    <main class="portal-main">
      <div class="portal-container">
        <div class="portal-breadcrumb">
          <a href="/minha-conta" class="portal-back-link">← Voltar para todos os pedidos</a>
        </div>

        <div class="portal-detail-header-card">
          <div class="portal-detail-meta">
            <span class="portal-label-muted">PEDIDO</span>
            <h1 class="portal-detail-title">#VCS1O8WQ3EI</h1>
            <span class="portal-detail-date">Realizado em 04 de agosto de 2026, 05:30</span>
          </div>
          <div class="portal-badge-group">
            <span class="portal-status-badge portal-status-paid">Pago</span>
            <span class="portal-status-badge portal-status-in_transit">Em trânsito</span>
          </div>
        </div>

        <!-- Timeline -->
        <div class="portal-card" style="margin-bottom: 24px;">
          <h2 class="portal-card-heading">Status da Entrega</h2>
          <div class="portal-timeline">
            <div class="portal-timeline-step is-passed">
              <div class="portal-timeline-dot">✓</div>
              <span class="portal-timeline-label">Confirmado</span>
            </div>
            <div class="portal-timeline-step is-passed">
              <div class="portal-timeline-dot">✓</div>
              <span class="portal-timeline-label">Preparação</span>
            </div>
            <div class="portal-timeline-step is-passed is-current">
              <div class="portal-timeline-dot">3</div>
              <span class="portal-timeline-label">Em trânsito</span>
            </div>
            <div class="portal-timeline-step">
              <div class="portal-timeline-dot">4</div>
              <span class="portal-timeline-label">Entregue</span>
            </div>
          </div>

          <!-- Rastreamento Box -->
          <div class="portal-tracking-box">
            <div class="portal-tracking-info">
              <span class="portal-tracking-icon">🚚</span>
              <div>
                <span class="portal-tracking-label">Código de Rastreamento</span>
                <span class="portal-tracking-code-val">NL123456789BR</span>
                <span class="portal-carrier-tag">Transportadora: Correios</span>
              </div>
            </div>

            <a
              href="https://www.17track.net/pt?nums=NL123456789BR"
              target="_blank"
              rel="noopener noreferrer"
              class="portal-btn portal-btn-track"
            >
              Rastrear na 17TRACK ↗
            </a>
          </div>
        </div>

        <!-- Grade: Itens e Endereço -->
        <div class="portal-detail-grid">
          <div class="portal-card">
            <h2 class="portal-card-heading">Itens do Pedido</h2>
            <div class="portal-items-list">
              <div class="portal-item-row">
                <div class="portal-item-info">
                  <span class="portal-item-name">Plaud Note — Cinza</span>
                  <span class="portal-item-qty">Qtd: 1</span>
                </div>
                <span class="portal-item-price">R$ 119,90</span>
              </div>
            </div>
            <div class="portal-total-row">
              <span>Total Pago</span>
              <span class="portal-total-price">R$ 119,90</span>
            </div>
          </div>

          <div class="portal-card">
            <h2 class="portal-card-heading">Endereço de Entrega</h2>
            <div class="portal-address-box">
              <p class="portal-address-line">
                <strong>Rua das Palmeiras</strong>, 123 - Apt 45
              </p>
              <p class="portal-address-line">Jardim Primavera</p>
              <p class="portal-address-line">São Paulo - SP</p>
              <p class="portal-address-line">CEP: 01452-002</p>

              <div style="margin-top: 16px; padding: 10px 12px; background: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0; fontSize: 12.5px; color: #64748b; line-height: 1.4;">
                ℹ️ Caso algum dado do seu endereço esteja incorreto ou incompleto, por favor responda diretamente ao seu e-mail de confirmação do pedido para que nossa equipe atualize o envio antes do despacho.
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  </div>
`)

// 4. Admin Login Page HTML
const adminLoginHtml = wrapHtml("Login Operacional — Painel Plaud Note", `
  <div class="portal-login-page admin-login-bg">
    <div class="portal-login-card admin-login-card">
      <div class="portal-login-header">
        <a href="/" class="portal-logo-link">
          <img src="/images/logo.png" alt="PLAUD" class="portal-logo-img" />
        </a>
        <span class="admin-badge-tag">ACESSO ADMINISTRATIVO</span>
        <h1 class="portal-login-title">Painel de Operações</h1>
        <p class="portal-login-subtitle">
          Área restrita para operadores autorizados da Plaud Note Brasil.
        </p>
      </div>

      <form class="portal-form" onsubmit="event.preventDefault();">
        <div class="portal-form-group">
          <label class="portal-label" for="admin-email">E-mail Corporativo</label>
          <input
            id="admin-email"
            type="email"
            class="portal-input"
            placeholder="operador@plaudai.site"
            value="admin@plaudai.site"
            autocomplete="email"
          />
        </div>

        <button type="button" class="portal-btn portal-btn-primary portal-btn-block">
          Receber código de acesso
        </button>
      </form>

      <div class="portal-login-footer">
        <p class="portal-text-muted" style="font-size: 12px;">
          🔒 O acesso exige conta previamente provisionada na tabela de administradores. Auto-cadastro desativado.
        </p>
      </div>
    </div>
  </div>
`, false)

// 5. Admin Orders Page HTML (Desktop)
const adminOrdersDesktopHtml = wrapHtml("Gestão de Pedidos — Painel Plaud Note", `
  <div class="portal-admin-layout">
    <header class="portal-admin-header">
      <div class="portal-admin-header-container">
        <div style="display: flex; align-items: center; gap: 12px;">
          <img src="/images/logo.png" alt="PLAUD" class="portal-logo-img" />
          <span class="admin-header-pill">PAINEL OPERACIONAL</span>
        </div>
        <div style="display: flex; align-items: center; gap: 16px;">
          <span class="admin-header-user">admin@plaudai.site</span>
          <button type="button" class="portal-btn-ghost portal-btn-sm">Sair</button>
        </div>
      </div>
    </header>

    <main class="portal-admin-main">
      <div class="portal-admin-container">
        <div class="portal-admin-grid">

          <!-- Coluna Esquerda: Busca e Lista -->
          <div class="portal-card portal-admin-list-col">
            <div class="portal-admin-search-header">
              <h2 class="portal-card-heading" style="margin-bottom: 12px;">Pesquisar Pedidos</h2>
              <form class="portal-admin-search-form" onsubmit="event.preventDefault();">
                <input
                  type="text"
                  class="portal-input portal-admin-search-input"
                  placeholder="Buscar por nome, e-mail, pedido ou CPF..."
                  value="Carlos Silva"
                />
                <button type="button" class="portal-btn portal-btn-primary">Buscar</button>
              </form>
            </div>

            <div class="portal-admin-list">
              <div class="portal-admin-item is-selected">
                <div class="portal-admin-item-top">
                  <span class="portal-admin-item-num">VCS1O8WQ3EI</span>
                  <span class="portal-admin-item-date">04/08/2026 05:30</span>
                </div>
                <div class="portal-admin-item-customer">
                  <strong>Carlos Silva</strong>
                  <span class="portal-text-muted"> (carlos.silva@exemplo.com)</span>
                </div>
                <div class="portal-admin-item-bottom">
                  <span class="portal-meta-price">R$ 119,90</span>
                  <div class="portal-badge-group">
                    <span class="portal-status-badge portal-status-paid">Pago</span>
                    <span class="portal-status-badge portal-status-shipped">Pedido enviado</span>
                  </div>
                </div>
              </div>

              <div class="portal-admin-item">
                <div class="portal-admin-item-top">
                  <span class="portal-admin-item-num">VG-2998811</span>
                  <span class="portal-admin-item-date">04/08/2026 08:15</span>
                </div>
                <div class="portal-admin-item-customer">
                  <strong>Mariana Souza</strong>
                  <span class="portal-text-muted"> (mariana.souza@exemplo.com)</span>
                </div>
                <div class="portal-admin-item-bottom">
                  <span class="portal-meta-price">R$ 219,70</span>
                  <div class="portal-badge-group">
                    <span class="portal-status-badge portal-status-paid">Pago</span>
                    <span class="portal-status-badge portal-status-processing">Em preparação</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Coluna Direita: Detalhes e Despacho -->
          <div class="portal-card portal-admin-detail-col">
            <div class="portal-admin-detail-content">
              <div class="portal-admin-detail-header">
                <div>
                  <span class="portal-label-muted">PEDIDO SELECIONADO</span>
                  <h2 class="portal-detail-title" style="font-size: 22px; margin: 4px 0;">VCS1O8WQ3EI</h2>
                  <span class="portal-text-muted" style="font-size: 13px;">ID Vega: vg_ord_99812481</span>
                </div>
                <div class="portal-badge-group">
                  <span class="portal-status-badge portal-status-paid">Pago</span>
                  <span class="portal-status-badge portal-status-shipped">Pedido enviado</span>
                </div>
              </div>

              <div class="portal-admin-info-grid">
                <div class="portal-admin-info-box">
                  <h4 class="portal-admin-box-title">Cliente</h4>
                  <p class="portal-admin-info-line"><strong>Carlos Silva</strong></p>
                  <p class="portal-admin-info-line">carlos.silva@exemplo.com</p>
                  <p class="portal-admin-info-line">CPF: ***.458.912-**</p>
                </div>
                <div class="portal-admin-info-box">
                  <h4 class="portal-admin-box-title">Endereço de Envio</h4>
                  <p class="portal-admin-info-line">Rua das Palmeiras, 123 - Apt 45</p>
                  <p class="portal-admin-info-line">São Paulo - SP (CEP: 01452-002)</p>
                </div>
              </div>

              <!-- Formulário de Despacho -->
              <div class="portal-admin-shipment-card">
                <h3 class="portal-card-heading" style="font-size: 16px; margin-bottom: 12px;">
                  📦 Despacho e Rastreamento
                </h3>

                <div class="portal-current-tracking-box">
                  <span>Rastreio atual: <strong>NL123456789BR</strong> (Correios)</span>
                  <a href="https://www.17track.net/pt?nums=NL123456789BR" target="_blank" rel="noopener noreferrer" class="portal-btn-link">17TRACK ↗</a>
                </div>

                <form class="portal-admin-form" onsubmit="event.preventDefault();">
                  <div class="portal-form-row">
                    <div class="portal-form-group" style="flex: 2;">
                      <label class="portal-label" for="track-code">Código de Rastreamento</label>
                      <input
                        id="track-code"
                        type="text"
                        class="portal-input"
                        placeholder="Ex: NL123456789BR"
                        value="NL123456789BR"
                      />
                    </div>
                    <div class="portal-form-group" style="flex: 1;">
                      <label class="portal-label" for="carrier">Transportadora</label>
                      <input
                        id="carrier"
                        type="text"
                        class="portal-input"
                        placeholder="Correios"
                        value="Correios"
                      />
                    </div>
                  </div>

                  <button type="button" class="portal-btn portal-btn-primary">
                    Salvar Rastreamento
                  </button>
                </form>
              </div>
            </div>
          </div>

        </div>
      </div>
    </main>
  </div>
`, false)

// 6. Admin Order with Missing Number Alert HTML
const adminOrderMissingNumberHtml = wrapHtml("Alerta de Endereço Incompleto — Painel Plaud Note", `
  <div class="portal-admin-layout">
    <header class="portal-admin-header">
      <div class="portal-admin-header-container">
        <div style="display: flex; align-items: center; gap: 12px;">
          <img src="/images/logo.png" alt="PLAUD" class="portal-logo-img" />
          <span class="admin-header-pill">PAINEL OPERACIONAL</span>
        </div>
        <div style="display: flex; align-items: center; gap: 16px;">
          <span class="admin-header-user">admin@plaudai.site</span>
          <button type="button" class="portal-btn-ghost portal-btn-sm">Sair</button>
        </div>
      </div>
    </header>

    <main class="portal-admin-main">
      <div class="portal-admin-container">
        <div class="portal-admin-grid">

          <div class="portal-card portal-admin-list-col">
            <div class="portal-admin-search-header">
              <h2 class="portal-card-heading" style="margin-bottom: 12px;">Pesquisar Pedidos</h2>
              <form class="portal-admin-search-form" onsubmit="event.preventDefault();">
                <input
                  type="text"
                  class="portal-input portal-admin-search-input"
                  value="Mariana Souza"
                />
                <button type="button" class="portal-btn portal-btn-primary">Buscar</button>
              </form>
            </div>

            <div class="portal-admin-list">
              <div class="portal-admin-item is-selected">
                <div class="portal-admin-item-top">
                  <span class="portal-admin-item-num">VG-2998811</span>
                  <span class="portal-admin-item-date">04/08/2026 08:15</span>
                </div>
                <div class="portal-admin-item-customer">
                  <strong>Mariana Souza</strong>
                  <span class="portal-text-muted"> (mariana.souza@exemplo.com)</span>
                </div>
                <div class="portal-admin-item-bottom">
                  <span class="portal-meta-price">R$ 219,70</span>
                  <div class="portal-badge-group">
                    <span class="portal-status-badge portal-status-paid">Pago</span>
                    <span class="portal-status-badge portal-status-processing">Em preparação</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="portal-card portal-admin-detail-col">
            <div class="portal-admin-detail-content">
              <div class="portal-admin-detail-header">
                <div>
                  <span class="portal-label-muted">PEDIDO SELECIONADO</span>
                  <h2 class="portal-detail-title" style="font-size: 22px; margin: 4px 0;">VG-2998811</h2>
                  <span class="portal-text-muted" style="font-size: 13px;">ID Vega: vg_ord_44589211</span>
                </div>
                <div class="portal-badge-group">
                  <span class="portal-status-badge portal-status-paid">Pago</span>
                  <span class="portal-status-badge portal-status-processing">Em preparação</span>
                </div>
              </div>

              <div class="portal-admin-info-grid">
                <div class="portal-admin-info-box">
                  <h4 class="portal-admin-box-title">Cliente</h4>
                  <p class="portal-admin-info-line"><strong>Mariana Souza</strong></p>
                  <p class="portal-admin-info-line">mariana.souza@exemplo.com</p>
                </div>
                <div class="portal-admin-info-box">
                  <h4 class="portal-admin-box-title">Endereço de Envio</h4>
                  <p class="portal-admin-info-line">
                    Av. Beira Mar, <strong style="color: #ef4444; background: rgba(239, 68, 68, 0.15); padding: 2px 6px; border-radius: 4px;">Número não informado</strong>
                  </p>
                  <p class="portal-admin-info-line">Florianópolis - SC (CEP: 88015-100)</p>
                </div>
              </div>

              <!-- ALERTA DE ENDEREÇO INCOMPLETO EM DESTAQUE -->
              <div class="portal-alert portal-alert-warning" style="margin-bottom: 20px; border-left: 4px solid #f59e0b; background: rgba(245, 158, 11, 0.12); color: #fbbf24; padding: 14px 18px;">
                <div style="display: flex; flex-direction: column; gap: 4px;">
                  <strong style="font-size: 14px;">⚠️ Endereço de entrega incompleto</strong>
                  <span style="font-size: 13px; color: #fde68a;">
                    Atenção: Os seguintes campos estão pendentes ou ausentes: Número. Verifique com o cliente antes de despachar o pedido.
                  </span>
                </div>
              </div>

              <div class="portal-admin-shipment-card">
                <h3 class="portal-card-heading" style="font-size: 16px; margin-bottom: 12px;">
                  📦 Despacho e Rastreamento
                </h3>
                <form class="portal-admin-form" onsubmit="event.preventDefault();">
                  <div class="portal-form-row">
                    <div class="portal-form-group" style="flex: 2;">
                      <label class="portal-label" for="track-code-2">Código de Rastreamento</label>
                      <input
                        id="track-code-2"
                        type="text"
                        class="portal-input"
                        placeholder="Ex: NL123456789BR"
                      />
                    </div>
                    <div class="portal-form-group" style="flex: 1;">
                      <label class="portal-label" for="carrier-2">Transportadora</label>
                      <input
                        id="carrier-2"
                        type="text"
                        class="portal-input"
                        placeholder="Correios"
                      />
                    </div>
                  </div>
                  <button type="button" class="portal-btn portal-btn-primary">
                    Cadastrar Rastreamento
                  </button>
                </form>
              </div>
            </div>
          </div>

        </div>
      </div>
    </main>
  </div>
`, false)

// 7. Landing Mobile HTML
const landingMobileHtml = wrapHtml("Plaud Note Brasil — Gravador de Voz com IA", `
  <div class="app-root">
    <header class="header">
      <a href="/" class="header-logo">
        <img src="/images/logo.png" alt="PLAUD" />
      </a>
      <div class="header-actions">
        <a href="/minha-conta" class="header-order-tracking-link" title="Acompanhar pedido">
          Acompanhar pedido
        </a>
        <button class="header-icon cart-btn" aria-label="Carrinho">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8">
            <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/>
            <line x1="3" y1="6" x2="21" y2="6"/>
            <path d="M16 10a4 4 0 0 1-8 0"/>
          </svg>
        </button>
      </div>
    </header>

    <div class="hero-section" style="padding: 24px 16px; text-align: center;">
      <span class="hero-badge" style="display: inline-block; background: rgba(56, 189, 248, 0.1); color: #38bdf8; padding: 4px 12px; border-radius: 16px; font-size: 12px; font-weight: 600; margin-bottom: 12px;">TECNOLOGIA GPT-4o INTEGRADA</span>
      <h1 style="font-size: 26px; font-weight: 800; line-height: 1.2; margin-bottom: 12px; color: #ffffff;">PLAUD NOTE: Seu gravador de reuniões e chamadas com IA</h1>
      <p style="font-size: 14px; color: #94a3b8; margin-bottom: 20px;">Grave chamadas no iPhone ou reuniões presenciais e obtenha resumos instantâneos com inteligência artificial.</p>

      <div style="background: #111827; border-radius: 16px; padding: 16px; margin-bottom: 24px; border: 1px solid #1f2937;">
        <img src="/images/1.webp" alt="Plaud Note" style="max-width: 100%; height: auto; border-radius: 8px;" />
        <div style="margin-top: 16px; text-align: left;">
          <div style="display: flex; justify-content: space-between; align-items: baseline;">
            <span style="font-size: 13px; color: #94a3b8; text-decoration: line-through;">De R$ 268,90</span>
            <span style="font-size: 22px; font-weight: 800; color: #38bdf8;">R$ 119,90 <span style="font-size: 13px; color: #34d399;">no PIX</span></span>
          </div>
          <button style="width: 100%; margin-top: 12px; background: #38bdf8; color: #0b1020; font-weight: 700; border: none; padding: 14px; border-radius: 8px; font-size: 15px; cursor: pointer;">
            Comprar Agora
          </button>
        </div>
      </div>
    </div>
  </div>
`)

async function run() {
  console.log("=== INICIANDO GERAÇÃO DE PREVIEWS VISUAIS DOS PORTAIS ===")

  const routes: Record<string, string> = {
    "/customer-login.html": customerLoginHtml,
    "/customer-orders.html": customerOrdersHtml,
    "/customer-order-detail.html": customerOrderDetailHtml,
    "/admin-login.html": adminLoginHtml,
    "/admin-orders-desktop.html": adminOrdersDesktopHtml,
    "/admin-order-missing-number.html": adminOrderMissingNumberHtml,
    "/otp-email.html": otpEmailWithMockCode,
    "/landing-mobile.html": landingMobileHtml,
  }

  let dynamicPort = 0
  const server = http.createServer((req, res) => {
    const reqUrl = req.url?.split("?")[0] || ""
    if (routes[reqUrl]) {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" })
      res.end(routes[reqUrl])
      return
    }

    // Static assets
    const filePath = path.join(PUBLIC_DIR, reqUrl)
    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      const ext = path.extname(filePath).toLowerCase()
      const mimeTypes: Record<string, string> = {
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".webp": "image/webp",
        ".svg": "image/svg+xml",
      }
      res.writeHead(200, { "Content-Type": mimeTypes[ext] || "application/octet-stream" })
      fs.createReadStream(filePath).pipe(res)
      return
    }

    res.writeHead(404)
    res.end("Not Found")
  })

  await new Promise<void>((resolve) => {
    server.listen(0, () => {
      const addr = server.address() as { port: number }
      dynamicPort = addr.port
      resolve()
    })
  })
  console.log(`Servidor de preview ativo em http://localhost:${dynamicPort}`)

  const edgePath = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe"
  const chromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
  const browserExe = fs.existsSync(edgePath) ? edgePath : chromePath

  const targets = [
    {
      name: "customer-login-mobile.png",
      url: `http://localhost:${dynamicPort}/customer-login.html`,
      width: 375,
      height: 812,
    },
    {
      name: "customer-orders-mobile.png",
      url: `http://localhost:${dynamicPort}/customer-orders.html`,
      width: 375,
      height: 812,
    },
    {
      name: "customer-order-detail-mobile.png",
      url: `http://localhost:${dynamicPort}/customer-order-detail.html`,
      width: 375,
      height: 1050,
    },
    {
      name: "customer-order-detail-desktop.png",
      url: `http://localhost:${dynamicPort}/customer-order-detail.html`,
      width: 1280,
      height: 900,
    },
    {
      name: "admin-login-mobile.png",
      url: `http://localhost:${dynamicPort}/admin-login.html`,
      width: 375,
      height: 812,
    },
    {
      name: "admin-orders-desktop.png",
      url: `http://localhost:${dynamicPort}/admin-orders-desktop.html`,
      width: 1280,
      height: 900,
    },
    {
      name: "admin-order-missing-number.png",
      url: `http://localhost:${dynamicPort}/admin-order-missing-number.html`,
      width: 1280,
      height: 900,
    },
    {
      name: "otp-email.png",
      url: `http://localhost:${dynamicPort}/otp-email.html`,
      width: 600,
      height: 750,
    },
    {
      name: "landing-mobile.png",
      url: `http://localhost:${dynamicPort}/landing-mobile.html`,
      width: 375,
      height: 1200,
    },
  ]

  const tmpProfileDir = path.join(process.cwd(), ".tmp-profile")
  if (!fs.existsSync(tmpProfileDir)) {
    fs.mkdirSync(tmpProfileDir, { recursive: true })
  }

  for (const target of targets) {
    const outPath = path.join(UI_PREVIEWS_DIR, target.name)
    try {
      console.log(`Gerando screenshot: ${target.name} (${target.width}x${target.height})...`)
      execSync(
        `"${browserExe}" --headless=new --disable-gpu --no-sandbox --no-first-run --no-default-browser-check --disable-software-rasterizer --disable-extensions --user-data-dir="${tmpProfileDir}" --force-device-scale-factor=1 --window-size=${target.width},${target.height} --hide-scrollbars --screenshot="${outPath}" "${target.url}"`,
        { stdio: "inherit", timeout: 15000 }
      )
      if (fs.existsSync(outPath)) {
        const stats = fs.statSync(outPath)
        console.log(`✓ ${target.name} gerado com sucesso: ${(stats.size / 1024).toFixed(1)} KB`)
      }
    } catch (err) {
      console.warn(`Aviso ao gerar ${target.name}:`, err)
    }
  }

  try {
    fs.rmSync(tmpProfileDir, { recursive: true, force: true })
  } catch {
    // ignore cleanup
  }

  server.close()
  console.log("\nTodos os previews foram processados!")
}

run().catch((err) => {
  console.error("Erro na execução:", err)
  process.exit(1)
})
