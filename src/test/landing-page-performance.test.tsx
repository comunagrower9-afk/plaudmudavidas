import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import App from '../App'

describe('Otimizações de Performance e Imagens da Landing Page', () => {
  it('renderiza a imagem principal LCP com prioridade alta e dimensões corretas', () => {
    const { container } = render(
      <MemoryRouter>
        <App />
      </MemoryRouter>
    )

    // A primeira imagem do carrossel é o elemento LCP
    const carouselImgs = container.querySelectorAll('.product-carousel-slide img')
    expect(carouselImgs.length).toBeGreaterThan(0)
    
    const lcpImg = carouselImgs[0] as HTMLImageElement
    expect(lcpImg.getAttribute('src')).toBe('/images/opcaofixa.webp')
    expect(lcpImg.getAttribute('fetchpriority')).toBe('high')
    expect(lcpImg.getAttribute('loading')).toBe('eager')
    expect(lcpImg.getAttribute('decoding')).toBe('async')
    expect(lcpImg.getAttribute('width')).toBe('2300')
    expect(lcpImg.getAttribute('height')).toBe('1581')
  })

  it('garante que somente UMA imagem tenha fetchpriority="high"', () => {
    const { container } = render(
      <MemoryRouter>
        <App />
      </MemoryRouter>
    )

    const highPriorityImgs = container.querySelectorAll('img[fetchpriority="high"]')
    expect(highPriorityImgs.length).toBe(1)
  })

  it('renderiza o infográfico com formato WebP otimizado, lazy loading e dimensões', () => {
    const { container } = render(
      <MemoryRouter>
        <App />
      </MemoryRouter>
    )

    const infographicSection = container.querySelector('.infographic-section')
    expect(infographicSection).not.toBeNull()

    const infographicImg = infographicSection?.querySelector('img') as HTMLImageElement
    expect(infographicImg).not.toBeNull()
    expect(infographicImg.getAttribute('src')).toBe('/images/features-infographic.webp')
    expect(infographicImg.getAttribute('loading')).toBe('lazy')
    expect(infographicImg.getAttribute('decoding')).toBe('async')
    expect(infographicImg.getAttribute('width')).toBe('750')
    expect(infographicImg.getAttribute('height')).toBe('1600')
  })

  it('aplica loading="lazy" e dimensões em todas as imagens abaixo da primeira dobra', () => {
    const { container } = render(
      <MemoryRouter>
        <App />
      </MemoryRouter>
    )

    // Specs highlights
    const specImgs = container.querySelectorAll('.specs-highlights img')
    expect(specImgs.length).toBe(6)
    specImgs.forEach(img => {
      expect(img.getAttribute('loading')).toBe('lazy')
      expect(img.getAttribute('decoding')).toBe('async')
      expect(img.getAttribute('width')).toBe('500')
      expect(img.getAttribute('height')).toBe('500')
    })

    // Recording modes
    const modeImgs = container.querySelectorAll('.recording-modes-section img')
    expect(modeImgs.length).toBe(2)
    modeImgs.forEach(img => {
      expect(img.getAttribute('loading')).toBe('lazy')
      expect(img.getAttribute('decoding')).toBe('async')
      expect(img.hasAttribute('width')).toBe(true)
      expect(img.hasAttribute('height')).toBe(true)
    })

    // Awards
    const awardImgs = container.querySelectorAll('.awards-section img')
    expect(awardImgs.length).toBe(4)
    awardImgs.forEach(img => {
      expect(img.getAttribute('loading')).toBe('lazy')
      expect(img.getAttribute('decoding')).toBe('async')
      expect(img.hasAttribute('width')).toBe(true)
      expect(img.hasAttribute('height')).toBe(true)
    })

    // Box contents
    const boxImg = container.querySelector('.box-contents-section img')
    expect(boxImg).not.toBeNull()
    expect(boxImg?.getAttribute('loading')).toBe('lazy')
    expect(boxImg?.getAttribute('decoding')).toBe('async')
    expect(boxImg?.getAttribute('width')).toBe('1536')
    expect(boxImg?.getAttribute('height')).toBe('903')
  })

  it('o logo do cabeçalho não tem lazy loading e possui dimensões explícitas', () => {
    const { container } = render(
      <MemoryRouter>
        <App />
      </MemoryRouter>
    )

    const headerLogoImg = container.querySelector('.header-logo img') as HTMLImageElement
    expect(headerLogoImg).not.toBeNull()
    expect(headerLogoImg.getAttribute('src')).toBe('/images/logo.png')
    expect(headerLogoImg.getAttribute('loading')).not.toBe('lazy')
    expect(headerLogoImg.getAttribute('decoding')).toBe('async')
    expect(headerLogoImg.getAttribute('width')).toBe('350')
    expect(headerLogoImg.getAttribute('height')).toBe('60')
  })
})
