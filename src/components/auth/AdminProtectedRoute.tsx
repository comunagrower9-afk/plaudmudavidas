import React from 'react'
import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import '../../styles/portal.css'

export const AdminProtectedRoute: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
  const { session, loading, isAdmin } = useAuth()

  if (loading) {
    return (
      <div className="portal-loading-container">
        <div className="portal-spinner" />
        <p className="portal-loading-text">Verificando autorização...</p>
      </div>
    )
  }

  if (!session) {
    return <Navigate to="/admin/login" replace />
  }

  if (!isAdmin) {
    return (
      <div className="portal-page-wrapper">
        <div className="portal-card" style={{ maxWidth: 480, margin: '40px auto', textAlign: 'center' }}>
          <div style={{ fontSize: 36, marginBottom: 16 }}>🔒</div>
          <h2 style={{ color: '#0f172a', marginBottom: 8 }}>Acesso Não Autorizado</h2>
          <p style={{ color: '#64748b', fontSize: 14, marginBottom: 24, lineHeight: 1.5 }}>
            Sua conta não possui privilégios de operador administrativo.
          </p>
          <a
            href="/"
            className="portal-btn portal-btn-secondary"
            style={{ display: 'inline-block', textDecoration: 'none' }}
          >
            Voltar para o início
          </a>
        </div>
      </div>
    )
  }

  return children ? <>{children}</> : <Outlet />
}
