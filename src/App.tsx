import { useState, useRef, useCallback, useEffect } from 'react'
import './index.css'

const PRODUCT_COLORS = [
  { id: 'blue', name: 'Azul', hex: '#264e70' },
  { id: 'gray', name: 'Cinza', hex: '#687687' },
  { id: 'silver', name: 'Prata', hex: '#c5c8cb' },
  { id: 'starlight', name: 'Starlight', hex: '#dfd7c8' },
]

const COLOR_NAMES: Record<string, string> = {
  blue: 'Azul',
  gray: 'Cinza',
  silver: 'Prata',
  starlight: 'Starlight',
}

const CHECKOUT_URLS_BY_COLOR: Record<string, string> = {
  blue: 'https://checkout.plaudai.site/VCCL1O8SD7C1',
  silver: 'https://checkout.plaudai.site/VCCL1O8SD7BX',
  gray: 'https://checkout.plaudai.site/VCCL1O8SD7C0',
  starlight: 'https://checkout.plaudai.site/VCCL1O8SD7BU',
}

interface ProductImage {
  src: string
  alt: string
  isFixed?: boolean
}

interface CartItem {
  id: string
  name: string
  colorId: string
  colorName: string
  image: string
  price: number
  quantity: number
}

interface FlyingParticle {
  id: number
  startX: number
  startY: number
  targetX: number
  targetY: number
  color: string
}

const DEFAULT_PRODUCT_IMAGES: ProductImage[] = [
  { src: '/images/opcaofixa.webp', alt: 'PLAUD Note', isFixed: true }
]

const PRODUCT_IMAGES_BY_COLOR: Record<string, ProductImage[]> = {
  blue: [
    { src: '/images/plaudeblue1.webp', alt: 'PLAUD Note Azul - Vista principal' },
    { src: '/images/plaudeblue2.webp', alt: 'PLAUD Note Azul - Vista lateral' },
    { src: '/images/plaudeblue3.webp', alt: 'PLAUD Note Azul - Vista traseira' },
    { src: '/images/plaudeblue4.webp', alt: 'PLAUD Note Azul - Detalhe' },
    { src: '/images/plaudeblue5.webp', alt: 'PLAUD Note Azul - Em uso' },
  ],
  gray: [
    { src: '/images/1.webp', alt: 'PLAUD Note Cinza - Vista principal' },
    { src: '/images/2.webp', alt: 'PLAUD Note Cinza - Vista lateral' },
    { src: '/images/3.webp', alt: 'PLAUD Note Cinza - Vista traseira' },
    { src: '/images/4.webp', alt: 'PLAUD Note Cinza - Detalhe' },
    { src: '/images/5.webp', alt: 'PLAUD Note Cinza - Em uso' },
  ],
  silver: [
    { src: '/images/plaudesilver1.webp', alt: 'PLAUD Note Prata - Vista principal' },
    { src: '/images/plaudesilver2.webp', alt: 'PLAUD Note Prata - Vista lateral' },
    { src: '/images/plaudesilver3.webp', alt: 'PLAUD Note Prata - Vista traseira' },
    { src: '/images/plaudesilver4.webp', alt: 'PLAUD Note Prata - Detalhe' },
    { src: '/images/plaudesilver5.webp', alt: 'PLAUD Note Prata - Em uso' },
  ],
  starlight: [
    { src: '/images/plaudestarlight1.webp', alt: 'PLAUD Note Starlight - Vista principal' },
    { src: '/images/plaudestarlight2.webp', alt: 'PLAUD Note Starlight - Vista lateral' },
    { src: '/images/plaudestarlight3.webp', alt: 'PLAUD Note Starlight - Vista traseira' },
    { src: '/images/plaudestarlight4.webp', alt: 'PLAUD Note Starlight - Detalhe' },
    { src: '/images/plaudestarlight5.webp', alt: 'PLAUD Note Starlight - Em uso' },
  ],
}

/* ===== ICON COMPONENTS ===== */
const SearchIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <circle cx="11" cy="11" r="8" />
    <path d="m21 21-4.35-4.35" />
  </svg>
)

const CartIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" />
    <line x1="3" y1="6" x2="21" y2="6" />
    <path d="M16 10a4 4 0 01-8 0" />
  </svg>
)

const MenuIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <line x1="3" y1="6" x2="21" y2="6" />
    <line x1="3" y1="12" x2="21" y2="12" />
    <line x1="3" y1="18" x2="21" y2="18" />
  </svg>
)

const ChevronDown = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="6,9 12,15 18,9" />
  </svg>
)

const ArrowRight = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="5" y1="12" x2="19" y2="12" />
    <polyline points="12,5 19,12 12,19" />
  </svg>
)

const StarIcon = ({ filled }: { filled: boolean }) => (
  <svg className={`star ${filled ? 'filled' : ''}`} viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.5">
    <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26" />
  </svg>
)

/* Return icon */
const ReturnIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <polyline points="1,4 1,10 7,10" />
    <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
  </svg>
)

/* Shield icon */
const ShieldIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
)

/* Headset icon */
const HeadsetIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M3 18v-6a9 9 0 0 1 18 0v6" />
    <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z" />
  </svg>
)

/* Instagram icon */
const InstagramIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
  </svg>
)

/* LinkedIn icon */
const LinkedInIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor">
    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
  </svg>
)

/* Close icon */
const CloseIcon = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
)

/* Trash icon */
const TrashIcon = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 6h18" />
    <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
    <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
    <line x1="10" y1="11" x2="10" y2="17" />
    <line x1="14" y1="11" x2="14" y2="17" />
  </svg>
)

/* Site Newsletter */
const SiteNewsletter = ({ email, setEmail }: { email: string; setEmail: (val: string) => void }) => (
  <section className="newsletter-section">
    <h2>Receba todas as novidades da PLAUD</h2>
    <p>Cadastre-se agora para ficar por dentro das nossas ofertas, novos produtos e parcerias exclusivas.</p>
    
    <form className="newsletter-form" onSubmit={e => e.preventDefault()}>
      <div className="newsletter-input-row">
        <input
          className="newsletter-input"
          type="email"
          placeholder="Seu e-mail"
          value={email}
          onChange={e => setEmail(e.target.value)}
          aria-label="Seu e-mail"
          required
        />
        <button className="newsletter-submit" type="submit" aria-label="Enviar">
          <ArrowRight />
        </button>
      </div>
    </form>
    
    <p className="newsletter-privacy">
      Ao clicar no botão acima você concorda com a{' '}
      <a href="#">política de privacidade</a> do Plaud.
    </p>
  </section>
)

