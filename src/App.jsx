import './App.css'
import { Toaster } from '@/components/ui/toaster'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { pagesConfig } from './pages.config'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom'
import { SignIn, SignedIn, SignedOut, RedirectToSignIn } from '@clerk/clerk-react'
import PageNotFound from './lib/PageNotFound'
import PublicLanding from './pages/PublicLanding'
import { AuthProvider, useAuth } from '@/lib/AuthContext'

const { Pages, Layout, mainPage } = pagesConfig
const mainPageKey = mainPage ?? Object.keys(Pages)[0]
const MainPage = mainPageKey ? Pages[mainPageKey] : <></>

const LayoutWrapper = ({ children, currentPageName }) =>
  Layout ? <Layout currentPageName={currentPageName}>{children}</Layout> : <>{children}</>

const LoadingSpinner = () => (
  <div className="fixed inset-0 flex items-center justify-center">
    <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" />
  </div>
)

const AuthenticatedApp = () => {
  const { isLoadingAuth } = useAuth()

  if (isLoadingAuth) return <LoadingSpinner />

  return (
    <LayoutWrapper currentPageName={mainPageKey}>
      <Routes>
        <Route path="/" element={<MainPage />} />
        {Object.entries(Pages).map(([path, Page]) => (
          <Route key={path} path={`/${path}`} element={<Page />} />
        ))}
        <Route path="*" element={<PageNotFound />} />
      </Routes>
    </LayoutWrapper>
  )
}

function App() {
  return (
    <QueryClientProvider client={queryClientInstance}>
      <Router>
        <Routes>
          <Route
            path="/sign-in/*"
            element={
              <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 to-lime-50 p-4">
                <SignIn routing="path" path="/sign-in" signUpUrl="/sign-up" />
              </div>
            }
          />
          <Route
            path="/sign-up/*"
            element={
              <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 to-lime-50 p-4">
                <SignIn routing="path" path="/sign-up" />
              </div>
            }
          />
          {/* Landing page — public when signed out, real Home when signed in. */}
          <Route
            path="/"
            element={
              <>
                <SignedIn>
                  <AuthProvider>
                    <AuthenticatedApp />
                  </AuthProvider>
                </SignedIn>
                <SignedOut>
                  <PublicLanding />
                </SignedOut>
              </>
            }
          />
          {/* Every other route requires sign-in. Signed-out visitors get
              bounced through Clerk and returned to what they were opening. */}
          <Route
            path="/*"
            element={
              <>
                <SignedIn>
                  <AuthProvider>
                    <AuthenticatedApp />
                  </AuthProvider>
                </SignedIn>
                <SignedOut>
                  <RedirectToSignIn />
                </SignedOut>
              </>
            }
          />
        </Routes>
      </Router>
      <Toaster />
    </QueryClientProvider>
  )
}

export default App
