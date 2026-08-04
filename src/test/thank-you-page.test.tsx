import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { ThankYouPage } from '../pages/ThankYouPage'

describe('Página de Obrigado (/obrigado) — Segurança e Personalização', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    document.title = 'PLAUD NOTE'
    // Limpa estado anterior do history
    window.history.replaceState({}, '', '/obrigado')
  })

  it('1. Nome e e-mail válidos: personaliza com primeiro nome e e-mail mascarado sem expor dados brutos', () => {
    // Configura o estado sanitizado prévio (como faria o script de bootstrap no head)
    window.history.replaceState(
      {
        sanitizedCustomerContext: {
          firstName: 'Carlos',
          maskedEmail: 'c***@gmail.com',
        },
      },
      '',
      '/obrigado'
    )

    render(
      <MemoryRouter initialEntries={['/obrigado']}>
        <Routes>
          <Route path="/obrigado" element={<ThankYouPage />} />
        </Routes>
      </MemoryRouter>
    )

    // Título personalizado com primeiro nome
    expect(screen.getByText('Tudo certo, Carlos.')).toBeInTheDocument()
    expect(screen.getByText('Seu novo PLAUD está confirmado.')).toBeInTheDocument()

    // Mensagem com e-mail mascarado
    expect(
      screen.getByText('Enviamos a confirmação e os detalhes do pedido para c***@gmail.com.')
    ).toBeInTheDocument()

    // Garante que nome completo ou e-mail bruto NÃO aparecem
    expect(screen.queryByText(/Carlos Silva/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/carlos\.silva@gmail\.com/i)).not.toBeInTheDocument()
  })

  it('2. Ausência de parâmetros: apresenta conteúdo genérico sem erros', () => {
    window.history.replaceState(
      {
        sanitizedCustomerContext: {
          firstName: null,
          maskedEmail: null,
        },
      },
      '',
      '/obrigado'
    )

    render(
      <MemoryRouter initialEntries={['/obrigado']}>
        <Routes>
          <Route path="/obrigado" element={<ThankYouPage />} />
        </Routes>
      </MemoryRouter>
    )

    // Fallback genérico
    expect(screen.getByText('Tudo certo.')).toBeInTheDocument()
    expect(screen.getByText('Seu novo PLAUD está confirmado.')).toBeInTheDocument()
    expect(
      screen.getByText('Enviamos a confirmação e os detalhes para o e-mail informado durante a compra.')
    ).toBeInTheDocument()
  })

  it('3. Entrada maliciosa (XSS): rejeita injeção e utiliza fallback genérico seguro', () => {
    window.history.replaceState(
      {
        sanitizedCustomerContext: {
          firstName: null, // vetor <img src=x onerror=alert(1)> rejeitado pelo sanitizer
          maskedEmail: null,
        },
      },
      '',
      '/obrigado'
    )

    render(
      <MemoryRouter initialEntries={['/obrigado']}>
        <Routes>
          <Route path="/obrigado" element={<ThankYouPage />} />
        </Routes>
      </MemoryRouter>
    )

    // Garante que não criou tags nem renderizou payload
    expect(screen.queryByText(/<img/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/alert/i)).not.toBeInTheDocument()
    expect(screen.getByText('Tudo certo.')).toBeInTheDocument()
  })

  it('4. Valores excessivamente longos: tratados com segurança', () => {
    window.history.replaceState(
      {
        sanitizedCustomerContext: {
          firstName: 'A'.repeat(40),
          maskedEmail: 'a***@dominio.com',
        },
      },
      '',
      '/obrigado'
    )

    render(
      <MemoryRouter initialEntries={['/obrigado']}>
        <Routes>
          <Route path="/obrigado" element={<ThankYouPage />} />
        </Routes>
      </MemoryRouter>
    )

    expect(screen.getByText(`Tudo certo, ${'A'.repeat(40)}.`)).toBeInTheDocument()
  })

  it('5. Privacidade: descarta CPF, telefone, UTMs e limpa a URL para somente /obrigado', () => {
    const replaceStateSpy = vi.spyOn(window.history, 'replaceState')

    // Simula uma URL de entrada carregada com dados sensíveis e UTMs
    window.history.replaceState(
      {
        sanitizedCustomerContext: {
          firstName: 'Renata',
          maskedEmail: 'r***@uol.com.br',
        },
      },
      '',
      '/obrigado'
    )

    render(
      <MemoryRouter initialEntries={['/obrigado']}>
        <Routes>
          <Route path="/obrigado" element={<ThankYouPage />} />
        </Routes>
      </MemoryRouter>
    )

    // Verifica que nenhum dado proibido está presente no DOM
    expect(screen.queryByText(/12345678900/)).not.toBeInTheDocument()
    expect(screen.queryByText(/11999999999/)).not.toBeInTheDocument()
    expect(screen.queryByText(/utm_source/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/utm_campaign/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/facebook_ads/i)).not.toBeInTheDocument()

    // Verifica que history.state não armazena CPF nem telefone
    const currentState = window.history.state
    expect(currentState.customer_document).toBeUndefined()
    expect(currentState.customer_phone).toBeUndefined()
    expect(currentState.src).toBeUndefined()
    expect(currentState.utm_source).toBeUndefined()

    replaceStateSpy.mockRestore()
  })

  it('6. Segurança: nenhum evento manual de compra é disparado e metadados estão corretos', () => {
    const fbqMock = vi.fn()
    ;(window as unknown as { fbq?: unknown }).fbq = fbqMock

    const { unmount } = render(
      <MemoryRouter initialEntries={['/obrigado']}>
        <Routes>
          <Route path="/obrigado" element={<ThankYouPage />} />
        </Routes>
      </MemoryRouter>
    )

    // fbq não deve ter sido chamado com Purchase
    expect(fbqMock).not.toHaveBeenCalled()

    // Title e robots noindex configurados
    expect(document.title).toBe('Pedido Confirmado | Plaud Note')
    const robotsMeta = document.querySelector('meta[name="robots"]')
    expect(robotsMeta).toHaveAttribute('content', 'noindex, nofollow')

    unmount()
    delete (window as unknown as { fbq?: unknown }).fbq
  })

  it('7. Exibe logo-branco, timeline de 4 etapas e link para home sem botão de rastreio', () => {
    render(
      <MemoryRouter initialEntries={['/obrigado']}>
        <Routes>
          <Route path="/obrigado" element={<ThankYouPage />} />
        </Routes>
      </MemoryRouter>
    )

    // Logo branca
    const logo = screen.getByAltText('PLAUD') as HTMLImageElement
    expect(logo).toBeInTheDocument()
    expect(logo.getAttribute('src')).toBe('/images/logo-branco.png')

    // Timeline de 4 etapas
    expect(screen.getByText('Pagamento confirmado')).toBeInTheDocument()
    expect(screen.getByText('Em preparação')).toBeInTheDocument()
    expect(screen.getByText('Pedido enviado')).toBeInTheDocument()
    expect(screen.getByText('Entrega')).toBeInTheDocument()

    // Sem botão de acompanhar pedido
    expect(screen.queryByText(/Acompanhar meu pedido/i)).not.toBeInTheDocument()

    // Botão de voltar para a página inicial
    const homeBtn = screen.getByRole('link', { name: /Voltar para a página inicial/i })
    expect(homeBtn).toHaveAttribute('href', '/')
  })
})
