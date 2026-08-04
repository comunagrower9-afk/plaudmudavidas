import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { CustomerLoginPage } from '../pages/customer/CustomerLoginPage'
import { AdminLoginPage } from '../pages/admin/AdminLoginPage'
import { CustomerProtectedRoute } from '../components/auth/CustomerProtectedRoute'
import { AdminProtectedRoute } from '../components/auth/AdminProtectedRoute'
import { AuthContext, type AuthContextType } from '../context/AuthContext'
import { supabase } from '../lib/supabase'

vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      signInWithOtp: vi.fn(),
      verifyOtp: vi.fn(),
      getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
      onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
      signOut: vi.fn(),
    },
    rpc: vi.fn(),
  },
}))

const defaultMockAuth: AuthContextType = {
  session: null,
  user: null,
  isAdmin: false,
  loading: false,
  signOut: vi.fn(),
  checkIsAdmin: vi.fn().mockResolvedValue(false),
}

describe('Fluxo de Autenticação OTP e Proteção de Rotas', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sessionStorage.clear()
  })

  it('1. CustomerLoginPage chama signInWithOtp com shouldCreateUser: true', async () => {
    const user = userEvent.setup()
    vi.mocked(supabase.auth.signInWithOtp).mockResolvedValue({ data: {} as never, error: null })

    render(
      <AuthContext.Provider value={defaultMockAuth}>
        <MemoryRouter>
          <CustomerLoginPage />
        </MemoryRouter>
      </AuthContext.Provider>
    )

    const emailInput = screen.getByPlaceholderText('seuemail@exemplo.com')
    const submitBtn = screen.getByRole('button', { name: /Enviar código de acesso/i })

    await user.type(emailInput, 'cliente.teste@example.com')
    await user.click(submitBtn)

    expect(supabase.auth.signInWithOtp).toHaveBeenCalledTimes(1)
    expect(supabase.auth.signInWithOtp).toHaveBeenCalledWith({
      email: 'cliente.teste@example.com',
      options: {
        shouldCreateUser: true,
      },
    })
  })

  it('2. AdminLoginPage usa shouldCreateUser: false para bloquear criação arbitrária', async () => {
    const user = userEvent.setup()
    vi.mocked(supabase.auth.signInWithOtp).mockResolvedValue({ data: {} as never, error: null })

    render(
      <AuthContext.Provider value={defaultMockAuth}>
        <MemoryRouter>
          <AdminLoginPage />
        </MemoryRouter>
      </AuthContext.Provider>
    )

    const emailInput = screen.getByPlaceholderText('seuemail@exemplo.com')
    const submitBtn = screen.getByRole('button', { name: /Enviar código de acesso/i })

    await user.type(emailInput, 'admin.operador@plaud.com.br')
    await user.click(submitBtn)

    expect(supabase.auth.signInWithOtp).toHaveBeenCalledTimes(1)
    expect(supabase.auth.signInWithOtp).toHaveBeenCalledWith({
      email: 'admin.operador@plaud.com.br',
      options: {
        shouldCreateUser: false,
      },
    })
  })

  it('3. verifyOtp recebe type: "email" e código numérico de 6 dígitos', async () => {
    const user = userEvent.setup()
    vi.mocked(supabase.auth.signInWithOtp).mockResolvedValue({ data: {} as never, error: null })
    vi.mocked(supabase.auth.verifyOtp).mockResolvedValue({
      data: {
        session: { user: { id: 'usr-123', email: 'cliente@test.com' } } as never,
        user: { id: 'usr-123', email: 'cliente@test.com' } as never,
      },
      error: null,
    })
    vi.mocked(supabase.rpc).mockResolvedValue({ data: { success: true }, error: null } as never)

    render(
      <AuthContext.Provider value={defaultMockAuth}>
        <MemoryRouter>
          <CustomerLoginPage />
        </MemoryRouter>
      </AuthContext.Provider>
    )

    // Etapa 1: Enviar e-mail
    await user.type(screen.getByPlaceholderText('seuemail@exemplo.com'), 'cliente@test.com')
    await user.click(screen.getByRole('button', { name: /Enviar código de acesso/i }))

    // Etapa 2: Digitar OTP
    await waitFor(() => {
      expect(screen.getByPlaceholderText('000000')).toBeInTheDocument()
    })

    const tokenInput = screen.getByPlaceholderText('000000')
    await user.type(tokenInput, '987654')
    await user.click(screen.getByRole('button', { name: /Acessar conta/i }))

    expect(supabase.auth.verifyOtp).toHaveBeenCalledTimes(1)
    expect(supabase.auth.verifyOtp).toHaveBeenCalledWith({
      email: 'cliente@test.com',
      token: '987654',
      type: 'email',
    })
  })

  it('4. claim_customer_account é chamado após autenticação do cliente', async () => {
    const user = userEvent.setup()
    vi.mocked(supabase.auth.signInWithOtp).mockResolvedValue({ data: {} as never, error: null })
    vi.mocked(supabase.auth.verifyOtp).mockResolvedValue({
      data: {
        session: { user: { id: 'usr-456', email: 'novo.cliente@test.com' } } as never,
        user: { id: 'usr-456', email: 'novo.cliente@test.com' } as never,
      },
      error: null,
    })
    vi.mocked(supabase.rpc).mockResolvedValue({ data: { success: true }, error: null } as never)

    render(
      <AuthContext.Provider value={defaultMockAuth}>
        <MemoryRouter>
          <CustomerLoginPage />
        </MemoryRouter>
      </AuthContext.Provider>
    )

    await user.type(screen.getByPlaceholderText('seuemail@exemplo.com'), 'novo.cliente@test.com')
    await user.click(screen.getByRole('button', { name: /Enviar código de acesso/i }))

    await waitFor(() => {
      expect(screen.getByPlaceholderText('000000')).toBeInTheDocument()
    })

    await user.type(screen.getByPlaceholderText('000000'), '654321')
    await user.click(screen.getByRole('button', { name: /Acessar conta/i }))

    await waitFor(() => {
      expect(supabase.rpc).toHaveBeenCalledWith('claim_customer_account')
    })
  })

  it('5. CustomerProtectedRoute bloqueia acesso sem sessão e redireciona para /entrar', () => {
    render(
      <AuthContext.Provider value={defaultMockAuth}>
        <MemoryRouter initialEntries={['/minha-conta']}>
          <Routes>
            <Route
              path="/minha-conta"
              element={
                <CustomerProtectedRoute>
                  <div>Conteúdo Protegido do Cliente</div>
                </CustomerProtectedRoute>
              }
            />
            <Route path="/entrar" element={<div>Tela de Login do Cliente</div>} />
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>
    )

    expect(screen.queryByText('Conteúdo Protegido do Cliente')).not.toBeInTheDocument()
    expect(screen.getByText('Tela de Login do Cliente')).toBeInTheDocument()
  })

  it('6. AdminProtectedRoute bloqueia acesso quando current_user_is_admin retorna false', () => {
    const unauthAdminContext: AuthContextType = {
      session: { user: { id: 'usr-normal', email: 'normal@test.com' } } as never,
      user: { id: 'usr-normal', email: 'normal@test.com' } as never,
      isAdmin: false,
      loading: false,
      signOut: vi.fn(),
      checkIsAdmin: vi.fn().mockResolvedValue(false),
    }

    render(
      <AuthContext.Provider value={unauthAdminContext}>
        <MemoryRouter initialEntries={['/admin/pedidos']}>
          <Routes>
            <Route
              path="/admin/pedidos"
              element={
                <AdminProtectedRoute>
                  <div>Painel Administrativo Secreto</div>
                </AdminProtectedRoute>
              }
            />
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>
    )

    expect(screen.queryByText('Painel Administrativo Secreto')).not.toBeInTheDocument()
    expect(screen.getByText('Acesso Não Autorizado')).toBeInTheDocument()
    expect(screen.getByText(/Sua conta não possui privilégios de operador administrativo/i)).toBeInTheDocument()
  })

  it('7. Administrador autorizado acessa o painel normalmente', () => {
    const mockAdminAuthContext: AuthContextType = {
      session: { user: { id: 'usr-admin', email: 'admin@plaud.com.br' } } as never,
      user: { id: 'usr-admin', email: 'admin@plaud.com.br' } as never,
      isAdmin: true,
      loading: false,
      signOut: vi.fn(),
      checkIsAdmin: vi.fn().mockResolvedValue(true),
    }

    render(
      <AuthContext.Provider value={mockAdminAuthContext}>
        <MemoryRouter initialEntries={['/admin/pedidos']}>
          <Routes>
            <Route
              path="/admin/pedidos"
              element={
                <AdminProtectedRoute>
                  <div>Painel Administrativo Ativo</div>
                </AdminProtectedRoute>
              }
            />
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>
    )

    expect(screen.getByText('Painel Administrativo Ativo')).toBeInTheDocument()
  })
})
