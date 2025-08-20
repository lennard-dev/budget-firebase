import { create } from 'zustand'
import { devtools } from 'zustand/middleware'

interface User {
  id: string
  email: string
  name: string
}

interface AppState {
  // Auth state
  user: User | null
  isAuthenticated: boolean
  
  // UI state
  sidebarOpen: boolean
  currentPage: string
  
  // Loading states
  isLoading: boolean
  
  // Actions
  setUser: (user: User | null) => void
  setSidebarOpen: (open: boolean) => void
  setCurrentPage: (page: string) => void
  setLoading: (loading: boolean) => void
  logout: () => void
}

export const useAppStore = create<AppState>()(
  devtools(
    (set) => ({
      // Initial state
      user: {
        id: '1',
        email: 'lennard.everwien@europecares.org',
        name: 'Lennard Everwien'
      },
      isAuthenticated: true, // Mock authentication
      sidebarOpen: true,
      currentPage: 'dashboard',
      isLoading: false,
      
      // Actions
      setUser: (user) => set({ user, isAuthenticated: !!user }),
      setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
      setCurrentPage: (currentPage) => set({ currentPage }),
      setLoading: (isLoading) => set({ isLoading }),
      logout: () => set({ 
        user: null, 
        isAuthenticated: false, 
        currentPage: 'login' 
      }),
    }),
    {
      name: 'app-store'
    }
  )
)