import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from './contexts/AuthContext'
import { ThemeProvider } from './contexts/ThemeContext'
import { ToastProvider } from './contexts/ToastContext'
import Navigation from './components/ui/Navigation' // Import here
import { registerSW } from 'virtual:pwa-register'

import Footer from './components/landing/Footer'; // Make sure this is imported
import App from './App'
import './styles/globals.css'
import 'leaflet/dist/leaflet.css'

// Register service worker for PWA
const updateSW = registerSW({
  onNeedRefresh() {
    // New content available, could prompt user to refresh
    console.log('New content available, refresh to update')
  },
  onOfflineReady() {
    console.log('App ready to work offline')
  },
  onRegistered(registration) {
    console.log('Service worker registered:', registration)
  },
  onRegisterError(error) {
    console.error('Service worker registration error:', error)
  }
})

const queryClient = new QueryClient()

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ThemeProvider>
          <AuthProvider>
            <ToastProvider>
              <Navigation /> {/* Navigation now inside AuthProvider */}
              <App /> {/* App doesn't need to have Navigation */}
              <Footer /> {/* Footer added here */}
            </ToastProvider>
          </AuthProvider>
        </ThemeProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>
);