/* Site Footer */
const SiteFooter = () => (
  <footer className="footer">
    <div className="footer-logo">
      <img src="/images/logo.png" alt="PLAUD" />
    </div>
    
    <div className="footer-columns">
      <div className="footer-column">
        <h4>PLAUD</h4>
        <ul>
          <li><a href="#">Sobre nós</a></li>
          <li><a href="#">Como usar</a></li>
          <li><a href="#">Política de privacidade</a></li>
          <li><a href="#">Termos de uso</a></li>
          <li><a href="#">Fale conosco</a></li>
        </ul>
      </div>
      
      <div className="footer-column">
        <h4>Produtos</h4>
        <ul>
          <li><a href="#">Plaud Note</a></li>
          <li><a href="#">Plaud NotePin</a></li>
        </ul>
      </div>
      
      <div className="footer-column">
        <h4>Atendimento</h4>
        <p>Segunda à Sexta das 09h às 18h.</p>
        <p>+55 11 98932-9358</p>
        <p>sac@plaud.com.br</p>
      </div>
    </div>

    <div className="footer-social">
      <a href="#" className="social-icon" aria-label="Instagram">
        <InstagramIcon />
      </a>
      <a href="#" className="social-icon" aria-label="LinkedIn">
        <LinkedInIcon />
      </a>
    </div>

    <div className="footer-bottom">
      <p className="footer-copyright">© 2025 PLAUD. Todos os direitos reservados.</p>
      <p className="footer-credit">Desenvolvido com tecnologia <a href="#">vtbr</a>.</p>
    </div>
  </footer>
)

function addBusinessDays(startDate: Date, days: number): string {
  const cur = new Date(startDate)
  let added = 0
  while (added < days) {
    cur.setDate(cur.getDate() + 1)
    const day = cur.getDay()
    if (day !== 0 && day !== 6) {
      added++
    }
  }
  const dd = String(cur.getDate()).padStart(2, '0')
  const mm = String(cur.getMonth() + 1).padStart(2, '0')
  return `${dd}/${mm}`
}

