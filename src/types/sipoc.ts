export type SipocSupplier = {
  id: string
  user_id: string
  name: string
  created_at: string
}

export type SipocCustomer = {
  id: string
  user_id: string
  name: string
  created_at: string
}

export type SipocEntry = {
  id: string
  process_id: string
  supplier_id?: string | null
  input_description?: string
  output_description?: string
  customer_id?: string | null
  sort_order: number
  created_at: string
  updated_at: string
  // Joined
  supplier?: SipocSupplier
  customer?: SipocCustomer
}
