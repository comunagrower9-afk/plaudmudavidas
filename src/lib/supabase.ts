import { createClient } from '@supabase/supabase-js'
import type { Database } from '../types/database.types'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabasePublishableKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  import.meta.env.VITE_SUPABASE_ANON_KEY

export const isSupabaseConfigured = Boolean(supabaseUrl && supabasePublishableKey)

if (!isSupabaseConfigured) {
  const missingVars: string[] = []
  if (!supabaseUrl) missingVars.push('VITE_SUPABASE_URL')
  if (!supabasePublishableKey) missingVars.push('VITE_SUPABASE_PUBLISHABLE_KEY')

  if (import.meta.env.DEV) {
    console.warn(
      `[Supabase] Variáveis de ambiente ausentes: ${missingVars.join(', ')}. ` +
      `Configure-as em seu arquivo .env.local para habilitar autenticação e pedidos.`
    )
  }
}

// Inicializa o cliente tipado com o schema do banco
export const supabase = createClient<Database>(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabasePublishableKey || 'placeholder-anon-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  }
)
