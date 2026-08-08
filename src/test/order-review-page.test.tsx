import { render, fireEvent, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import App from '../App'
import { OFFERS } from '../config/offers'

describe('Order Review Page ("Revisão do pedido")', () => {
  beforeEach(() => {
    sessionStorage.clear()
    localStorage.clear()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('1. Renderiza o cabeçalho editorial com botão Voltar e logo PLAUD, ocultando menu geral e newsletter', () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="/" element={<App variant="standard" />} />
        </Routes>
      </MemoryRouter>
    )

    // Adiciona ao carrinho e vai para a revisão
    const addBtn = container.querySelector('.add-to-cart-btn') as HTMLButtonElement
    fireEvent.click(addBtn)
    act(() => {
      vi.advanceTimersByTime(1000)
    })

    const checkoutBtn = container.querySelector('.cart-checkout-btn') as HTMLButtonElement
    expect(checkoutBtn).not.toBeNull()
    fireEvent.click(checkoutBtn)

    // Verifica a página de revisão
    const reviewHeader = container.querySelector('.review-header')
    expect(reviewHeader).not.toBeNull()

    const backBtn = container.querySelector('.review-back-btn')
    expect(backBtn?.textContent).toContain('Voltar')

    const reviewTitle = container.querySelector('.review-title')
    expect(reviewTitle?.textContent).toBe('Seu novo PLAUD está pronto.')

    // Verifica que cabeçalho geral com busca/menu foi removido da view
    expect(container.querySelector('.header-quick-menu')).toBeNull()
    expect(container.querySelector('.announcement-bar')).toBeNull()

    // Verifica que newsletter e inputs genéricos (cupom, afiliado) não aparecem
    expect(container.querySelector('.newsletter-section')).toBeNull()
    expect(container.querySelector('input[placeholder="opcional"]')).toBeNull()
  })

  it('2. Exibe o resumo do pedido e a explicação de passos futuros ("PRÓXIMA ETAPA")', () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="/" element={<App variant="standard" />} />
        </Routes>
      </MemoryRouter>
    )

    // Adiciona produto
    const addBtn = container.querySelector('.add-to-cart-btn') as HTMLButtonElement
    fireEvent.click(addBtn)
    act(() => {
      vi.advanceTimersByTime(1000)
    })

    const checkoutBtn = container.querySelector('.cart-checkout-btn') as HTMLButtonElement
    fireEvent.click(checkoutBtn)

    // Verifica próxima etapa e progresso
    const nextStepEyebrow = container.querySelector('.review-next-step-eyebrow')
    expect(nextStepEyebrow?.textContent).toBe('PRÓXIMA ETAPA')

    const progress = container.querySelector('.review-next-step-progress')
    expect(progress?.textContent).toContain('Revisão')
    expect(progress?.textContent).toContain('Entrega')
    expect(progress?.textContent).toContain('Pagamento')

    // Verifica elementos de confiança e ambiente protegido
    const security = container.querySelector('.review-security-indicator')
    expect(security?.textContent).toContain('Ambiente protegido')

    const trustInline = container.querySelector('.review-trust-inline')
    expect(trustInline?.textContent).toContain('Pagamento seguro')

    // Verifica mensagem de microcópia
    const note = container.querySelector('.review-cta-note')
    expect(note?.textContent).toContain('Você ainda não será cobrado')
  })

  it('3. Preço padrão R$ 119,90 e redirecionamento correto com UTMs ao clicar no CTA', () => {
    sessionStorage.setItem('utm_params', JSON.stringify({
      utm_source: 'google',
      utm_campaign: 'review_test',
    }))

    const origLoc = window.location
    const assignMock = vi.fn()
    // @ts-expect-error mocking window.location
    delete window.location
    // @ts-expect-error mocking window.location
    window.location = { assign: assignMock }

    try {
      const { container } = render(
        <MemoryRouter initialEntries={['/']}>
          <Routes>
            <Route path="/" element={<App variant="standard" />} />
          </Routes>
        </MemoryRouter>
      )

      // Adiciona ao carrinho
      const addBtn = container.querySelector('.add-to-cart-btn') as HTMLButtonElement
      fireEvent.click(addBtn)
      act(() => {
        vi.advanceTimersByTime(1000)
      })

      const checkoutBtn = container.querySelector('.cart-checkout-btn') as HTMLButtonElement
      fireEvent.click(checkoutBtn)

      // Verifica preço no resumo
      const totalVal = container.querySelector('.review-total-row .review-summary-value')
      expect(totalVal?.textContent).toBe('R$119,90')

      // Clica no CTA principal
      const ctaBtn = container.querySelector('.review-cta-btn') as HTMLButtonElement
      expect(ctaBtn).not.toBeNull()
      fireEvent.click(ctaBtn)

      // Redireciona para o checkout padrão da cor padrão (gray)
      expect(assignMock).toHaveBeenCalledWith(
        expect.stringContaining(OFFERS.standard.checkoutUrlsByColor.gray)
      )
      expect(assignMock).toHaveBeenCalledWith(expect.stringContaining('utm_source=google'))
      expect(assignMock).toHaveBeenCalledWith(expect.stringContaining('utm_campaign=review_test'))
    } finally {
      Object.defineProperty(window, 'location', {
        value: origLoc,
        writable: true,
        configurable: true,
      })
    }
  })

  it('4. Preço promocional R$ 86,90 e isolamento de checkout na rota /lpdesconto', () => {
    const origLoc = window.location
    const assignMock = vi.fn()
    // @ts-expect-error mocking window.location
    delete window.location
    // @ts-expect-error mocking window.location
    window.location = { assign: assignMock }

    try {
      const { container } = render(
        <MemoryRouter initialEntries={['/lpdesconto']}>
          <Routes>
            <Route path="/lpdesconto" element={<App variant="discount" />} />
          </Routes>
        </MemoryRouter>
      )

      // Seleciona Silver
      const silverSwatch = container.querySelector('.swatch-silver') as HTMLButtonElement
      if (silverSwatch) fireEvent.click(silverSwatch)

      // Adiciona ao carrinho
      const addBtn = container.querySelector('.add-to-cart-btn') as HTMLButtonElement
      fireEvent.click(addBtn)
      act(() => {
        vi.advanceTimersByTime(1000)
      })

      const checkoutBtn = container.querySelector('.cart-checkout-btn') as HTMLButtonElement
      fireEvent.click(checkoutBtn)

      // Verifica preço promocional no resumo da revisão
      const totalVal = container.querySelector('.review-total-row .review-summary-value')
      expect(totalVal?.textContent).toBe('R$86,90')

      // Clica no CTA principal
      const ctaBtn = container.querySelector('.review-cta-btn') as HTMLButtonElement
      fireEvent.click(ctaBtn)

      // Deve redirecionar para a URL promocional da cor silver
      expect(assignMock).toHaveBeenCalledWith(
        expect.stringContaining(OFFERS.discount.checkoutUrlsByColor.silver)
      )
    } finally {
      Object.defineProperty(window, 'location', {
        value: origLoc,
        writable: true,
        configurable: true,
      })
    }
  })

  it('5. Proteção contra duplo clique e estado de carregamento no botão de ação', () => {
    const origLoc = window.location
    const assignMock = vi.fn()
    // @ts-expect-error mocking window.location
    delete window.location
    // @ts-expect-error mocking window.location
    window.location = { assign: assignMock }

    try {
      const { container } = render(
        <MemoryRouter initialEntries={['/']}>
          <Routes>
            <Route path="/" element={<App variant="standard" />} />
          </Routes>
        </MemoryRouter>
      )

      const addBtn = container.querySelector('.add-to-cart-btn') as HTMLButtonElement
      fireEvent.click(addBtn)
      act(() => {
        vi.advanceTimersByTime(1000)
      })

      const checkoutBtn = container.querySelector('.cart-checkout-btn') as HTMLButtonElement
      fireEvent.click(checkoutBtn)

      const ctaBtn = container.querySelector('.review-cta-btn') as HTMLButtonElement
      
      // Primeiro clique
      fireEvent.click(ctaBtn)
      expect(assignMock).toHaveBeenCalledTimes(1)

      // Segundo clique consecutivo deve ser ignorado devido ao guard isRedirecting
      fireEvent.click(ctaBtn)
      expect(assignMock).toHaveBeenCalledTimes(1)
    } finally {
      Object.defineProperty(window, 'location', {
        value: origLoc,
        writable: true,
        configurable: true,
      })
    }
  })

  it('6. Dispara evento ViewContent na entrada da revisão e InitiateCheckout no clique do CTA', () => {
    const fbqMock = vi.fn()
    // @ts-expect-error mocking fbq
    window.fbq = fbqMock

    const origLoc = window.location
    const assignMock = vi.fn()
    // @ts-expect-error mocking window.location
    delete window.location
    // @ts-expect-error mocking window.location
    window.location = { assign: assignMock }

    try {
      const { container } = render(
        <MemoryRouter initialEntries={['/']}>
          <Routes>
            <Route path="/" element={<App variant="standard" />} />
          </Routes>
        </MemoryRouter>
      )

      const addBtn = container.querySelector('.add-to-cart-btn') as HTMLButtonElement
      fireEvent.click(addBtn)
      act(() => {
        vi.advanceTimersByTime(1000)
      })

      const checkoutBtn = container.querySelector('.cart-checkout-btn') as HTMLButtonElement
      fireEvent.click(checkoutBtn)

      // ViewContent disparado na entrada da tela
      expect(fbqMock).toHaveBeenCalledWith('track', 'ViewContent', expect.objectContaining({
        content_name: 'Plaud Note',
        currency: 'BRL',
      }))

      // Clica no CTA
      const ctaBtn = container.querySelector('.review-cta-btn') as HTMLButtonElement
      fireEvent.click(ctaBtn)

      // InitiateCheckout disparado no CTA
      expect(fbqMock).toHaveBeenCalledWith('track', 'InitiateCheckout', expect.objectContaining({
        content_name: 'Plaud Note',
        currency: 'BRL',
      }))

      // Nunca dispara Purchase
      const purchaseCalls = fbqMock.mock.calls.filter(call => call[1] === 'Purchase')
      expect(purchaseCalls.length).toBe(0)
    } finally {
      Object.defineProperty(window, 'location', {
        value: origLoc,
        writable: true,
        configurable: true,
      })
      // @ts-expect-error cleanup fbq
      delete window.fbq
    }
  })

  it('7. Botão Voltar retorna à página do produto mantendo o estado do carrinho', () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="/" element={<App variant="standard" />} />
        </Routes>
      </MemoryRouter>
    )

    const addBtn = container.querySelector('.add-to-cart-btn') as HTMLButtonElement
    fireEvent.click(addBtn)
    act(() => {
      vi.advanceTimersByTime(1000)
    })

    const checkoutBtn = container.querySelector('.cart-checkout-btn') as HTMLButtonElement
    fireEvent.click(checkoutBtn)

    expect(container.querySelector('.review-title')).not.toBeNull()

    // Clica em Voltar
    const backBtn = container.querySelector('.review-back-btn') as HTMLButtonElement
    fireEvent.click(backBtn)

    // Retorna à página do produto
    expect(container.querySelector('.review-title')).toBeNull()
    expect(container.querySelector('.product-section')).not.toBeNull()

    // Carrinho continua com o item adicionado
    const cartBadge = container.querySelector('.cart-count-badge')
    expect(cartBadge?.textContent).toBe('1')
  })
})
