import React, { useEffect } from 'react'
import { Link } from 'react-router-dom'
import './ThankYouPage.css'

export const ThankYouPage: React.FC = () => {
  useEffect(() => {
    // Gerenciamento seguro de metadados para não indexação da página de confirmação
    const originalTitle = document.title
    document.title = 'Pedido Confirmado | Plaud Note'

    let robotsMeta = document.querySelector('meta[name="robots"]')
    let createdMeta = false

    if (!robotsMeta) {
      robotsMeta = document.createElement('meta')
      robotsMeta.setAttribute('name', 'robots')
      document.head.appendChild(robotsMeta)
      createdMeta = true
    }
    const previousRobotsContent = robotsMeta.getAttribute('content')
    robotsMeta.setAttribute('content', 'noindex, nofollow')

    return () => {
      document.title = originalTitle
      if (robotsMeta) {
        if (createdMeta) {
          document.head.removeChild(robotsMeta)
        } else if (previousRobotsContent) {
          robotsMeta.setAttribute('content', previousRobotsContent)
        } else {
          robotsMeta.removeAttribute('content')
        }
      }
    }
  }, [])

  return (
    <div className="ty-page-wrapper">
      {/* 1. Cabeçalho Minimalista com logo-branco */}
      <header className="ty-header" role="banner">
        <Link to="/" aria-label="Página inicial da PLAUD">
          <img
            src="/images/logo-branco.png"
            alt="PLAUD"
            className="ty-logo-img"
            onError={(e) => {
              // Fallback gracioso para logo padrão caso a logo branca não seja localizada
              ;(e.target as HTMLImageElement).src = '/images/logo.png'
            }}
          />
        </Link>
      </header>

      {/* Container Centralizado */}
      <main className="ty-container" role="main">
        {/* Card Editorial Branco */}
        <div className="ty-card">
          {/* 2. Hero de Confirmação */}
          <section className="ty-hero-section" aria-labelledby="hero-title">
            <div className="ty-badge">
              <svg
                className="ty-badge-icon"
                viewBox="0 0 20 20"
                fill="currentColor"
                aria-hidden="true"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
              <span>PAGAMENTO CONFIRMADO</span>
            </div>

            <h1 id="hero-title" className="ty-hero-title">
              Seu novo PLAUD está confirmado.
            </h1>

            <p className="ty-hero-subtitle">
              Recebemos seu pagamento e seu pedido já entrou na nossa fila de preparação.
            </p>

            <p className="ty-hero-notice">
              A confirmação completa foi enviada para o e-mail informado durante a compra.
            </p>

            {/* Imagem individual do Plaud Note Cinza */}
            <div className="ty-product-box">
              <img
                src="/images/email/plaud-note-confirmed.png"
                alt="PLAUD Note Cinza"
                className="ty-product-img"
                onError={(e) => {
                  // Fallback para imagem de produto cinza existente
                  ;(e.target as HTMLImageElement).src = '/images/1.webp'
                }}
              />
            </div>

            <div className="ty-product-tagline" aria-hidden="true">
              Grave &middot; Transcreva &middot; Organize
            </div>
          </section>

          <div className="ty-divider" />

          {/* 3. Bloco Editorial "Agora é com a gente" */}
          <section className="ty-editorial-block" aria-labelledby="editorial-title">
            <h2 id="editorial-title" className="ty-editorial-title">
              Agora é com a gente.
            </h2>
            <p className="ty-editorial-text">
              Vamos preparar seu pedido com cuidado. Assim que ele for despachado, você receberá um novo e-mail com o código de rastreamento e o link para acompanhar a entrega.
            </p>
          </section>

          {/* 4. Timeline de Acompanhamento */}
          <section className="ty-timeline-section" aria-labelledby="timeline-title">
            <h2 id="timeline-title" className="ty-section-title">
              Próximas etapas do seu pedido
            </h2>

            <div className="ty-timeline-list" role="list">
              {/* Etapa 1: Concluída */}
              <div className="ty-timeline-item" role="listitem">
                <div className="ty-timeline-marker-col">
                  <div className="ty-timeline-marker completed" aria-label="Etapa concluída">
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                      aria-hidden="true"
                    >
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </div>
                  <div className="ty-timeline-connector" />
                </div>
                <div className="ty-timeline-content">
                  <div className="ty-timeline-step-name completed">Pagamento confirmado</div>
                  <p className="ty-timeline-step-desc">Seu pagamento foi aprovado.</p>
                </div>
              </div>

              {/* Etapa 2: Ativa */}
              <div className="ty-timeline-item" role="listitem">
                <div className="ty-timeline-marker-col">
                  <div className="ty-timeline-marker active" aria-label="Etapa atual em andamento">
                    2
                  </div>
                  <div className="ty-timeline-connector" />
                </div>
                <div className="ty-timeline-content">
                  <div className="ty-timeline-step-name active">Em preparação</div>
                  <p className="ty-timeline-step-desc">Seu pedido será separado para envio.</p>
                </div>
              </div>

              {/* Etapa 3: Futura */}
              <div className="ty-timeline-item" role="listitem">
                <div className="ty-timeline-marker-col">
                  <div className="ty-timeline-marker future" aria-label="Etapa futura">
                    3
                  </div>
                  <div className="ty-timeline-connector" />
                </div>
                <div className="ty-timeline-content">
                  <div className="ty-timeline-step-name future">Pedido enviado</div>
                  <p className="ty-timeline-step-desc">O rastreamento será enviado por e-mail.</p>
                </div>
              </div>

              {/* Etapa 4: Futura */}
              <div className="ty-timeline-item" role="listitem">
                <div className="ty-timeline-marker-col">
                  <div className="ty-timeline-marker future" aria-label="Etapa futura">
                    4
                  </div>
                </div>
                <div className="ty-timeline-content">
                  <div className="ty-timeline-step-name future">Entrega</div>
                  <p className="ty-timeline-step-desc">Você poderá acompanhar cada movimentação.</p>
                </div>
              </div>
            </div>
          </section>

          {/* 5. Orientação sobre o E-mail */}
          <section className="ty-email-tips" aria-label="Orientações sobre o e-mail de confirmação">
            <p>
              <strong>Não encontrou a confirmação?</strong> Aguarde alguns minutos e verifique também as abas Promoções, Atualizações e Spam.
            </p>
            <p>
              Para falar sobre seu pedido, responda diretamente ao e-mail de confirmação.
            </p>
          </section>

          {/* 6. Botão de Retorno */}
          <div className="ty-home-action">
            <Link to="/" className="ty-btn-home">
              <span>Voltar para a página inicial</span>
            </Link>
          </div>
        </div>
      </main>

      {/* 7. Rodapé */}
      <footer className="ty-footer" role="contentinfo">
        <div className="ty-footer-brand">Plaud Note Brasil &bull; plaudai.site</div>
        <div className="ty-footer-security">
          <svg
            className="ty-footer-security-icon"
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z"
              clipRule="evenodd"
            />
          </svg>
          <span>Ambiente seguro. Seus dados de compra são protegidos.</span>
        </div>
      </footer>
    </div>
  )
}

export default ThankYouPage
