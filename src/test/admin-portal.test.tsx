import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { AdminOrdersPage } from '../pages/admin/AdminOrdersPage'
import { AuthContext, type AuthContextType } from '../context/AuthContext'
import { supabase } from '../lib/supabase'

vi.mock('../lib/supabase', () => ({
  supabase: {
    rpc: vi.fn(),
    from: vi.fn(),
    auth: {
      signOut: vi.fn(),
    },
  },
}))

const mockAdminAuthContext: AuthContextType = {
  session: { user: { id: 'usr-admin-1', email: 'admin@plaud.com.br' } } as never,
  user: { id: 'usr-admin-1', email: 'admin@plaud.com.br' } as never,
  isAdmin: true,
  loading: false,
  signOut: vi.fn(),
  checkIsAdmin: vi.fn().mockResolvedValue(true),
}

describe('Painel Administrativo (Search, Detail & Tracking Register)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('1. Busca chama exclusivamente admin_search_orders via RPC com parâmetros sanitizados', async () => {
    const user = userEvent.setup()
    vi.mocked(supabase.rpc).mockResolvedValue({
      data: {
        orders: [
          {
            order_id: 'ord-adm-1',
            order_number: 'PLAUD-2026-101',
            vega_order_id: 'VEGA-101',
            customer_name: 'Maria Oliveira',
            customer_email: 'maria@example.com',
            payment_status: 'paid',
            fulfillment_status: 'unfulfilled',
            total: 1499,
            currency: 'BRL',
            tracking_code: null,
            carrier: null,
            created_at: '2026-08-04T00:00:00Z',
          },
        ],
        total_count: 1,
        limit: 15,
        offset: 0,
      },
      error: null,
    } as never)

    render(
      <AuthContext.Provider value={mockAdminAuthContext}>
        <MemoryRouter>
          <AdminOrdersPage />
        </MemoryRouter>
      </AuthContext.Provider>
    )

    const searchInput = screen.getByPlaceholderText(/Buscar por número do pedido/i)
    const searchBtn = screen.getByRole('button', { name: /Pesquisar/i })

    await user.type(searchInput, 'Maria')
    await user.click(searchBtn)

    expect(supabase.rpc).toHaveBeenCalledWith('admin_search_orders', {
      p_query: 'Maria',
      p_limit: 15,
      p_offset: 0,
    })

    await waitFor(() => {
      expect(screen.getByText('PLAUD-2026-101')).toBeInTheDocument()
      expect(screen.getByText('Maria Oliveira')).toBeInTheDocument()
    })
  })

  it('2. Seleção de pedido chama exclusivamente admin_get_order via RPC', async () => {
    const user = userEvent.setup()
    vi.mocked(supabase.rpc).mockImplementation((fn) => {
      if (fn === 'admin_search_orders') {
        return Promise.resolve({
          data: {
            orders: [
              {
                order_id: 'ord-adm-2',
                order_number: 'PLAUD-2026-202',
                vega_order_id: 'VEGA-202',
                customer_name: 'Carlos Mendes',
                customer_email: 'carlos@example.com',
                payment_status: 'paid',
                fulfillment_status: 'unfulfilled',
                total: 1499,
                currency: 'BRL',
                tracking_code: null,
                carrier: null,
                created_at: '2026-08-04T00:00:00Z',
              },
            ],
            total_count: 1,
            limit: 15,
            offset: 0,
          },
          error: null,
        }) as never
      }

      if (fn === 'admin_get_order') {
        return Promise.resolve({
          data: {
            status: 'success',
            order: {
              id: 'ord-adm-2',
              order_number: 'PLAUD-2026-202',
              vega_order_id: 'VEGA-202',
              payment_status: 'paid',
              fulfillment_status: 'unfulfilled',
              subtotal: 1499,
              total: 1499,
              currency: 'BRL',
              tracking_code: null,
              tracking_url: null,
              carrier: null,
              shipped_at: null,
              created_at: '2026-08-04T00:00:00Z',
              updated_at: '2026-08-04T00:00:00Z',
            },
            customer: {
              id: 'cust-2',
              email: 'carlos@example.com',
              full_name: 'Carlos Mendes',
            },
            shipping_address: {
              street: 'Rua Bela Cintra',
              number: '500',
              city: 'São Paulo',
              state: 'SP',
              zip_code: '01415-000',
            },
            items: [],
            tracking_events: [],
            email_events: [],
          },
          error: null,
        }) as never
      }

      return Promise.resolve({ data: null, error: null }) as never
    })

    render(
      <AuthContext.Provider value={mockAdminAuthContext}>
        <MemoryRouter>
          <AdminOrdersPage />
        </MemoryRouter>
      </AuthContext.Provider>
    )

    // Buscar
    await user.type(screen.getByPlaceholderText(/Buscar por número do pedido/i), 'Carlos')
    await user.click(screen.getByRole('button', { name: /Pesquisar/i }))

    await waitFor(() => {
      expect(screen.getByText('PLAUD-2026-202')).toBeInTheDocument()
    })

    // Clicar no pedido
    await user.click(screen.getByText('PLAUD-2026-202'))

    expect(supabase.rpc).toHaveBeenCalledWith('admin_get_order', {
      p_order_id: 'ord-adm-2',
    })

    await waitFor(() => {
      expect(screen.getByText(/Rua Bela Cintra/i)).toBeInTheDocument()
      expect(screen.getByText(/500/i)).toBeInTheDocument()
    })
  })

  it('3. Cadastro de rastreio chama exclusivamente admin_register_order_shipment via RPC', async () => {
    const user = userEvent.setup()
    vi.mocked(supabase.rpc).mockImplementation((fn) => {
      if (fn === 'admin_search_orders') {
        return Promise.resolve({
          data: {
            orders: [
              {
                order_id: 'ord-adm-3',
                order_number: 'PLAUD-2026-303',
                vega_order_id: 'VEGA-303',
                customer_name: 'Ana Souza',
                customer_email: 'ana@example.com',
                payment_status: 'paid',
                fulfillment_status: 'unfulfilled',
                total: 1499,
                currency: 'BRL',
                tracking_code: null,
                carrier: null,
                created_at: '2026-08-04T00:00:00Z',
              },
            ],
            total_count: 1,
            limit: 15,
            offset: 0,
          },
          error: null,
        }) as never
      }

      if (fn === 'admin_get_order') {
        return Promise.resolve({
          data: {
            status: 'success',
            order: {
              id: 'ord-adm-3',
              order_number: 'PLAUD-2026-303',
              vega_order_id: 'VEGA-303',
              payment_status: 'paid',
              fulfillment_status: 'unfulfilled',
              subtotal: 1499,
              total: 1499,
              currency: 'BRL',
              tracking_code: null,
              tracking_url: null,
              carrier: null,
              shipped_at: null,
              created_at: '2026-08-04T00:00:00Z',
              updated_at: '2026-08-04T00:00:00Z',
            },
            customer: {
              id: 'cust-3',
              email: 'ana@example.com',
              full_name: 'Ana Souza',
            },
            shipping_address: {
              street: 'Rua Oscar Freire',
              number: '120',
              city: 'São Paulo',
              state: 'SP',
              zip_code: '01426-000',
            },
            items: [],
            tracking_events: [],
            email_events: [],
          },
          error: null,
        }) as never
      }

      if (fn === 'admin_register_order_shipment') {
        return Promise.resolve({
          data: {
            status: 'registered',
            order_id: 'ord-adm-3',
            order_number: 'PLAUD-2026-303',
            tracking_code: 'AA123456789BR',
            carrier: 'Correios',
            message: 'Rastreamento cadastrado com sucesso.',
          },
          error: null,
        }) as never
      }

      return Promise.resolve({ data: null, error: null }) as never
    })

    render(
      <AuthContext.Provider value={mockAdminAuthContext}>
        <MemoryRouter>
          <AdminOrdersPage />
        </MemoryRouter>
      </AuthContext.Provider>
    )

    // Buscar e selecionar
    await user.type(screen.getByPlaceholderText(/Buscar por número do pedido/i), 'Ana')
    await user.click(screen.getByRole('button', { name: /Pesquisar/i }))
    await waitFor(() => screen.getByText('PLAUD-2026-303'))
    await user.click(screen.getByText('PLAUD-2026-303'))

    // Preencher rastreio
    await waitFor(() => screen.getByPlaceholderText('Ex: NL123456789BR'))
    const trackingInput = screen.getByPlaceholderText('Ex: NL123456789BR')
    const submitBtn = screen.getByRole('button', { name: /Cadastrar Rastreamento/i })

    await user.type(trackingInput, 'AA123456789BR')
    await user.click(submitBtn)

    expect(supabase.rpc).toHaveBeenCalledWith('admin_register_order_shipment', {
      p_order_identifier: 'PLAUD-2026-303',
      p_tracking_code: 'AA123456789BR',
      p_carrier: 'Correios',
      p_replace_existing: false,
    })
  })

  it('4. Substituição de rastreio exige confirmação explícita com checkbox', async () => {
    const user = userEvent.setup()
    vi.mocked(supabase.rpc).mockImplementation((fn) => {
      if (fn === 'admin_search_orders') {
        return Promise.resolve({
          data: {
            orders: [
              {
                order_id: 'ord-adm-4',
                order_number: 'PLAUD-2026-404',
                vega_order_id: 'VEGA-404',
                customer_name: 'Bruno Lima',
                customer_email: 'bruno@example.com',
                payment_status: 'paid',
                fulfillment_status: 'shipped',
                total: 1499,
                currency: 'BRL',
                tracking_code: 'OLD123456BR',
                carrier: 'Correios',
                created_at: '2026-08-04T00:00:00Z',
              },
            ],
            total_count: 1,
            limit: 15,
            offset: 0,
          },
          error: null,
        }) as never
      }

      if (fn === 'admin_get_order') {
        return Promise.resolve({
          data: {
            status: 'success',
            order: {
              id: 'ord-adm-4',
              order_number: 'PLAUD-2026-404',
              vega_order_id: 'VEGA-404',
              payment_status: 'paid',
              fulfillment_status: 'shipped',
              subtotal: 1499,
              total: 1499,
              currency: 'BRL',
              tracking_code: 'OLD123456BR',
              tracking_url: 'https://www.17track.net/pt?nums=OLD123456BR',
              carrier: 'Correios',
              shipped_at: '2026-08-04T00:00:00Z',
              created_at: '2026-08-04T00:00:00Z',
              updated_at: '2026-08-04T00:00:00Z',
            },
            customer: {
              id: 'cust-4',
              email: 'bruno@example.com',
              full_name: 'Bruno Lima',
            },
            shipping_address: {
              street: 'Rua Augusta',
              number: '300',
              city: 'São Paulo',
              state: 'SP',
              zip_code: '01305-000',
            },
            items: [],
            tracking_events: [],
            email_events: [],
          },
          error: null,
        }) as never
      }

      if (fn === 'admin_register_order_shipment') {
        return Promise.resolve({
          data: {
            status: 'replaced',
            order_id: 'ord-adm-4',
            order_number: 'PLAUD-2026-404',
            tracking_code: 'NEW999888BR',
            carrier: 'Correios',
            message: 'Código de rastreamento substituído com sucesso.',
          },
          error: null,
        }) as never
      }

      return Promise.resolve({ data: null, error: null }) as never
    })

    render(
      <AuthContext.Provider value={mockAdminAuthContext}>
        <MemoryRouter>
          <AdminOrdersPage />
        </MemoryRouter>
      </AuthContext.Provider>
    )

    await user.type(screen.getByPlaceholderText(/Buscar por número do pedido/i), 'Bruno')
    await user.click(screen.getByRole('button', { name: /Pesquisar/i }))
    await waitFor(() => screen.getByText('PLAUD-2026-404'))
    await user.click(screen.getByText('PLAUD-2026-404'))

    await waitFor(() => screen.getByPlaceholderText('Ex: NL123456789BR'))
    await user.type(screen.getByPlaceholderText('Ex: NL123456789BR'), 'NEW999888BR')

    // Primeiro submit sem confirmação ativa o aviso e exibe o checkbox de confirmação
    const submitBtn = screen.getByRole('button', { name: /Atualizar Rastreamento/i })
    await user.click(submitBtn)

    // Checkbox deve aparecer
    const checkbox = await screen.findByRole('checkbox', {
      name: /Confirmar substituição do código existente/i,
    })
    expect(checkbox).toBeInTheDocument()
    expect(checkbox).not.toBeChecked()

    // Marcar checkbox
    await user.click(checkbox)
    expect(checkbox).toBeChecked()

    // Submeter com confirmação
    await user.click(submitBtn)

    expect(supabase.rpc).toHaveBeenCalledWith('admin_register_order_shipment', {
      p_order_identifier: 'PLAUD-2026-404',
      p_tracking_code: 'NEW999888BR',
      p_carrier: 'Correios',
      p_replace_existing: true,
    })
  })

  it('5. Alerta destacado de "Endereço de entrega incompleto" e badge "Número não informado"', async () => {
    const user = userEvent.setup()
    vi.mocked(supabase.rpc).mockImplementation((fn) => {
      if (fn === 'admin_search_orders') {
        return Promise.resolve({
          data: {
            orders: [
              {
                order_id: 'ord-adm-incomplete',
                order_number: 'PLAUD-2026-INC',
                vega_order_id: 'VEGA-INC',
                customer_name: 'Gabriel Costa',
                customer_email: 'gabriel@example.com',
                payment_status: 'paid',
                fulfillment_status: 'unfulfilled',
                total: 1499,
                currency: 'BRL',
                tracking_code: null,
                carrier: null,
                created_at: '2026-08-04T00:00:00Z',
              },
            ],
            total_count: 1,
            limit: 15,
            offset: 0,
          },
          error: null,
        }) as never
      }

      if (fn === 'admin_get_order') {
        return Promise.resolve({
          data: {
            status: 'success',
            order: {
              id: 'ord-adm-incomplete',
              order_number: 'PLAUD-2026-INC',
              vega_order_id: 'VEGA-INC',
              payment_status: 'paid',
              fulfillment_status: 'unfulfilled',
              subtotal: 1499,
              total: 1499,
              currency: 'BRL',
              tracking_code: null,
              tracking_url: null,
              carrier: null,
              shipped_at: null,
              created_at: '2026-08-04T00:00:00Z',
              updated_at: '2026-08-04T00:00:00Z',
            },
            customer: {
              id: 'cust-inc',
              email: 'gabriel@example.com',
              full_name: 'Gabriel Costa',
            },
            shipping_address: {
              street: 'Avenida Brasil',
              number: null, // SEM NÚMERO
              city: '', // SEM CIDADE
              state: 'RJ',
              zip_code: '', // SEM CEP
            },
            items: [],
            tracking_events: [],
            email_events: [],
          },
          error: null,
        }) as never
      }

      return Promise.resolve({ data: null, error: null }) as never
    })

    render(
      <AuthContext.Provider value={mockAdminAuthContext}>
        <MemoryRouter>
          <AdminOrdersPage />
        </MemoryRouter>
      </AuthContext.Provider>
    )

    await user.type(screen.getByPlaceholderText(/Buscar por número do pedido/i), 'Gabriel')
    await user.click(screen.getByRole('button', { name: /Pesquisar/i }))
    await waitFor(() => screen.getByText('PLAUD-2026-INC'))
    await user.click(screen.getByText('PLAUD-2026-INC'))

    // Validar alerta
    await waitFor(() => {
      expect(screen.getByText(/⚠️ Endereço de entrega incompleto/i)).toBeInTheDocument()
      expect(screen.getByText('Número não informado')).toBeInTheDocument()
    })
  })
})
