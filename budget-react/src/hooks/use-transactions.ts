import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

// Types
interface Transaction {
  id: string
  date: string
  description: string
  amount: number
  category: string
  subcategory?: string
  type: 'income' | 'expense'
  payment_method: string
  receipt_url?: string
  notes?: string
  tags?: string[]
}

interface TransactionFilters {
  startDate?: string
  endDate?: string
  category?: string
  type?: string
  limit?: number
}

// API functions (replace with your actual API calls)
const fetchTransactions = async (filters: TransactionFilters = {}): Promise<Transaction[]> => {
  const params = new URLSearchParams()
  Object.entries(filters).forEach(([key, value]) => {
    if (value) params.append(key, value.toString())
  })
  
  const response = await fetch(`/api/transactions?${params}`)
  if (!response.ok) throw new Error('Failed to fetch transactions')
  const data = await response.json()
  return data.transactions || []
}

const createTransaction = async (transaction: Omit<Transaction, 'id'>): Promise<Transaction> => {
  const response = await fetch('/api/transactions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(transaction)
  })
  if (!response.ok) throw new Error('Failed to create transaction')
  return response.json()
}

const updateTransaction = async (id: string, transaction: Partial<Transaction>): Promise<Transaction> => {
  const response = await fetch(`/api/transactions/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(transaction)
  })
  if (!response.ok) throw new Error('Failed to update transaction')
  return response.json()
}

const deleteTransaction = async (id: string): Promise<void> => {
  const response = await fetch(`/api/transactions/${id}`, {
    method: 'DELETE'
  })
  if (!response.ok) throw new Error('Failed to delete transaction')
}

// Hooks
export const useTransactions = (filters: TransactionFilters = {}) => {
  return useQuery({
    queryKey: ['transactions', filters],
    queryFn: () => fetchTransactions(filters),
    staleTime: 1000 * 60 * 5, // 5 minutes
  })
}

export const useCreateTransaction = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: createTransaction,
    onSuccess: () => {
      // Invalidate and refetch transactions
      queryClient.invalidateQueries({ queryKey: ['transactions'] })
      queryClient.invalidateQueries({ queryKey: ['account-balances'] })
    },
  })
}

export const useUpdateTransaction = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: ({ id, ...transaction }: { id: string } & Partial<Transaction>) =>
      updateTransaction(id, transaction),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] })
      queryClient.invalidateQueries({ queryKey: ['account-balances'] })
    },
  })
}

export const useDeleteTransaction = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: deleteTransaction,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] })
      queryClient.invalidateQueries({ queryKey: ['account-balances'] })
    },
  })
}