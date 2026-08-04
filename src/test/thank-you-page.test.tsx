import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { ThankYouPage } from '../pages/ThankYouPage'

describe('Página de Obrigado (/obrigado)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    document.title = 'PLAUD NOTE'
  })

  it('1. Renderiza todos os textos essenciais da página de confirmação', () => {
    render(
      <MemoryRouter initialEntries={['/obrigado']}>
        <Routes>
          <Route path="/obrigado" element={<ThankYouPage />} />
        </Routes>
      </MemoryRouter>
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

    // Orientação sobre o e-mail
    expect(screen.getByText('Não encontrou a confirmação?')).toBeInTheDocument()
    expect(
      screen.getByText(/Aguarde alguns minutos e verifique também as abas Promoções, Atualizações e Spam\./i)
    ).toBeInTheDocument()
    expect(
      screen.getByText('Para falar sobre seu pedido, responda diretamente ao e-mail de confirmação.')
    ).toBeInTheDocument()

    // Botão de retorno
    expect(screen.getByText('Voltar para a página inicial')).toBeInTheDocument()

    // Rodapé
    expect(screen.getByText(/Plaud Note Brasil/i)).toBeInTheDocument()
    expect(screen.getByText(/plaudai\.site/i)).toBeInTheDocument()
    expect(screen.getByText(/Ambiente seguro\. Seus dados de compra são protegidos\./i)).toBeInTheDocument()
  })

  it('2. Garante que NÃO existe botão para "Acompanhar meu pedido"', () => {
    render(
      <MemoryRouter initialEntries={['/obrigado']}>
        <Routes>
          <Route path="/obrigado" element={<ThankYouPage />} />
        </Routes>
      </MemoryRouter>
    )

    expect(screen.queryByText(/Acompanhar meu pedido/i)).not.toBeInTheDocument()
  })

  it('3. Contém link para voltar para a página inicial com destino "/"', () => {
    render(
      <MemoryRouter initialEntries={['/obrigado']}>
        <Routes>
          <Route path="/obrigado" element={<ThankYouPage />} />
        </Routes>
      </MemoryRouter>
    )

    const homeLink = screen.getByRole('link', { name: /Voltar para a página inicial/i })
    expect(homeLink).toHaveAttribute('href', '/')
  })

  it('4. Não expõe ou renderiza dados pessoais ou parâmetros arbitrários da URL', () => {
    render(
      <MemoryRouter
        initialEntries={[
          '/obrigado?customer_name=JohnDoe&email=vaza@teste.com&cpf=12345678900&total=119.90&status=paid',
        ]}
      >
        <Routes>
          <Route path="/obrigado" element={<ThankYouPage />} />
        </Routes>
      </MemoryRouter>
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
      <MemoryRouter initialEntries={['/obrigado']}>
        <Routes>
          <Route path="/obrigado" element={<ThankYouPage />} />
        </Routes>
      </MemoryRouter>
    )

    // Verifica que fbq não foi invocado com Purchase ou qualquer outro evento
    expect(fbqMock).not.toHaveBeenCalled()
    ;(window as unknown as { fbq?: unknown }).fbq = originalFbq
  })

  it('6. Configura título e tag robots noindex, nofollow dinamicamente e restaura no unmount', () => {
    const { unmount } = render(
      <MemoryRouter initialEntries={['/obrigado']}>
        <Routes>
          <Route path="/obrigado" element={<ThankYouPage />} />
        </Routes>
      </MemoryRouter>
    )

    expect(document.title).toBe('Pedido Confirmado | Plaud Note')
    const robotsMeta = document.querySelector('meta[name="robots"]')
    expect(robotsMeta).toHaveAttribute('content', 'noindex, nofollow')

    unmount()

    expect(document.title).toBe('PLAUD NOTE')
  })

  it('7. Exibe logo-branco com alt text acessível e imagem individual do produto', () => {
    render(
      <MemoryRouter initialEntries={['/obrigado']}>
        <Routes>
          <Route path="/obrigado" element={<ThankYouPage />} />
        </Routes>
      </MemoryRouter>
    )

    const logo = screen.getByAltText('PLAUD') as HTMLImageElement
    expect(logo).toBeInTheDocument()
    expect(logo.getAttribute('src')).toBe('/images/logo-branco.png')

    const productImg = screen.getByAltText('PLAUD Note Cinza')
    expect(productImg).toBeInTheDocument()
  })
})
