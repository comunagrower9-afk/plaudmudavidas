import React, { Suspense, lazy } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import App from '../App'
import { CustomerLoginPage } from '../pages/customer/CustomerLoginPage'
import { CustomerOrdersPage } from '../pages/customer/CustomerOrdersPage'
import { CustomerOrderDetailPage } from '../pages/customer/CustomerOrderDetailPage'
import { AdminLoginPage } from '../pages/admin/AdminLoginPage'
import { AdminOrdersPage } from '../pages/admin/AdminOrdersPage'
import { NotFoundPage } from '../pages/NotFoundPage'
import { CustomerProtectedRoute } from '../components/auth/CustomerProtectedRoute'
import { AdminProtectedRoute } from '../components/auth/AdminProtectedRoute'

// Carregamento lazy da Página de Obrigado para otimização de bundle
const ThankYouPage = lazy(() => import('../pages/ThankYouPage'))

const PageLoadingFallback: React.FC = () => (
  <div
    style={{
      minHeight: '100vh',
      backgroundColor: '#080c18',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: '#94a3b8',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      fontSize: '14px',
    }}
  >
    Carregando confirmação...
  </div>
)

export const RootRouter: React.FC = () => {
  return (
    <BrowserRouter>
      <Routes>
        {/* Landing Page Principal */}
        <Route path="/" element={<App />} />

        {/* Página de Obrigado Externa (Pós-Pagamento Checkout) */}
        <Route
          path="/obrigado"
          element={
            <Suspense fallback={<PageLoadingFallback />}>
              <ThankYouPage />
            </Suspense>
          }
        />

        {/* Portal do Cliente */}
        <Route path="/entrar" element={<CustomerLoginPage />} />
        <Route
          path="/minha-conta"
          element={
            <CustomerProtectedRoute>
              <CustomerOrdersPage />
            </CustomerProtectedRoute>
          }
        />
        <Route
          path="/minha-conta/pedidos/:orderId"
          element={
            <CustomerProtectedRoute>
              <CustomerOrderDetailPage />
            </CustomerProtectedRoute>
          }
        />

        {/* Painel Administrativo */}
        <Route path="/admin/login" element={<AdminLoginPage />} />
        <Route
          path="/admin/pedidos"
          element={
            <AdminProtectedRoute>
              <AdminOrdersPage />
            </AdminProtectedRoute>
          }
        />

        {/* Rota 404 */}
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  )
}

