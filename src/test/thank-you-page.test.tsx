import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { ThankYouPage } from '../pages/ThankYouPage'
import { AuthContext, type AuthContextType } from '../context/AuthContext'

const mockUnauthenticatedContext: AuthContextType = {
  session: null,
  user: null,
  isAdmin: false,
  loading: false,
  signOut: vi.fn(),
  checkIsAdmin: vi.fn().mockResolvedValue(false),
}

const mockAuthenticatedContext: AuthContextType = {
  session: { user: { id: 'usr-customer-123', email: 'cliente@exemplo.com' } } as never,
  user: { id: 'usr-customer-123', email: 'cliente@exemplo.com' } as never,
  isAdmin: false,
  loading: false,
  signOut: vi.fn(),
  checkIsAdmin: vi.fn().mockResolvedValue(false),
}

describe('Página de Obrigado (/obrigado)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    document.title = 'PLAUD NOTE'
  })

  it('1. Renderiza todos os textos essenciais da página de confirmação', () => {
    render(
      <AuthContext.Provider value={mockUnauthenticatedContext}>
        <MemoryRouter initialEntries={['/obrigado']}>
          <Routes>
            <Route path="/obrigado" element={<ThankYouPage />} />
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>
    )

    // Badge de confirmação
    expect(screen.getByText('PAGAMENTO CONFIRMADO')).toBeInTheDocument()

    // Hero de confirmação
    expect(screen.getByText('Seu novo PLAUD está confirmado.')).toBeInTheDocument()
    expect(
      screen.getByText('Recebemos seu pagamento e seu pedido já entrou na nossa fila de preparação.')
    ).toBeInTheDocument()
    expect(
      screen.getByText('A confirmação completa foi enviada para o e-mail informado durante a compra.')
    ).toBeInTheDocument()

    // Bloco editorial "Agora é com a gente"
    expect(screen.getByText('Agora é com a gente.')).toBeInTheDocument()
    expect(
      screen.getByText(
        'Vamos preparar seu pedido com cuidado. Assim que ele for despachado, você receberá um novo e-mail com o código de rastreamento e o link para acompanhar a entrega.'
      )
    ).toBeInTheDocument()

    // Timeline - 4 etapas
    expect(screen.getByText('Pagamento confirmado')).toBeInTheDocument()
    expect(screen.getByText('Seu pagamento foi aprovado.')).toBeInTheDocument()
    expect(screen.getByText('Em preparação')).toBeInTheDocument()
    expect(screen.getByText('Seu pedido será separado para envio.')).toBeInTheDocument()
    expect(screen.getByText('Pedido enviado')).toBeInTheDocument()
    expect(screen.getByText('O rastreamento será enviado por e-mail.')).toBeInTheDocument()
    expect(screen.getByText('Entrega')).toBeInTheDocument()
    expect(screen.getByText('Você poderá acompanhar cada movimentação.')).toBeInTheDocument()

    // Card de acompanhamento
    expect(screen.getByText('Acompanhe tudo em um só lugar')).toBeInTheDocument()
    expect(
      screen.getByText(
        'Entre utilizando o mesmo e-mail informado na compra para consultar seus pedidos e acompanhar o rastreamento.'
      )
    ).toBeInTheDocument()
    expect(screen.getByText('Acompanhar meu pedido')).toBeInTheDocument()
    expect(screen.getByText('Voltar para a página inicial')).toBeInTheDocument()

    // Orientação sobre o e-mail
    expect(screen.getByText('Não encontrou a confirmação?')).toBeInTheDocument()
    expect(
      screen.getByText(/Aguarde alguns minutos e verifique também as abas Promoções, Atualizações e Spam\./i)
    ).toBeInTheDocument()
    expect(
      screen.getByText('Para falar sobre seu pedido, responda diretamente ao e-mail de confirmação.')
    ).toBeInTheDocument()

    // Rodapé
    expect(screen.getByText(/Plaud Note Brasil/i)).toBeInTheDocument()
    expect(screen.getByText(/plaudai\.site/i)).toBeInTheDocument()
    expect(screen.getByText(/Ambiente seguro\. Seus dados de compra são protegidos\./i)).toBeInTheDocument()
  })

  it('2. Direciona para /entrar quando o cliente NÃO está autenticado', () => {
    render(
      <AuthContext.Provider value={mockUnauthenticatedContext}>
        <MemoryRouter initialEntries={['/obrigado']}>
          <Routes>
            <Route path="/obrigado" element={<ThankYouPage />} />
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>
    )

    const trackingLink = screen.getByRole('link', { name: /Acompanhar meu pedido/i })
    expect(trackingLink).toHaveAttribute('href', '/entrar')

    const homeLink = screen.getByRole('link', { name: /Voltar para a página inicial/i })
    expect(homeLink).toHaveAttribute('href', '/')
  })

  it('3. Direciona para /minha-conta quando o cliente JÁ está autenticado', () => {
    render(
      <AuthContext.Provider value={mockAuthenticatedContext}>
        <MemoryRouter initialEntries={['/obrigado']}>
          <Routes>
            <Route path="/obrigado" element={<ThankYouPage />} />
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>
    )

    const trackingLink = screen.getByRole('link', { name: /Acompanhar meu pedido/i })
    expect(trackingLink).toHaveAttribute('href', '/minha-conta')
  })

  it('4. Não expõe ou renderiza dados pessoais ou parâmetros arbitrários da URL', () => {
    render(
      <AuthContext.Provider value={mockUnauthenticatedContext}>
        <MemoryRouter
          initialEntries={[
            '/obrigado?customer_name=JohnDoe&email=vaza@teste.com&cpf=12345678900&total=119.90&status=paid',
          ]}
        >
          <Routes>
            <Route path="/obrigado" element={<ThankYouPage />} />
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>
    )

    // Nenhum parâmetro sensível vindo da URL deve ser renderizado na DOM
    expect(screen.queryByText('JohnDoe')).not.toBeInTheDocument()
    expect(screen.queryByText('vaza@teste.com')).not.toBeInTheDocument()
    expect(screen.queryByText('12345678900')).not.toBeInTheDocument()
    expect(screen.queryByText('119.90')).not.toBeInTheDocument()
  })

  it('5. Não dispara eventos manuais de compra (ex: Purchase, fbq) para evitar conversão duplicada', () => {
    const originalFbq = (window as unknown as { fbq?: unknown }).fbq
    const fbqMock = vi.fn()
    ;(window as unknown as { fbq?: unknown }).fbq = fbqMock

    render(
      <AuthContext.Provider value={mockUnauthenticatedContext}>
        <MemoryRouter initialEntries={['/obrigado']}>
          <Routes>
            <Route path="/obrigado" element={<ThankYouPage />} />
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>
    )

    // Verifica que fbq não foi invocado com Purchase ou qualquer outro evento
    expect(fbqMock).not.toHaveBeenCalled()
    ;(window as unknown as { fbq?: unknown }).fbq = originalFbq
  })

  it('6. Configura título e tag robots noindex, nofollow dinamicamente e restaura no unmount', () => {
    const { unmount } = render(
      <AuthContext.Provider value={mockUnauthenticatedContext}>
        <MemoryRouter initialEntries={['/obrigado']}>
          <Routes>
            <Route path="/obrigado" element={<ThankYouPage />} />
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>
    )

    expect(document.title).toBe('Pedido Confirmado | Plaud Note')
    const robotsMeta = document.querySelector('meta[name="robots"]')
    expect(robotsMeta).toHaveAttribute('content', 'noindex, nofollow')

    unmount()

    expect(document.title).toBe('PLAUD NOTE')
  })

  it('7. Exibe imagens com alt text acessível e sem elementos quebrados', () => {
    render(
      <AuthContext.Provider value={mockUnauthenticatedContext}>
        <MemoryRouter initialEntries={['/obrigado']}>
          <Routes>
            <Route path="/obrigado" element={<ThankYouPage />} />
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>
    )

    const logo = screen.getByAltText('PLAUD')
    expect(logo).toBeInTheDocument()

    const productImg = screen.getByAltText('PLAUD Note Cinza')
    expect(productImg).toBeInTheDocument()
  })
})
