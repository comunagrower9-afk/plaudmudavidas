import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { CustomerOrdersPage } from '../pages/customer/CustomerOrdersPage'
import { CustomerOrderDetailPage } from '../pages/customer/CustomerOrderDetailPage'
import { AuthContext, type AuthContextType } from '../context/AuthContext'
import { supabase } from '../lib/supabase'

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
    auth: {
      signOut: vi.fn(),
    },
  },
}))

const mockAuthContext: AuthContextType = {
  session: { user: { id: 'usr-client-1', email: 'cliente@teste.com' } } as never,
  user: { id: 'usr-client-1', email: 'cliente@teste.com' } as never,
  isAdmin: false,
  loading: false,
  signOut: vi.fn(),
  checkIsAdmin: vi.fn().mockResolvedValue(false),
}

describe('Portal do Cliente (Orders & Order Details)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('1. Cliente sem pedidos vê estado vazio amigável', async () => {
    vi.mocked(supabase.from).mockImplementation((table: string) => {
      if (table === 'customers') {
        return {
          select: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: { full_name: 'Cliente Teste' },
              error: null,
            }),
          }),
        } as never
      }

      if (table === 'orders') {
        return {
          select: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({
              data: [],
              error: null,
            }),
          }),
        } as never
      }

      return { select: vi.fn() } as never
    })

    render(
      <AuthContext.Provider value={mockAuthContext}>
        <MemoryRouter>
          <CustomerOrdersPage />
        </MemoryRouter>
      </AuthContext.Provider>
    )

    await waitFor(() => {
      expect(screen.getByText('Nenhum pedido encontrado')).toBeInTheDocument()
    })
    expect(screen.getByText(/Não encontramos pedidos associados ao e-mail/i)).toBeInTheDocument()
  })

  it('2. Cliente com pedidos visualiza listagem formatada e badges de status', async () => {
    const mockOrdersData = [
      {
        id: 'ord-uuid-1',
        order_number: 'PLAUD-2026-001',
        vega_order_id: 'VEGA-991',
        payment_status: 'paid',
        fulfillment_status: 'shipped',
        total: 1499,
        currency: 'BRL',
        created_at: '2026-08-04T00:00:00Z',
        tracking_code: 'BR123456789BR',
        carrier: 'Correios',
      },
    ]

    vi.mocked(supabase.from).mockImplementation((table: string) => {
      if (table === 'customers') {
        return {
          select: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: { full_name: 'Maria Souza' },
              error: null,
            }),
          }),
        } as never
      }

      if (table === 'orders') {
        return {
          select: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({
              data: mockOrdersData,
              error: null,
            }),
          }),
        } as never
      }

      return { select: vi.fn() } as never
    })

    render(
      <AuthContext.Provider value={mockAuthContext}>
        <MemoryRouter>
          <CustomerOrdersPage />
        </MemoryRouter>
      </AuthContext.Provider>
    )

    await waitFor(() => {
      expect(screen.getByText('PLAUD-2026-001')).toBeInTheDocument()
    })

    expect(screen.getByText('Pago')).toBeInTheDocument()
    expect(screen.getByText('Pedido enviado')).toBeInTheDocument()
    expect(screen.getByText(/BR123456789BR/)).toBeInTheDocument()
    expect(screen.getByText(/1\.499,00/)).toBeInTheDocument()
  })

  it('3. Detalhes do pedido exibem itens, timeline, endereço e botão 17TRACK', async () => {
    const mockDetailOrder = {
      id: 'ord-uuid-detail',
      order_number: 'PLAUD-2026-777',
      vega_order_id: 'VEGA-777',
      payment_status: 'paid',
      fulfillment_status: 'shipped',
      subtotal: 1499,
      total: 1499,
      currency: 'BRL',
      created_at: '2026-08-04T00:00:00Z',
      tracking_code: 'NL987654321BR',
      carrier: 'Correios',
      shipped_at: '2026-08-04T01:00:00Z',
      shipping_address: {
        street: 'Avenida Paulista',
        number: '1000',
        city: 'São Paulo',
        state: 'SP',
        zip_code: '01310-100',
      },
    }

    const mockItems = [
      {
        id: 'item-1',
        product_name: 'Plaud Note - Black',
        quantity: 1,
        unit_price: 1499,
        image_url: '/images/plaud-black.png',
      },
    ]

    const mockEvents = [
      {
        id: 'evt-1',
        status: 'shipped',
        description: 'Objeto postado na agência',
        occurred_at: '2026-08-04T01:00:00Z',
      },
    ]

    vi.mocked(supabase.from).mockImplementation((table: string) => {
      if (table === 'orders') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: mockDetailOrder,
                error: null,
              }),
            }),
          }),
        } as never
      }

      if (table === 'order_items') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({
                data: mockItems,
                error: null,
              }),
            }),
          }),
        } as never
      }

      if (table === 'tracking_events') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({
                data: mockEvents,
                error: null,
              }),
            }),
          }),
        } as never
      }

      return { select: vi.fn() } as never
    })

    render(
      <MemoryRouter initialEntries={['/minha-conta/pedidos/ord-uuid-detail']}>
        <Routes>
          <Route path="/minha-conta/pedidos/:orderId" element={<CustomerOrderDetailPage />} />
        </Routes>
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('PLAUD-2026-777')).toBeInTheDocument()
    })

    expect(screen.getByText('Plaud Note - Black')).toBeInTheDocument()
    expect(screen.getByText('NL987654321BR')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Rastrear na 17TRACK/i })).toHaveAttribute(
      'href',
      'https://www.17track.net/pt?nums=NL987654321BR'
    )
    expect(screen.getByText(/Avenida Paulista/i)).toBeInTheDocument()
  })

  it('4. Detalhes com número ausente exibem "Número não informado" e aviso de atendimento', async () => {
    const mockOrderMissingNum = {
      id: 'ord-uuid-missing-num',
      order_number: 'PLAUD-2026-888',
      vega_order_id: 'VEGA-888',
      payment_status: 'paid',
      fulfillment_status: 'processing',
      subtotal: 1499,
      total: 1499,
      currency: 'BRL',
      created_at: '2026-08-04T00:00:00Z',
      tracking_code: null,
      carrier: null,
      shipped_at: null,
      shipping_address: {
        street: 'Rua das Flores',
        number: null, // Ausente!
        city: 'Curitiba',
        state: 'PR',
        zip_code: '80000-000',
      },
    }

    vi.mocked(supabase.from).mockImplementation((table: string) => {
      if (table === 'orders') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: mockOrderMissingNum,
                error: null,
              }),
            }),
          }),
        } as never
      }

      if (table === 'order_items') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({
                data: [],
                error: null,
              }),
            }),
          }),
        } as never
      }

      if (table === 'tracking_events') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({
                data: [],
                error: null,
              }),
            }),
          }),
        } as never
      }

      return { select: vi.fn() } as never
    })

    render(
      <MemoryRouter initialEntries={['/minha-conta/pedidos/ord-uuid-missing-num']}>
        <Routes>
          <Route path="/minha-conta/pedidos/:orderId" element={<CustomerOrderDetailPage />} />
        </Routes>
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('PLAUD-2026-888')).toBeInTheDocument()
    })

    expect(screen.getByText('Número não informado')).toBeInTheDocument()
    expect(screen.getByText(/Caso algum dado do seu endereço esteja incorreto ou incompleto/i)).toBeInTheDocument()
  })
})
