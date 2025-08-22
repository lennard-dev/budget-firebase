import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 10, // 10 minutes - data stays fresh
      gcTime: 1000 * 60 * 30, // 30 minutes - keep in cache (formerly cacheTime)
      retry: 1,
      refetchOnWindowFocus: false,
      refetchOnMount: false, // Prevent refetch when component mounts if data is fresh
      refetchInterval: false, // No automatic refetching
    },
    mutations: {
      retry: 1,
    },
  },
})