/* ===== MAIN APP COMPONENT ===== */
function App() {
  const [quantity, setQuantity] = useState(1)
  const [selectedColor, setSelectedColor] = useState('')
  const [openAccordion, setOpenAccordion] = useState('')
  const [cep, setCep] = useState('')
  const [cepLoading, setCepLoading] = useState(false)
  const [cepError, setCepError] = useState<string | null>(null)
  const [addressData, setAddressData] = useState<{ logradouro: string; bairro: string; localidade: string; uf: string } | null>(null)
  const [email, setEmail] = useState('')
  const [currentSlide, setCurrentSlide] = useState(0)
  const [showStickyBar, setShowStickyBar] = useState(false)

  /* Cart & Flying Particle States */
  const [currentView, setCurrentView] = useState<'product' | 'checkout'>('product')
  const [coupon, setCoupon] = useState('')
  const [affiliate, setAffiliate] = useState('')

  /* Checkout Freight States */
  const [checkoutCep, setCheckoutCep] = useState('')
  const [checkoutCepLoading, setCheckoutCepLoading] = useState(false)
  const [checkoutCepError, setCheckoutCepError] = useState<string | null>(null)
  const [checkoutAddressData, setCheckoutAddressData] = useState<{ logradouro: string; bairro: string; localidade: string; uf: string } | null>(null)
  const [selectedShippingMethod, setSelectedShippingMethod] = useState<'free' | 'express'>('free')

  const [cartItems, setCartItems] = useState<CartItem[]>([])
  const [isCartOpen, setIsCartOpen] = useState(false)
  const [isCartPopping, setIsCartPopping] = useState(false)
  const [particles, setParticles] = useState<FlyingParticle[]>([])
  const cartBtnRef = useRef<HTMLButtonElement | null>(null)

  const handleGoToCheckout = () => {
    setIsCartOpen(false)
    setCurrentView('checkout')
    if (cep && !checkoutCep) {
      setCheckoutCep(cep)
      if (addressData) {
        setCheckoutAddressData(addressData)
      }
    }
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleFinalizePurchase = () => {
    const activeColorId = cartItems.length > 0 ? cartItems[0].colorId : (selectedColor || 'gray')
    const redirectUrl = CHECKOUT_URLS_BY_COLOR[activeColorId] || CHECKOUT_URLS_BY_COLOR.gray
    window.location.href = redirectUrl
  }

  const handleCheckoutCepChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.replace(/\D/g, '')
    if (val.length > 8) val = val.slice(0, 8)
    if (val.length > 5) {
      val = `${val.slice(0, 5)}-${val.slice(5)}`
    }
    setCheckoutCep(val)
    if (checkoutCepError) setCheckoutCepError(null)
  }

  const handleFetchCheckoutCep = async () => {
    const rawCep = checkoutCep.replace(/\D/g, '')
    if (rawCep.length !== 8) {
      setCheckoutCepError('Por favor, digite um CEP válido com 8 dígitos.')
      setCheckoutAddressData(null)
      return
    }

    setCheckoutCepLoading(true)
    setCheckoutCepError(null)

    try {
      const res = await fetch(`https://viacep.com.br/ws/${rawCep}/json/`)
      const data = await res.json()

      if (data.erro) {
        setCheckoutCepError('CEP não encontrado. Verifique o número e tente novamente.')
        setCheckoutAddressData(null)
      } else {
        setCheckoutAddressData({
          logradouro: data.logradouro || '',
          bairro: data.bairro || '',
          localidade: data.localidade || '',
          uf: data.uf || '',
        })
      }
    } catch (err) {
      setCheckoutCepError('Não foi possível consultar o CEP no momento. Tente novamente.')
      setCheckoutAddressData(null)
    } finally {
      setCheckoutCepLoading(false)
    }
  }

  const handleCheckoutCepKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleFetchCheckoutCep()
    }
  }

  const cartCount = cartItems.reduce((sum, item) => sum + item.quantity, 0)
  const subtotal = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0)
  const discount = 0
  const shippingCost = checkoutAddressData ? (selectedShippingMethod === 'express' ? 25.90 : 0) : 0
  const cartTotal = subtotal - discount
  const checkoutTotal = subtotal - discount + shippingCost

  const formatCurrency = (val: number) => {
    return 'R$' + val.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }

  const updateCartQty = (colorId: string, delta: number) => {
    setCartItems(prev => {
      const next = prev.map(item => {
        if (item.colorId === colorId) {
          const newQty = item.quantity + delta
          return newQty > 0 ? { ...item, quantity: newQty } : null
        }
        return item
      }).filter(Boolean) as CartItem[]

      if (next.length === 0) {
        setIsCartOpen(false)
      }
      return next
    })
  }

  const removeCartItem = (colorId: string) => {
    setCartItems(prev => {
      const next = prev.filter(item => item.colorId !== colorId)
      if (next.length === 0) {
        setIsCartOpen(false)
      }
      return next
    })
  }

  const handleAddToCart = (e: React.MouseEvent<HTMLButtonElement>) => {
    const colorId = selectedColor || 'gray'
    if (!selectedColor) {
      setSelectedColor('gray')
    }

    const colorName = COLOR_NAMES[colorId] || 'Cinza'
    const activeColorObj = PRODUCT_COLORS.find(c => c.id === colorId) || PRODUCT_COLORS[0]
    const particleColor = activeColorObj.hex

    const imageSrc = colorId === 'blue'
      ? '/images/plaudeblue1.webp'
      : colorId === 'silver'
      ? '/images/plaudesilver1.webp'
      : colorId === 'starlight'
      ? '/images/plaudestarlight1.webp'
      : '/images/1.webp'

    // Find origin point (active color swatch on screen, or clicked button)
    const activeSwatch = document.querySelector('.color-swatch.active') || document.querySelector('.bar-swatch.active')
    let startX: number, startY: number
    if (activeSwatch) {
      const swatchRect = activeSwatch.getBoundingClientRect()
      if (swatchRect.top >= 0 && swatchRect.bottom <= window.innerHeight) {
        startX = swatchRect.left + swatchRect.width / 2
        startY = swatchRect.top + swatchRect.height / 2
      } else {
        const clickRect = e.currentTarget.getBoundingClientRect()
        startX = clickRect.left + clickRect.width / 2
        startY = clickRect.top + clickRect.height / 2
      }
    } else {
      const clickRect = e.currentTarget.getBoundingClientRect()
      startX = clickRect.left + clickRect.width / 2
      startY = clickRect.top + clickRect.height / 2
    }

    let targetX = window.innerWidth - 65
    let targetY = 38
    if (cartBtnRef.current) {
      const cartRect = cartBtnRef.current.getBoundingClientRect()
      targetX = cartRect.left + cartRect.width / 2
      targetY = cartRect.top + cartRect.height / 2
    }

    const particleId = Date.now() + Math.random()
    const newParticle: FlyingParticle = {
      id: particleId,
      startX,
      startY,
      targetX,
      targetY,
      color: particleColor,
    }

    setParticles(prev => [...prev, newParticle])

    setTimeout(() => {
      setCartItems(prev => {
        const existingIndex = prev.findIndex(item => item.colorId === colorId)
        if (existingIndex > -1) {
          const updated = [...prev]
          updated[existingIndex] = { ...updated[existingIndex], quantity: updated[existingIndex].quantity + quantity }
          return updated
        } else {
          return [...prev, {
            id: colorId,
            name: 'Plaud Note',
            colorId,
            colorName,
            image: imageSrc,
            price: 119.90,
            quantity: quantity,
          }]
        }
      })

      setParticles(prev => prev.filter(p => p.id !== particleId))
      setIsCartPopping(true)
      setTimeout(() => {
        setIsCartPopping(false)
        setIsCartOpen(true)
      }, 400)
    }, 600)
  }

  const handleCepChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.replace(/\D/g, '')
    if (val.length > 8) val = val.slice(0, 8)
    if (val.length > 5) {
      val = `${val.slice(0, 5)}-${val.slice(5)}`
    }
    setCep(val)
    if (cepError) setCepError(null)
  }

  const handleFetchCep = async () => {
    const rawCep = cep.replace(/\D/g, '')
    if (rawCep.length !== 8) {
      setCepError('Por favor, digite um CEP válido com 8 dígitos.')
      setAddressData(null)
      return
    }

    setCepLoading(true)
    setCepError(null)

    try {
      const res = await fetch(`https://viacep.com.br/ws/${rawCep}/json/`)
      const data = await res.json()

      if (data.erro) {
        setCepError('CEP não encontrado. Verifique o número e tente novamente.')
        setAddressData(null)
      } else {
        setAddressData({
          logradouro: data.logradouro || '',
          bairro: data.bairro || '',
          localidade: data.localidade || '',
          uf: data.uf || '',
        })
      }
    } catch (err) {
      setCepError('Não foi possível consultar o CEP no momento. Tente novamente.')
      setAddressData(null)
    } finally {
      setCepLoading(false)
    }
  }

  const handleCepKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleFetchCep()
    }
  }

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 400) {
        setShowStickyBar(true)
      } else {
        setShowStickyBar(false)
      }
    }
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const currentImages = (selectedColor && PRODUCT_IMAGES_BY_COLOR[selectedColor])
    ? PRODUCT_IMAGES_BY_COLOR[selectedColor]
    : DEFAULT_PRODUCT_IMAGES

  /* Carousel touch/swipe handling */
  const touchStartX = useRef(0)
  const touchEndX = useRef(0)
  const carouselRef = useRef<HTMLDivElement>(null)

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX
  }, [])

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    touchEndX.current = e.touches[0].clientX
  }, [])

  const handleTouchEnd = useCallback(() => {
    const diff = touchStartX.current - touchEndX.current
    const threshold = 50
    if (diff > threshold && currentSlide < currentImages.length - 1) {
      setCurrentSlide(prev => prev + 1)
    } else if (diff < -threshold && currentSlide > 0) {
      setCurrentSlide(prev => prev - 1)
    }
  }, [currentSlide, currentImages.length])

  const goToSlide = useCallback((index: number) => {
    setCurrentSlide(index)
  }, [])

  const toggleAccordion = (id: string) => {
    setOpenAccordion(openAccordion === id ? '' : id)
  }

  return (
    <div className="page-wrapper">
      {/* ===== SECTION 01: Announcement Bar + Header ===== */}
      <div className="announcement-bar">
        A marca número 1 no mundo de gravadores de IA.
      </div>

      <header className="header">
        <a
          href="#"
          className="header-logo"
          onClick={e => {
            e.preventDefault()
            setCurrentView('product')
            window.scrollTo({ top: 0, behavior: 'smooth' })
          }}
        >
          <img src="/images/logo.png" alt="PLAUD" />
        </a>
        <div className="header-actions">
          <button className="header-icon" aria-label="Buscar">
            <SearchIcon />
          </button>
          <button
            ref={cartBtnRef}
            className={`header-icon cart-btn ${isCartPopping ? 'pop' : ''}`}
            aria-label="Carrinho"
            onClick={() => setIsCartOpen(true)}
          >
            <CartIcon />
            {cartCount > 0 && (
              <span className={`cart-count-badge ${isCartPopping ? 'badge-pop' : ''}`}>
                {cartCount}
              </span>
            )}
          </button>
          <button className="header-icon" aria-label="Menu">
            <MenuIcon />
          </button>
        </div>
      </header>

      {currentView === 'checkout' ? (
        /* ===== CHECKOUT VIEW (100% fiel à referência) ===== */
        <div className="checkout-page-container">
          <div className="checkout-content">
            {/* Card 1: Meu carrinho */}
            <div className="checkout-card">
              <div className="checkout-card-header">
                <h2 className="checkout-card-title">
                  Meu carrinho <span className="checkout-count">({cartCount})</span>
                </h2>
              </div>

              <div className="checkout-items-list">
                {cartItems.map(item => (
                  <div className="checkout-item" key={item.id}>
                    <div className="checkout-item-img-box">
                      <img src={item.image} alt={`${item.name} ${item.colorName}`} />
                    </div>

                    <div className="checkout-item-info">
                      <div className="checkout-item-top">
                        <div>
                          <h3 className="checkout-item-title">{item.name}</h3>
                          <p className="checkout-item-color">{item.colorName}</p>
                        </div>
                        <button
                          className="checkout-item-close-btn"
                          onClick={() => {
                            removeCartItem(item.colorId)
                            if (cartItems.length <= 1) {
                              setCurrentView('product')
                            }
                          }}
                          aria-label="Remover item"
                        >
                          <CloseIcon />
                        </button>
                      </div>

                      <div className="checkout-prices-grid">
                        <div className="price-col">
                          <span className="price-label-sm">Valor unitário</span>
                          <span className="price-val-unit">{formatCurrency(item.price)}</span>
                        </div>
                        <div className="price-col price-col-right">
                          <span className="price-label-sm">Valor parcial</span>
                          <span className="price-val-partial">{formatCurrency(item.price * item.quantity)}</span>
                        </div>
                      </div>

                      <div className="checkout-item-bottom">
                        <div className="checkout-qty-control">
                          <button
                            className="checkout-qty-btn"
                            onClick={() => {
                              updateCartQty(item.colorId, -1)
                              if (item.quantity === 1 && cartItems.length === 1) {
                                setCurrentView('product')
                              }
                            }}
                            aria-label="Diminuir quantidade"
                          >
                            −
                          </button>
                          <span className="checkout-qty-val">{item.quantity}</span>
                          <button
                            className="checkout-qty-btn"
                            onClick={() => updateCartQty(item.colorId, 1)}
                            aria-label="Aumentar quantidade"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Card 2: Resumo da compra */}
            <div className="checkout-card">
              <div className="checkout-card-header">
                <h2 className="checkout-card-title">Resumo da compra</h2>
              </div>

              <div className="checkout-summary-body">
                <div className="checkout-summary-row">
                  <span className="summary-text">Subtotal</span>
                  <span className="summary-value">{formatCurrency(subtotal)}</span>
                </div>

                <div className="checkout-input-row">
                  <span className="input-row-label">Cupom</span>
                  <div className="input-group">
                    <input
                      type="text"
                      placeholder="opcional"
                      value={coupon}
                      onChange={e => setCoupon(e.target.value)}
                    />
                    <button type="button" className="input-group-btn">Aplicar</button>
                  </div>
                </div>

                <div className="checkout-input-row">
                  <span className="input-row-label">Afiliado</span>
                  <div className="input-group">
                    <input
                      type="text"
                      placeholder="opcional"
                      value={affiliate}
                      onChange={e => setAffiliate(e.target.value)}
                    />
                    <button type="button" className="input-group-btn">Aplicar</button>
                  </div>
                </div>

                <div className="checkout-input-row">
                  <span className="input-row-label">Frete</span>
                  <div className="input-group">
                    <input
                      type="text"
                      placeholder="CEP"
                      value={checkoutCep}
                      onChange={handleCheckoutCepChange}
                      onKeyDown={handleCheckoutCepKeyDown}
                      maxLength={9}
                    />
                    <button
                      type="button"
                      className="input-group-btn"
                      onClick={handleFetchCheckoutCep}
                      disabled={checkoutCepLoading}
                    >
                      {checkoutCepLoading ? '...' : 'Calcular'}
                    </button>
                  </div>
                </div>

                {checkoutCepError && (
                  <p className="checkout-cep-error">{checkoutCepError}</p>
                )}

                {checkoutAddressData && (
                  <div className="checkout-shipping-options">
                    <div
                      className={`checkout-shipping-option ${selectedShippingMethod === 'free' ? 'selected' : ''}`}
                      onClick={() => setSelectedShippingMethod('free')}
                    >
                      <div className="checkout-shipping-checkbox">
                        {selectedShippingMethod === 'free' && (
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        )}
                      </div>
                      <div className="checkout-shipping-info">
                        <span className="checkout-shipping-name">Frete Grátis</span>
                        <span className="checkout-shipping-estimate">
                          até 10 dias úteis ({addBusinessDays(new Date(), 10)})
                        </span>
                      </div>
                      <span className="checkout-shipping-price">R$0,00</span>
                    </div>

                    <div
                      className={`checkout-shipping-option ${selectedShippingMethod === 'express' ? 'selected' : ''}`}
                      onClick={() => setSelectedShippingMethod('express')}
                    >
                      <div className="checkout-shipping-checkbox">
                        {selectedShippingMethod === 'express' && (
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        )}
                      </div>
                      <div className="checkout-shipping-info">
                        <span className="checkout-shipping-name">Frete Expresso</span>
                        <span className="checkout-shipping-estimate">
                          até 4 dias úteis ({addBusinessDays(new Date(), 4)})
                        </span>
                      </div>
                      <span className="checkout-shipping-price">R$25,90</span>
                    </div>
                  </div>
                )}

                <div className="checkout-card-divider" />

                <div className="checkout-total-row">
                  <span className="total-text">Total</span>
                  <span className="total-value">{formatCurrency(checkoutTotal)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Newsletter on Checkout */}
          <SiteNewsletter email={email} setEmail={setEmail} />

          {/* Site Footer on Checkout */}
          <SiteFooter />

          {/* Fixed Green Action Button at Bottom */}
          <div className="checkout-fixed-bottom">
            <button className="checkout-submit-btn" onClick={handleFinalizePurchase}>
              Finalizar compra
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* ===== SECTION 02: Product Introduction ===== */}
          <nav className="breadcrumb" aria-label="Navegação">
            <a href="#">Página inicial</a>
            <span className="breadcrumb-sep">/</span>
        <a href="#">Plaud</a>
        <span className="breadcrumb-sep">/</span>
        <span className="current">Plaud Note</span>
      </nav>

      <section className="product-section">
        <div className="product-carousel-wrapper">
          <div
            className="product-carousel"
            ref={carouselRef}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            <div
              className="product-carousel-track"
              style={{ transform: `translateX(-${currentSlide * 100}%)` }}
            >
              {currentImages.map((img, i) => (
                <div className="product-carousel-slide" key={i}>
                  <img
                    src={img.src}
                    alt={img.alt}
                    className={img.isFixed ? 'img-opcaofixa' : ''}
                  />
                </div>
              ))}
            </div>
          </div>
          {currentImages.length > 1 && (
            <div className="carousel-dots">
              {currentImages.map((_, i) => (
                <button
                  key={i}
                  className={`carousel-dot ${i === currentSlide ? 'active' : ''}`}
                  onClick={() => goToSlide(i)}
                  aria-label={`Imagem ${i + 1}`}
                />
              ))}
            </div>
          )}
        </div>

        <h1 className="product-title">Plaud Note</h1>
        <p className="product-description">
          Transcrição por IA em 112 idiomas, com identificação de falantes e vocabulário personalizado. Gere resumos com mais de 3.000 modelos, mapas mentais e integração com fluxos de trabalho.
        </p>
        <div className="product-rating">
          <div className="stars">
            {[1, 2, 3, 4, 5].map(i => (
              <StarIcon key={i} filled={true} />
            ))}
          </div>
          <span className="review-count">(14)</span>
        </div>
      </section>

      {/* ===== SECTION 02: Pricing & Purchase ===== */}
      <section className="pricing-section">
        <p className="price-original">De <span>R$268,90</span></p>
        <div className="price-pix">
          <span className="price-value">R$119,90</span>
          <span className="price-label">no PIX</span>
        </div>
        <p className="installment-info">ou 12x de R$ 11,99</p>
        <a className="payment-details">Ver mais detalhes de pagamento</a>

        <div className="color-selector">
          <p className="color-label">Cor: <span>{selectedColor ? (COLOR_NAMES[selectedColor] || '') : 'Selecione'}</span></p>
          <div className="color-swatches">
            {PRODUCT_COLORS.map(color => (
              <button
                key={color.id}
                className={`color-swatch swatch-${color.id} ${selectedColor === color.id ? 'active' : ''}`}
                onClick={() => {
                  setSelectedColor(color.id)
                  setCurrentSlide(0)
                }}
                style={{ backgroundColor: color.hex }}
                aria-label={`Cor: ${color.name}`}
              />
            ))}
          </div>
        </div>

        <div className="quantity-section">
          <div className="quantity-control">
            <button className="qty-btn" onClick={() => setQuantity(Math.max(1, quantity - 1))} aria-label="Diminuir quantidade">−</button>
            <div className="qty-value">{quantity}</div>
            <button className="qty-btn" onClick={() => setQuantity(quantity + 1)} aria-label="Aumentar quantidade">+</button>
          </div>
          <button className="add-to-cart-btn" onClick={handleAddToCart}>Adicionar ao carrinho</button>
        </div>
      </section>

      <section className="delivery-section">
        <p className="delivery-label">Consulte o prazo de entrega:</p>
        <div className="delivery-input-row">
          <input
            className="delivery-input"
            type="text"
            placeholder="Digite seu CEP"
            value={cep}
            onChange={handleCepChange}
            onKeyDown={handleCepKeyDown}
            maxLength={9}
            aria-label="CEP"
          />
          <button
            className="delivery-btn"
            onClick={handleFetchCep}
            disabled={cepLoading}
          >
            {cepLoading ? (
              <span className="delivery-loading-spinner" />
            ) : (
              'Continuar'
            )}
          </button>
        </div>

        {cepError && (
          <div className="delivery-error">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="error-icon">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span>{cepError}</span>
          </div>
        )}

        {addressData && (
          <div className="delivery-result">
            <div className="delivery-address-box">
              <div className="delivery-address-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                  <circle cx="12" cy="10" r="3" />
                </svg>
              </div>
              <div className="delivery-address-info">
                <span className="address-badge">Entregar em</span>
                {addressData.logradouro ? (
                  <>
                    <h4 className="address-street-name">{addressData.logradouro}</h4>
                    <p className="address-location-details">
                      {addressData.bairro ? `${addressData.bairro}, ` : ''}{addressData.localidade} - {addressData.uf}
                    </p>
                  </>
                ) : (
                  <>
                    <h4 className="address-street-name">{addressData.localidade} - {addressData.uf}</h4>
                    {addressData.bairro && <p className="address-location-details">{addressData.bairro}</p>}
                  </>
                )}
              </div>
            </div>

            <div className="shipping-info-list">
              {/* Frete Grátis (10 dias úteis) */}
              <div className="shipping-info-item">
                <div className="shipping-info-left">
                  <span className="shipping-info-name">Frete Grátis</span>
                  <span className="shipping-info-time">Chega em até 10 dias úteis</span>
                </div>
                <span className="shipping-info-tag free">Grátis</span>
              </div>

              {/* Frete Expresso (4 dias úteis) */}
              <div className="shipping-info-item">
                <div className="shipping-info-left">
                  <span className="shipping-info-name">Frete Expresso</span>
                  <span className="shipping-info-time">Chega em até 4 dias úteis</span>
                </div>
                <span className="shipping-info-price">R$ 25,90</span>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* ===== SECTION 03: Feature Cards ===== */}
      <section className="feature-cards-section">
        <div className="feature-card">
          <h3>Plaud Intelligence</h3>
          <p>Transcrição por IA em 112 idiomas, com identificação de falantes e vocabulário personalizado. Gere resumos com mais de 3.000 modelos, mapas mentais e integração com fluxos de trabalho.</p>
        </div>
        <div className="feature-card">
          <h3>Segurança de dados</h3>
          <p>Compatível com SOC 2, HIPAA, GDPR e EN 18031.</p>
        </div>
        <div className="feature-card">
          <h3>Input multimodal</h3>
          <p>Capture áudio, notas, imagens e destaques para fornecer um contexto mais rico.</p>
        </div>
        <div className="feature-card">
          <h3>Resumos multidimensionais</h3>
          <p>Transforme uma única conversa em múltiplos resumos específicos para cada função.</p>
        </div>
        <div className="feature-card">
          <h3>Ultrafino e potente</h3>
          <p>Com apenas 0,327 cm de espessura e 1,06 oz, oferece 30 horas de gravação, 60 dias de standby e 64 GB de armazenamento.</p>
        </div>
        <div className="feature-card">
          <h3>Gravação em modo duplo</h3>
          <p>Alterne facilmente entre gravação de chamadas telefônicas e gravação presencial.</p>
        </div>
        <div className="feature-card">
          <h3>Plano Inicial Gratuito</h3>
          <p>300 minutos/mês de transcrição incluídos. Faça upgrade a qualquer momento para obter mais minutos e recursos avançados de IA.</p>
        </div>
      </section>

      {/* ===== SECTION 04: Features Infographic ===== */}
      <section className="infographic-section">
        <img src="/images/features-infographic.png" alt="Funcionalidades do PLAUD Note - Assistente profissional de notas, modos de gravação, compatibilidade MagSafe, transcrição com IA, input multimodal, resumos multidimensionais, Ask Plaud, 112 idiomas, rótulos de falantes, vocabulário personalizado" />
      </section>

      {/* ===== SECTION 05: Hero Headline ===== */}
      <section className="hero-headline">
        <h2>
          Grava.<br />
          Transcreve.<br />
          Resume.
        </h2>
        <p>O gravador profissional com IA que vai maximizar sua produtividade.</p>
      </section>

      {/* ===== SECTION 06: Specs Highlights ===== */}
      <section className="specs-highlights">
        <div className="spec-highlight-card">
          <div className="spec-card-image">
            <img src="/images/lp-60days.png" alt="Bateria 60 dias" />
          </div>
          <div className="spec-card-content">
            <p className="spec-card-title">
              Bateria com<br />
              duração de<br />
              até <span className="highlight">60 dias</span>
            </p>
            <p className="spec-card-subtitle">*em standby</p>
          </div>
        </div>

        <div className="spec-highlight-card">
          <div className="spec-card-image">
            <img src="/images/lp-30hours.png" alt="Gravação contínua 30 horas" />
          </div>
          <div className="spec-card-content">
            <p className="spec-card-title">
              Gravação<br />
              contínua por<br />
              até <span className="highlight">30 horas</span>
            </p>
          </div>
        </div>

        <div className="spec-highlight-card">
          <div className="spec-card-image">
            <img src="/images/lp-light.png" alt="Ultra leve 30g" />
          </div>
          <div className="spec-card-content">
            <p className="spec-card-title">
              Ultra leve com<br />
              apenas <span className="highlight">30g</span>
            </p>
          </div>
        </div>

        <div className="spec-highlight-card">
          <div className="spec-card-image">
            <img src="/images/lp-ultraslim.png" alt="Ultra fino 0,3cm" />
          </div>
          <div className="spec-card-content">
            <p className="spec-card-title">
              Ultra fino<br />
              com apenas<br />
              <span className="highlight">0,3cm</span>
            </p>
          </div>
        </div>

        <div className="spec-highlight-card">
          <div className="spec-card-image">
            <img src="/images/lp-64gb.png" alt="Armazenamento interno 64GB" />
          </div>
          <div className="spec-card-content">
            <p className="spec-card-title">
              Armazenamento<br />
              interno com<br />
              <span className="highlight">64GB</span>
            </p>
          </div>
        </div>

        <div className="spec-highlight-card">
          <div className="spec-card-image">
            <img src="/images/lp-magsafe.png" alt="Compatível com MagSafe" />
          </div>
          <div className="spec-card-content">
            <p className="spec-card-title">
              Compatível<br />
              com<br />
              <span className="highlight">MagSafe</span>
            </p>
          </div>
        </div>
      </section>

      {/* ===== SECTION 07: Two Recording Modes ===== */}
      <section className="recording-modes-section">
        <h2>Dois modos<br />de gravação</h2>
        <p>Capture cada detalhe sem esforço. O PLAUD NOTE integra os modos de gravação de chamadas e gravação presencial.</p>
        
        <div className="recording-mode-cards">
          <div className="recording-mode-card">
            <img src="/images/callmode.webp" alt="Gravação de chamadas" />
            <div className="recording-mode-overlay">
              <h3>Gravação de chamadas</h3>
              <p>Encaixa ao celular através da capa magnética para gravar as ligações.</p>
            </div>
          </div>
          <div className="recording-mode-card">
            <img src="/images/presencial.webp" alt="Gravação presencial" />
            <div className="recording-mode-overlay">
              <h3>Gravação presencial</h3>
              <p>Captura o som ambiente, perfeito para gravar suas interações cara a cara.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ===== SECTION 08: Accordion ===== */}
      <section className="accordion-section">
        <h2>Um único assistente para todas as situações</h2>
        
        {[
          {
            id: 'chamadas',
            title: 'Chamadas',
            image: '/images/chamadas.webp',
            heading: 'Grave chamadas sem esforço e não perca nenhum detalhe.',
            content: 'Chega de se esforçar para lembrar de uma informação crucial. O PLAUD NOTE grava e transcreve chamadas instantaneamente, deixando você livre para focar 100% na conversa.'
          },
          {
            id: 'reunioes',
            title: 'Reuniões',
            image: '/images/reunioes.webp',
            heading: 'Pare de fazer anotações, comece a liderar a reunião.',
            content: 'Participe ativamente da discussão enquanto o PLAUD NOTE captura, resume e organiza de forma visual as principais decisões, próximos passos e insights para você.'
          },
          {
            id: 'entrevistas',
            title: 'Entrevistas',
            image: '/images/entrevistas.webp',
            heading: 'Mantenha o contato visual, esqueça as anotações.',
            content: 'Esteja totalmente presente em cada conversa enquanto o PLAUD NOTE entrega anotações profissionais da entrevista com todos os pontos-chave.'
          },
          {
            id: 'aulas',
            title: 'Aulas e palestras',
            image: '/images/aulasepalestras.webp',
            heading: 'Sua atenção no aprendizado, não no caderno.',
            content: 'Finalmente absorva conhecimento sem nenhuma distração. O PLAUD NOTE cria anotações estruturadas e resumos visuais para facilitar seu entendimento.'
          },
          {
            id: 'notas',
            title: 'Notas de voz',
            image: '/images/notasdevoz.webp',
            heading: 'Fale suas ideias hoje, encontre-as para sempre.',
            content: 'Grave seus pensamentos e deixe que a IA transcreva, resuma, organize e os torne pesquisáveis para sempre em seu arquivo pessoal.'
          }
        ].map(item => (
          <div className="accordion-item" key={item.id}>
            <button
              className="accordion-header"
              onClick={() => toggleAccordion(item.id)}
              aria-expanded={openAccordion === item.id}
              aria-controls={`accordion-${item.id}`}
            >
              <span>{item.title}</span>
              <ChevronDown className={`accordion-arrow ${openAccordion === item.id ? 'open' : ''}`} />
            </button>
            <div
              id={`accordion-${item.id}`}
              className={`accordion-content ${openAccordion === item.id ? 'open' : ''}`}
              role="region"
            >
              <div className="accordion-inner">
                {item.image && (
                  <img className="accordion-image" src={item.image} alt={item.title} />
                )}
                {item.heading && <h3>{item.heading}</h3>}
                {item.content && <p>{item.content}</p>}
              </div>
            </div>
          </div>
        ))}
      </section>

      {/* ===== SECTION 09: PLAUD Intelligence ===== */}
      <section className="intelligence-section">
        <h2>
          Resultados superiores,<br />
          fornecidos pela{' '}
          <span className="gradient-text">PLAUD<br />Intelligence™</span>
        </h2>
        <p>
          A PLAUD Intelligence é desenvolvida com base nos modelos de IA mais avançados do mercado como{' '}
          <span className="model-names">GPT-4.1, o3-mini, Claude 3.7 Sonnet e Gemini 2.5 Pro</span>,
          para entregar a máxima precisão.
        </p>
      </section>

      {/* ===== SECTION 10: Results + Awards ===== */}
      <section className="results-section">
        <h2>Nós focamos na IA, você foca no resultado</h2>
        
        <div className="results-stats">
          <div className="result-stat">
            <div>
              <span className="stat-value">260</span>
              <span className="stat-unit"> hrs*</span>
            </div>
            <p className="stat-desc">de trabalho economizadas por ano por usuário</p>
          </div>
          <div className="result-stat">
            <div>
              <span className="stat-value">R$53.070</span>
              <span className="stat-unit"> **</span>
            </div>
            <p className="stat-desc">em valor de tempo economizado por ano por usuário</p>
          </div>
        </div>

        <div className="results-footnotes">
          <p>*estimativa baseada em uma média de 1 hora economizada por dia útil com resumos por reunião e trabalhos relacionados.</p>
          <p>*estimativa baseada em uma média ponderada de salários nos EUA, dividido pelo tempo economizado por ano.</p>
        </div>
      </section>

      <section className="awards-section">
        <div className="awards-grid">
          <div className="award-item">
            <div className="award-logo">
              <img src="/images/logo-reddot.webp" alt="reddot winner 2024" />
            </div>
          </div>
          <div className="award-item">
            <div className="award-logo">
              <img src="/images/logo-if.webp" alt="iF Design Award 2024" />
            </div>
          </div>
          <div className="award-item">
            <div className="award-logo">
              <img src="/images/logo-gda.png" alt="Good Design Award" />
            </div>
          </div>
          <div className="award-item">
            <div className="award-logo">
              <img src="/images/logo-idea.webp" alt="International Design Excellence Awards" />
            </div>
          </div>
        </div>
      </section>

      {/* ===== SECTION 11: Box Contents ===== */}
      <section className="box-contents-section">
        <h2>O que vem na caixa</h2>
        <ul className="box-list">
          <li>- 1 x dispositivo Plaud Note</li>
          <li>- 1 x capa magnética</li>
          <li>- 1 x anel magnético</li>
          <li>- 1 x cabo de carregamento USB-C</li>
          <li>- 1 x guia de início rápido</li>
        </ul>
        <div className="box-image-container">
          <img src="/images/plaud_note_oquevem.png" alt="Conteúdo da caixa PLAUD Note" />
        </div>
      </section>

      {/* ===== SECTION 12: Specifications ===== */}
      <section className="specifications-section">
        <h2>Especificações</h2>
        <div className="specs-grid">
          <div className="spec-item">
            <span className="spec-label">Dimensões</span>
            <span className="spec-value">8,56*5,41*0,30cm</span>
          </div>
          <div className="spec-item">
            <span className="spec-label">Peso</span>
            <span className="spec-value">30g</span>
          </div>
          <div className="spec-item">
            <span className="spec-label">Microfone</span>
            <span className="spec-value">2 MEMS, 1 VCS</span>
          </div>
          <div className="spec-item">
            <span className="spec-label">Tempo de carregamento</span>
            <span className="spec-value">2 horas</span>
          </div>
          <div className="spec-item">
            <span className="spec-label">Bateria</span>
            <span className="spec-value">400mAh</span>
          </div>
          <div className="spec-item">
            <span className="spec-label">Conectividade</span>
            <span className="spec-value">BLE/Wi-Fi/Cabo</span>
          </div>
          <div className="spec-item">
            <span className="spec-label">Armazenamento</span>
            <span className="spec-value">64GB</span>
          </div>
          <div className="spec-item">
            <span className="spec-label">Alcance efetivo de gravação</span>
            <span className="spec-value">3 metros</span>
          </div>
        </div>
      </section>

      {/* ===== SECTION 13: Benefits Strip ===== */}
      <section className="benefits-strip">
        <div className="benefit-item">
          <div className="benefit-icon">
            <ReturnIcon />
          </div>
          <div className="benefit-content">
            <h4>30 dias para devolução</h4>
            <p>Grátis, sem burocracia</p>
          </div>
        </div>
        <div className="benefit-item">
          <div className="benefit-icon">
            <ShieldIcon />
          </div>
          <div className="benefit-content">
            <h4>1 ano de garantia</h4>
            <p>Consulte as condições</p>
          </div>
        </div>
        <div className="benefit-item">
          <div className="benefit-icon">
            <HeadsetIcon />
          </div>
          <div className="benefit-content">
            <h4>Suporte vitalício</h4>
            <p>Mais tranquilidade para você</p>
          </div>
        </div>
      </section>

      {/* ===== SECTION 14: Newsletter ===== */}
      <SiteNewsletter email={email} setEmail={setEmail} />

      {/* ===== SECTION 15: Footer ===== */}
      <SiteFooter />

      {/* ===== Sticky Buy Bar (Barra Fixa na Rolagem - 100% fiel à referência) ===== */}
      <div className={`sticky-buy-bar ${showStickyBar ? 'visible' : ''}`}>
        <div className="buy-bar-left">
          <h3 className="buy-bar-title">Plaud Note</h3>
          <div className="buy-bar-swatches">
            {PRODUCT_COLORS.map(opt => (
              <button
                key={opt.id}
                className={`bar-swatch swatch-${opt.id} ${selectedColor === opt.id ? 'active' : ''}`}
                onClick={() => {
                  setSelectedColor(opt.id)
                  setCurrentSlide(0)
                }}
                style={{ backgroundColor: opt.hex }}
                aria-label={`Cor: ${opt.name}`}
              />
            ))}
          </div>
        </div>

        <div className="buy-bar-right">
          <div className="buy-bar-pricing">
            <div className="price-line-top">
              <span className="de-txt">De </span>
              <span className="orig-val-struck">R$268,90</span>
              <span className="por-txt"> por:</span>
            </div>
            <div className="price-line-bottom">
              <span className="pix-val">R$119,90</span>
              <span className="pix-txt"> no PIX</span>
            </div>
          </div>
          <button className="buy-pill-btn" onClick={handleAddToCart}>Adicionar ao carrinho</button>
        </div>
      </div>
      </>
      )}

      {/* ===== Flying Particles Overlay ===== */}
      {particles.map(p => (
        <div
          key={p.id}
          className="flying-particle"
          style={{
            '--start-x': `${p.startX}px`,
            '--start-y': `${p.startY}px`,
            '--target-x': `${p.targetX}px`,
            '--target-y': `${p.targetY}px`,
            backgroundColor: p.color,
          } as React.CSSProperties}
        />
      ))}

      {/* ===== Cart Drawer (Meu carrinho - 100% fiel à referência) ===== */}
      <div
        className={`cart-drawer-overlay ${isCartOpen ? 'open' : ''}`}
        onClick={() => setIsCartOpen(false)}
      >
        <div className="cart-drawer-container" onClick={e => e.stopPropagation()}>
          <div className="cart-drawer-header">
            <h2 className="cart-drawer-title">Meu carrinho</h2>
            <button
              className="cart-drawer-close"
              onClick={() => setIsCartOpen(false)}
              aria-label="Fechar carrinho"
            >
              <CloseIcon />
            </button>
          </div>

          {cartItems.length === 0 ? (
            <div className="cart-empty-state">
              <p className="cart-empty-text">Seu carrinho está vazio.</p>
              <button className="cart-continue-btn" onClick={() => setIsCartOpen(false)}>
                Continuar comprando
              </button>
            </div>
          ) : (
            <>
              <div className="cart-items-list">
                {cartItems.map(item => (
                  <div className="cart-item" key={item.id}>
                    <div className="cart-item-img-box">
                      <img src={item.image} alt={`${item.name} ${item.colorName}`} />
                    </div>

                    <div className="cart-item-details">
                      <div className="cart-item-top-row">
                        <h3 className="cart-item-name">{item.name}</h3>
                        <button
                          className="cart-item-remove-btn"
                          onClick={() => removeCartItem(item.colorId)}
                          aria-label={`Remover ${item.name}`}
                        >
                          <TrashIcon />
                        </button>
                      </div>
                      <p className="cart-item-color">{item.colorName}</p>

                      <div className="cart-item-bottom-row">
                        <div className="cart-item-qty-control">
                          <button
                            className="cart-qty-btn"
                            onClick={() => updateCartQty(item.colorId, -1)}
                            aria-label="Diminuir quantidade"
                          >
                            −
                          </button>
                          <span className="cart-qty-val">{item.quantity}</span>
                          <button
                            className="cart-qty-btn"
                            onClick={() => updateCartQty(item.colorId, 1)}
                            aria-label="Aumentar quantidade"
                          >
                            +
                          </button>
                        </div>
                        <div className="cart-item-price">
                          {formatCurrency(item.price * item.quantity)}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="cart-drawer-footer">
                <div className="cart-summary-row">
                  <span className="summary-label">Subtotal</span>
                  <span className="summary-val">{formatCurrency(subtotal)}</span>
                </div>
                <div className="cart-summary-row">
                  <span className="summary-label">Desconto</span>
                  <span className="summary-val">-R$0,00</span>
                </div>
                <div className="cart-summary-row total-row">
                  <span className="summary-label">Total</span>
                  <span className="summary-val">{formatCurrency(cartTotal)}</span>
                </div>

                <div className="cart-drawer-divider" />

                <button className="cart-checkout-btn" onClick={handleGoToCheckout}>Finalizar compra</button>
                <button className="cart-continue-btn" onClick={() => setIsCartOpen(false)}>
                  Continuar comprando
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default App
