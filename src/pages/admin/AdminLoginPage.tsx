import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { OtpAuthForm } from '../../components/auth/OtpAuthForm'
import { useAuth } from '../../context/AuthContext'

export const AdminLoginPage: React.FC = () => {
  const navigate = useNavigate()
  const { checkIsAdmin, signOut } = useAuth()
  const [authError, setAuthError] = useState<string | null>(null)

  const handleAdminLoginSuccess = async () => {
    try {
      // Verifica autorização de administrador via RPC SECURITY DEFINER
      const isAuthorized = await checkIsAdmin()

      if (!isAuthorized) {
        // Encerra imediatamente a sessão se o usuário não constar na tabela admin_users
        await signOut()
        setAuthError('Acesso administrativo não autorizado. Esta conta não possui privilégios de operador.')
        return
      }

      navigate('/admin/pedidos')
    } catch {
      await signOut()
      setAuthError('Erro ao validar privilégios administrativos.')
    }
  }

  return (
    <div className="portal-page-wrapper portal-admin-bg">
      <div className="portal-container">
        {authError && (
          <div className="portal-alert portal-alert-error" style={{ maxWidth: 480, margin: '0 auto 24px' }}>
            <span>🔒 {authError}</span>
          </div>
        )}

        <OtpAuthForm
          title="Painel de Operações"
          subtitle="Acesso restrito para operadores autorizados da Plaud Note Brasil."
          badgeText="PAINEL ADMINISTRATIVO"
          shouldCreateUser={false}
          onSuccess={handleAdminLoginSuccess}
          footerLink={{
            label: '← Voltar para o início',
            href: '/',
          }}
        />
      </div>
    </div>
  )
}
