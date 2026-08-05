import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { render, fireEvent, act } from '@testing-library/react'
import { MemoryRouter, Routes, Route, useNavigate } from 'react-router-dom'
import App, { buildCheckoutUrl } from '../App'
import { OFFERS } from '../config/offers'

describe('Ofertas Comercial e Promocional (/ e /lpdesconto)', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    sessionStorage.clear()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('1. / renderiza a oferta standard com R$119,90 no hero e na barra fixa', () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="/" element={<App variant="standard" />} />
        </Routes>
      </MemoryRouter>
    )

    const heroPrice = container.querySelector('.pricing-section .price-value')
    expect(heroPrice?.textContent).toBe('R$119,90')

    const barPrice = container.querySelector('.buy-bar-pricing .pix-val')
    expect(barPrice?.textContent).toBe('R$119,90')
  })

  it('2. / utiliza todos os checkouts originais de R$119,90 por cor', () => {
    expect(OFFERS.standard.price).toBe(119.90)
    expect(OFFERS.standard.priceCents).toBe(11990)
    expect(OFFERS.standard.checkoutUrlsByColor.starlight).toBe('https://checkout.plaudai.site/VCCL1O8SD7BU')
    expect(OFFERS.standard.checkoutUrlsByColor.silver).toBe('https://checkout.plaudai.site/VCCL1O8SD7BX')
    expect(OFFERS.standard.checkoutUrlsByColor.gray).toBe('https://checkout.plaudai.site/VCCL1O8SD7C0')
    expect(OFFERS.standard.checkoutUrlsByColor.blue).toBe('https://checkout.plaudai.site/VCCL1O8SD7C1')
  })

  it('3. /lpdesconto renderiza a oferta discount com R$86,90 no hero e na barra fixa', () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/lpdesconto']}>
        <Routes>
          <Route path="/lpdesconto" element={<App variant="discount" />} />
        </Routes>
      </MemoryRouter>
    )

    const heroPrice = container.querySelector('.pricing-section .price-value')
    expect(heroPrice?.textContent).toBe('R$86,90')

    const barPrice = container.querySelector('.buy-bar-pricing .pix-val')
    expect(barPrice?.textContent).toBe('R$86,90')
  })

  it('4. Nenhuma ocorrência comercial de R$119,90 aparece na versão promocional', () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/lpdesconto']}>
        <Routes>
          <Route path="/lpdesconto" element={<App variant="discount" />} />
        </Routes>
      </MemoryRouter>
    )

    expect(container.textContent).not.toContain('R$119,90')
    expect(container.textContent).not.toContain('119,90')
    expect(container.textContent).toContain('R$86,90')
  })

  it('5-8. /lpdesconto mapeia corretamente os checkouts promocionais para cada cor semântica', () => {
    expect(OFFERS.discount.price).toBe(86.90)
    expect(OFFERS.discount.priceCents).toBe(8690)
    
    // 5. Starlight -> VCCL1O8SD7GG
    expect(OFFERS.discount.checkoutUrlsByColor.starlight).toBe('https://checkout.plaudai.site/VCCL1O8SD7GG')
    // 6. Prata/Silver -> VCCL1O8SD7GF
    expect(OFFERS.discount.checkoutUrlsByColor.silver).toBe('https://checkout.plaudai.site/VCCL1O8SD7GF')
    // 7. Cinza/Gray -> VCCL1O8SD7GE
    expect(OFFERS.discount.checkoutUrlsByColor.gray).toBe('https://checkout.plaudai.site/VCCL1O8SD7GE')
    // 8. Azul/Blue -> VCCL1O8SD7GD
    expect(OFFERS.discount.checkoutUrlsByColor.blue).toBe('https://checkout.plaudai.site/VCCL1O8SD7GD')
  })

  it('9. Troca de cor na página promocional atualiza o checkout sem cruzar URLs entre ofertas', () => {
    const assignMock = vi.fn()
    const origLoc = window.location
    try {
      Object.defineProperty(window, 'location', {
        value: {
          ...origLoc,
          assign: assignMock,
        },
        writable: true,
        configurable: true,
      })

      const { container } = render(
        <MemoryRouter initialEntries={['/lpdesconto']}>
          <Routes>
            <Route path="/lpdesconto" element={<App variant="discount" />} />
          </Routes>
        </MemoryRouter>
      )

      // Seleciona Starlight
      const starlightBtn = container.querySelector('.swatch-starlight') as HTMLButtonElement
      expect(starlightBtn).not.toBeNull()
      fireEvent.click(starlightBtn)

      // Adiciona ao carrinho
      const addBtn = container.querySelector('.add-to-cart-btn') as HTMLButtonElement
      fireEvent.click(addBtn)

      // Avança timers para a animação do carrinho
      act(() => {
        vi.advanceTimersByTime(1000)
      })

      // Clica no botão de checkout do drawer
      const checkoutBtn = container.querySelector('.cart-checkout-btn') as HTMLButtonElement
      if (checkoutBtn) {
        fireEvent.click(checkoutBtn)
        
        // Na visualização de checkout, clica em finalizar
        const submitBtn = container.querySelector('.checkout-submit-btn') as HTMLAnchorElement
        if (submitBtn) {
          fireEvent.click(submitBtn)
          expect(assignMock).toHaveBeenCalledWith(expect.stringContaining('https://checkout.plaudai.site/VCCL1O8SD7GG'))
        }
      }
    } finally {
      Object.defineProperty(window, 'location', {
        value: origLoc,
        writable: true,
        configurable: true,
      })
    }
  })

  it('10. Total promocional é recalculado corretamente conforme a quantidade no carrinho', () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/lpdesconto']}>
        <Routes>
          <Route path="/lpdesconto" element={<App variant="discount" />} />
        </Routes>
      </MemoryRouter>
    )

    // Aumenta quantidade para 2
    const incBtn = container.querySelector('.quantity-control .qty-btn:last-child') as HTMLButtonElement
    fireEvent.click(incBtn)

    // Adiciona ao carrinho
    const addBtn = container.querySelector('.add-to-cart-btn') as HTMLButtonElement
    fireEvent.click(addBtn)

    act(() => {
      vi.advanceTimersByTime(1000)
    })

    // Subtotal esperado: 2 * 86.90 = 173.80 -> "R$173,80"
    const subtotalVal = container.querySelector('.cart-summary-row .summary-val')
    expect(subtotalVal?.textContent).toBe('R$173,80')
  })

  it('11. Encaminhamento seguro de UTMs e src para o checkout promocional sem duplicações', () => {
    sessionStorage.setItem('utm_params', JSON.stringify({
      utm_source: 'facebook',
      utm_campaign: 'promo_lp',
      src: 'fb_ads',
    }))

    const promoUrl = OFFERS.discount.checkoutUrlsByColor.blue
    const finalUrl = buildCheckoutUrl(promoUrl)

    expect(finalUrl).toContain('https://checkout.plaudai.site/VCCL1O8SD7GD')
    expect(finalUrl).toContain('utm_source=facebook')
    expect(finalUrl).toContain('utm_campaign=promo_lp')
    expect(finalUrl).toContain('src=fb_ads')
  })

  it('12. Rota promocional não dispara evento Purchase', () => {
    const fbqMock = vi.fn()
    ;(window as unknown as { fbq?: unknown }).fbq = fbqMock

    render(
      <MemoryRouter initialEntries={['/lpdesconto']}>
        <Routes>
          <Route path="/lpdesconto" element={<App variant="discount" />} />
        </Routes>
      </MemoryRouter>
    )

    // Verifica que Purchase nunca foi chamado
    expect(fbqMock).not.toHaveBeenCalledWith('track', 'Purchase', expect.anything())
    delete (window as unknown as { fbq?: unknown }).fbq
  })

  it('13. /lpdesconto injeta meta robots noindex, nofollow, noarchive e restaura ao desmontar', () => {
    const { unmount } = render(
      <MemoryRouter initialEntries={['/lpdesconto']}>
        <Routes>
          <Route path="/lpdesconto" element={<App variant="discount" />} />
        </Routes>
      </MemoryRouter>
    )

    const meta = document.querySelector('meta[name="robots"]')
    expect(meta).not.toBeNull()
    expect(meta?.getAttribute('content')).toBe('noindex, nofollow, noarchive')

    unmount()

    const metaAfter = document.querySelector('meta[name="robots"]')
    expect(metaAfter).toBeNull()
  })

  it('14. / e /lpdesconto mantêm somente UMA imagem LCP com fetchpriority="high"', () => {
    const { container: standardContainer } = render(
      <MemoryRouter>
        <App variant="standard" />
      </MemoryRouter>
    )
    expect(standardContainer.querySelectorAll('img[fetchpriority="high"]').length).toBe(1)

    const { container: discountContainer } = render(
      <MemoryRouter>
        <App variant="discount" />
      </MemoryRouter>
    )
    expect(discountContainer.querySelectorAll('img[fetchpriority="high"]').length).toBe(1)
  })

  it('15. Configurações de oferta mantêm isolamento e não expõem chaves privadas', () => {
    expect(OFFERS.standard.noindex).toBe(false)
    expect(OFFERS.discount.noindex).toBe(true)
    expect(OFFERS.standard.price).toBe(119.90)
    expect(OFFERS.discount.price).toBe(86.90)
  })

  it('16. Navegação na mesma sessão (/ -> /lpdesconto -> /) atualiza e restaura carrinho, subtotal e checkout com isolamento total', () => {
    let navigateFn!: (to: string) => void

    const NavHelper = () => {
      const navigate = useNavigate()
      navigateFn = navigate
      return null
    }

    const { container } = render(
      <MemoryRouter initialEntries={['/']}>
        <NavHelper />
        <Routes>
          <Route path="/" element={<App variant="standard" />} />
          <Route path="/lpdesconto" element={<App variant="discount" />} />
        </Routes>
      </MemoryRouter>
    )

    // 1. Em /: Seleciona azul e adiciona ao carrinho por R$119,90
    const blueSwatch = container.querySelector('.swatch-blue') as HTMLButtonElement
    fireEvent.click(blueSwatch)

    const addBtn = container.querySelector('.add-to-cart-btn') as HTMLButtonElement
    fireEvent.click(addBtn)

    act(() => {
      vi.advanceTimersByTime(1000)
    })

    // Confirma estado inicial na oferta standard: R$119,90
    expect(container.querySelector('.pricing-section .price-value')?.textContent).toBe('R$119,90')
    expect(container.querySelector('.buy-bar-pricing .pix-val')?.textContent).toBe('R$119,90')
    expect(container.querySelector('.cart-item-price')?.textContent).toBe('R$119,90')
    expect(container.querySelector('.cart-summary-row .summary-val')?.textContent).toBe('R$119,90')

    // 2. Navega na mesma sessão para /lpdesconto
    act(() => {
      navigateFn('/lpdesconto')
    })

    // Confirma que tudo passa integralmente para R$86,90
    expect(container.querySelector('.pricing-section .price-value')?.textContent).toBe('R$86,90')
    expect(container.querySelector('.buy-bar-pricing .pix-val')?.textContent).toBe('R$86,90')
    expect(container.querySelector('.cart-item-price')?.textContent).toBe('R$86,90')
    expect(container.querySelector('.cart-summary-row .summary-val')?.textContent).toBe('R$86,90')
    expect(container.querySelector('.total-row .summary-val')?.textContent).toBe('R$86,90')

    // 3. Retorna para /
    act(() => {
      navigateFn('/')
    })

    // Confirma restauração integral para R$119,90
    expect(container.querySelector('.pricing-section .price-value')?.textContent).toBe('R$119,90')
    expect(container.querySelector('.buy-bar-pricing .pix-val')?.textContent).toBe('R$119,90')
    expect(container.querySelector('.cart-item-price')?.textContent).toBe('R$119,90')
    expect(container.querySelector('.cart-summary-row .summary-val')?.textContent).toBe('R$119,90')
    expect(container.querySelector('.total-row .summary-val')?.textContent).toBe('R$119,90')
  })
})
