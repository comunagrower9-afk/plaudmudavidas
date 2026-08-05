import React, { Suspense, lazy } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import App from '../App'
// Carregamento lazy de rotas secundárias e guards para otimização do bundle inicial da landing page
const CustomerProtectedRoute = lazy(() => import('../components/auth/CustomerProtectedRoute').then(m => ({ default: m.CustomerProtectedRoute })))
const AdminProtectedRoute = lazy(() => import('../components/auth/AdminProtectedRoute').then(m => ({ default: m.AdminProtectedRoute })))
const ThankYouPage = lazy(() => import('../pages/ThankYouPage'))
const CustomerLoginPage = lazy(() => import('../pages/customer/CustomerLoginPage').then(m => ({ default: m.CustomerLoginPage })))
const CustomerOrdersPage = lazy(() => import('../pages/customer/CustomerOrdersPage').then(m => ({ default: m.CustomerOrdersPage })))
const CustomerOrderDetailPage = lazy(() => import('../pages/customer/CustomerOrderDetailPage').then(m => ({ default: m.CustomerOrderDetailPage })))
const AdminLoginPage = lazy(() => import('../pages/admin/AdminLoginPage').then(m => ({ default: m.AdminLoginPage })))
const AdminOrdersPage = lazy(() => import('../pages/admin/AdminOrdersPage').then(m => ({ default: m.AdminOrdersPage })))
const NotFoundPage = lazy(() => import('../pages/NotFoundPage').then(m => ({ default: m.NotFoundPage })))

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
    Carregando...
  </div>
)

export const RootRouter: React.FC = () => {
  return (
    <BrowserRouter>
      <Routes>
        {/* Landing Page Principal (Síncrona - Sem Waterfall) */}
        <Route path="/" element={<App variant="standard" />} />

        {/* Landing Page Promocional (Síncrona - Reutiliza App com Oferta de R$ 86,90) */}
        <Route path="/lpdesconto" element={<App variant="discount" />} />

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
        <Route
          path="/entrar"
          element={
            <Suspense fallback={<PageLoadingFallback />}>
              <CustomerLoginPage />
            </Suspense>
          }
        />
        <Route
          path="/minha-conta"
          element={
            <Suspense fallback={<PageLoadingFallback />}>
              <CustomerProtectedRoute>
                <CustomerOrdersPage />
              </CustomerProtectedRoute>
            </Suspense>
          }
        />
        <Route
          path="/minha-conta/pedidos/:orderId"
          element={
            <Suspense fallback={<PageLoadingFallback />}>
              <CustomerProtectedRoute>
                <CustomerOrderDetailPage />
              </CustomerProtectedRoute>
            </Suspense>
          }
        />

        {/* Painel Administrativo */}
        <Route
          path="/admin/login"
          element={
            <Suspense fallback={<PageLoadingFallback />}>
              <AdminLoginPage />
            </Suspense>
          }
        />
        <Route
          path="/admin/pedidos"
          element={
            <Suspense fallback={<PageLoadingFallback />}>
              <AdminProtectedRoute>
                <AdminOrdersPage />
              </AdminProtectedRoute>
            </Suspense>
          }
        />

        {/* Rota 404 */}
        <Route
          path="*"
          element={
            <Suspense fallback={<PageLoadingFallback />}>
              <NotFoundPage />
            </Suspense>
          }
        />
      </Routes>
    </BrowserRouter>
  )
}

