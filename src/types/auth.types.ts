// Tipos de resposta customizados para a RPC claim_customer_account
export type ClaimCustomerStatus =
  | 'claimed'
  | 'already_claimed'
  | 'not_found'
  | 'conflict'
  | 'missing_email'
  | 'unconfirmed_email'
  | 'unauthenticated'

export interface ClaimCustomerResponse {
  success: boolean
  status: ClaimCustomerStatus
  customer_id?: string
  message: string
}
