import React from 'react'
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

export const RootRouter: React.FC = () => {
  return (
    <BrowserRouter>
      <Routes>
        {/* Landing Page Principal */}
        <Route path="/" element={<App />} />

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
