import React from 'react'
import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

export const CustomerProtectedRoute: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
  const { session, loading } = useAuth()

  if (loading) {
    return (
      <div className="portal-loading-container">
        <div className="portal-spinner" />
        <p className="portal-loading-text">Carregando seus pedidos...</p>
      </div>
    )
  }

  if (!session) {
    return <Navigate to="/entrar" replace />
  }

  return children ? <>{children}</> : <Outlet />
}
