import './App.css'
import { Toaster } from '@/components/ui/toaster'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { pagesConfig } from './pages.config'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom'
import { SignIn, SignedIn, SignedOut, RedirectToSignIn } from '@clerk/clerk-react'
import PageNotFound from './lib/PageNotFound'
import { AuthProvider } from '@/lib/AuthContext'

const { Pages, Layout, mainPage } = pagesConfig
const mainPageKey = mainPage ?? Object.keys(Pages)[0]
const MainPage = mainPageKey ? Pages[mainPageKey] : <></>

// Pages that require a signed-in user. Everything else — the landing
// page, the public explorers, individual herb/remedy/product/event
// profiles, About, Contact — is reachable without an account.
const PRIVATE_PAGES = new Set([
  'SubmitRemedy',
  'Wishlist',
  'UserProfile',
  'SellerDashboard',
  'OrganizeEvent',
  'AdminDashboard',
])

const LayoutWrapper = ({ children, currentPageName }) =>
  Layout ? <Layout currentPageName={currentPageName}>{children}</Layout> : <>{children}</>

/** Clerk gate for a single page component — anonymous visitors are
 *  bounced through sign-in and returned to the page they were opening. */
const Private = ({ children }) => (
  <>
    <SignedIn>{children}</SignedIn>
    <SignedOut>
      <RedirectToSignIn />
    </SignedOut>
  </>
)

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
          {/* Public + private routes share the same AuthProvider + Layout.
              Public pages render for everyone; private pages re-mount inside
              a Clerk gate that redirects signed-out visitors. */}
          <Route
            path="/*"
            element={
              <AuthProvider>
                <LayoutWrapper currentPageName={mainPageKey}>
                  <Routes>
                    <Route path="/" element={<MainPage />} />
                    {Object.entries(Pages).map(([pageKey, Page]) => {
                      const el = PRIVATE_PAGES.has(pageKey) ? (
                        <Private>
                          <Page />
                        </Private>
                      ) : (
                        <Page />
                      )
                      return <Route key={pageKey} path={`/${pageKey}`} element={el} />
                    })}
                    <Route path="*" element={<PageNotFound />} />
                  </Routes>
                </LayoutWrapper>
              </AuthProvider>
            }
          />
        </Routes>
      </Router>
      <Toaster />
    </QueryClientProvider>
  )
}

export default App
