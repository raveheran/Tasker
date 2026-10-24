import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider, MutationCache } from '@tanstack/react-query'
import { useConnectionStore } from './store'
import './index.css'
import App from './App.tsx'

const mutationCache = new MutationCache({
  onError: (error: Error) => {
    useConnectionStore.getState().addToast(
      `Save failed: ${error.message}`,
      'error',
    );
  },
});

const queryClient = new QueryClient({
  mutationCache,
  defaultOptions: {
    queries: {
      staleTime: 1000 * 30,
      refetchOnWindowFocus: true,
      retry: (failureCount, error) => {
        // Don't retry network errors (server unreachable)
        if (error instanceof Error && error.message.includes('Cannot reach the server')) {
          return false;
        }
        return failureCount < 2;
      },
    },
    mutations: {
      retry: false,
    },
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
)
