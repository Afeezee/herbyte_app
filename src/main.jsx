import ReactDOM from 'react-dom/client'
import { ClerkProvider } from '@clerk/clerk-react'
import App from '@/App.jsx'
import '@/index.css'

const publishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY

if (!publishableKey) {
  // Loud in dev, doesn't crash render — you'll see a Clerk sign-in error
  // instead of a blank page.
  console.error(
    '[herbyte] VITE_CLERK_PUBLISHABLE_KEY is not set. Copy .env.example to .env and fill it in.',
  )
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <ClerkProvider
    publishableKey={publishableKey ?? ''}
    signInUrl="/sign-in"
    afterSignInUrl="/"
    afterSignOutUrl="/sign-in"
  >
    <App />
  </ClerkProvider>,
)
