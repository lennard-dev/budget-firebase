import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import type { RootState } from '../index';

const baseQuery = fetchBaseQuery({
  baseUrl: import.meta.env.PROD ? '/api' : 'http://localhost:5000/api',
  prepareHeaders: (headers, { getState }) => {
    const token = (getState() as RootState).auth.token;
    if (token) {
      headers.set('authorization', `Bearer ${token}`);
    }
    return headers;
  },
  credentials: 'include',
});

export const apiSlice = createApi({
  reducerPath: 'api',
  baseQuery,
  tagTypes: ['Transaction', 'Category', 'Balance', 'Ledger', 'Budget', 'User'],
  endpoints: (builder) => ({
    // Transactions
    getTransactions: builder.query({
      query: (params) => ({
        url: '/transactions',
        params,
      }),
      providesTags: ['Transaction', 'Balance'],
    }),
    getTransaction: builder.query({
      query: (id) => `/transactions/${id}`,
      providesTags: (_result, _error, id) => [{ type: 'Transaction', id }],
    }),
    createTransaction: builder.mutation({
      query: (data) => ({
        url: '/transactions',
        method: 'POST',
        body: data,
      }),
      invalidatesTags: ['Transaction', 'Balance', 'Ledger'],
    }),
    updateTransaction: builder.mutation({
      query: ({ id, ...data }) => ({
        url: `/transactions/${id}`,
        method: 'PUT',
        body: data,
      }),
      invalidatesTags: (_result, _error, { id }) => [
        { type: 'Transaction', id },
        'Balance',
        'Ledger',
      ],
    }),
    deleteTransaction: builder.mutation({
      query: (id) => ({
        url: `/transactions/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['Transaction', 'Balance', 'Ledger'],
    }),

    // Categories
    getCategories: builder.query({
      query: () => '/categories',
      providesTags: ['Category'],
    }),
    createCategory: builder.mutation({
      query: (data) => ({
        url: '/categories',
        method: 'POST',
        body: data,
      }),
      invalidatesTags: ['Category'],
    }),
    updateCategory: builder.mutation({
      query: ({ id, ...data }) => ({
        url: `/categories/${id}`,
        method: 'PUT',
        body: data,
      }),
      invalidatesTags: ['Category'],
    }),
    deleteCategory: builder.mutation({
      query: (id) => ({
        url: `/categories/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['Category'],
    }),

    // Balances
    getBalances: builder.query({
      query: () => '/balances',
      providesTags: ['Balance'],
    }),

    // Ledger
    getCashLedger: builder.query({
      query: (params) => ({
        url: '/ledger/cash',
        params,
      }),
      providesTags: ['Ledger'],
    }),
    getBankLedger: builder.query({
      query: (params) => ({
        url: '/ledger/bank',
        params,
      }),
      providesTags: ['Ledger'],
    }),

    // Budget
    getBudget: builder.query({
      query: () => '/budget',
      providesTags: ['Budget'],
    }),
    updateBudget: builder.mutation({
      query: ({ categoryId, ...data }) => ({
        url: `/budget/${categoryId}`,
        method: 'PUT',
        body: data,
      }),
      invalidatesTags: ['Budget'],
    }),

    // Expected Income
    getExpectedIncome: builder.query({
      query: () => '/expected-income',
      providesTags: ['Transaction'],
    }),
    createExpectedIncome: builder.mutation({
      query: (data) => ({
        url: '/expected-income',
        method: 'POST',
        body: data,
      }),
      invalidatesTags: ['Transaction'],
    }),
    markIncomeReceived: builder.mutation({
      query: (id) => ({
        url: `/expected-income/${id}/received`,
        method: 'PUT',
      }),
      invalidatesTags: ['Transaction', 'Balance', 'Ledger'],
    }),
  }),
});

// Export hooks for usage in components
export const {
  useGetTransactionsQuery,
  useGetTransactionQuery,
  useCreateTransactionMutation,
  useUpdateTransactionMutation,
  useDeleteTransactionMutation,
  useGetCategoriesQuery,
  useCreateCategoryMutation,
  useUpdateCategoryMutation,
  useDeleteCategoryMutation,
  useGetBalancesQuery,
  useGetCashLedgerQuery,
  useGetBankLedgerQuery,
  useGetBudgetQuery,
  useUpdateBudgetMutation,
  useGetExpectedIncomeQuery,
  useCreateExpectedIncomeMutation,
  useMarkIncomeReceivedMutation,
} = apiSlice;