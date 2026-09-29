import { Link } from 'react-router-dom'
import { SignInButton, SignUpButton } from '@clerk/clerk-react'
import { Button } from '@/components/ui/button'
import { Leaf, ShieldCheck, BookOpen, Users, Sparkles, Store } from 'lucide-react'

const features = [
  {
    icon: BookOpen,
    title: 'Curated herb reference',
    body:
      'Botanical details, evidence-graded benefits, dosage guidance, drug interactions and side effects — for each herb in the catalogue.',
  },
  {
    icon: Sparkles,
    title: 'Personalised AI insight',
    body:
      'Get an AI-assisted suitability check on any herb or remedy against your own health profile, medications and allergies.',
  },
  {
    icon: ShieldCheck,
    title: 'Safety-first community remedies',
    body:
      'Every community submission passes an AI moderation + web-search verification pass, and only a human-reviewed record is ever published.',
  },
  {
    icon: Store,
    title: 'Trusted seller marketplace',
    body:
      'Discover herbal products from vetted sellers, each linked to a specific remedy or herb in the reference.',
  },
  {
    icon: Users,
    title: 'Workshops and plant walks',
    body:
      'Browse and organise in-person and virtual events run by practising herbalists.',
  },
]

export default function PublicLanding() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50/60 via-white to-lime-50/40">
      {/* Top bar */}
      <header className="w-full border-b border-emerald-100/70 bg-white/70 backdrop-blur">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-full bg-[#2D5016] flex items-center justify-center">
              <Leaf className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold text-[#2D5016]">Herbyte</span>
          </div>
          <div className="flex items-center gap-3">
            <SignInButton mode="redirect" forceRedirectUrl="/">
              <Button variant="ghost" className="text-[#2D5016] hover:bg-emerald-100">
                Sign in
              </Button>
            </SignInButton>
            <SignUpButton mode="redirect" forceRedirectUrl="/">
              <Button className="bg-[#4A7C2E] hover:bg-[#2D5016] text-white">
                Get started
              </Button>
            </SignUpButton>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-6 pt-16 pb-20 text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white/80 px-4 py-1 text-sm text-[#2D5016] mb-6">
          <Sparkles className="w-4 h-4" />
          AI-assisted herbal medicine reference
        </div>
        <h1 className="text-4xl md:text-6xl font-bold text-[#1a3d0a] tracking-tight leading-tight">
          Learn herbs.
          <br className="hidden md:block" />
          {' '}
          <span className="text-[#4A7C2E]">Safely.</span>
        </h1>
        <p className="mt-6 text-lg md:text-xl text-gray-700 max-w-2xl mx-auto">
          A community-built reference for herbs and remedies, with evidence
          ratings, drug-interaction checks, and a marketplace of sellers you
          can trust.
        </p>
        <div className="mt-10 flex flex-col sm:flex-row gap-3 justify-center">
          <SignUpButton mode="redirect" forceRedirectUrl="/">
            <Button size="lg" className="bg-[#4A7C2E] hover:bg-[#2D5016] text-white text-lg px-8 py-6">
              Create free account
            </Button>
          </SignUpButton>
          <SignInButton mode="redirect" forceRedirectUrl="/">
            <Button size="lg" variant="outline" className="border-[#2D5016] text-[#2D5016] hover:bg-emerald-50 text-lg px-8 py-6">
              I already have an account
            </Button>
          </SignInButton>
        </div>
        <p className="mt-4 text-sm text-gray-500">
          Educational information — not a substitute for professional medical advice.
        </p>
      </section>

      {/* Features */}
      <section className="max-w-6xl mx-auto px-6 pb-24">
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map(({ icon: Icon, title, body }) => (
            <div
              key={title}
              className="p-6 rounded-2xl bg-white border border-emerald-100 shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="w-11 h-11 rounded-lg bg-emerald-100 flex items-center justify-center mb-4">
                <Icon className="w-6 h-6 text-[#2D5016]" />
              </div>
              <h3 className="text-lg font-semibold text-[#2D5016] mb-2">{title}</h3>
              <p className="text-gray-600 leading-relaxed">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-emerald-100 bg-white/60">
        <div className="max-w-6xl mx-auto px-6 py-8 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-gray-600">
          <div className="flex items-center gap-2">
            <Leaf className="w-4 h-4 text-[#4A7C2E]" />
            <span>© {new Date().getFullYear()} Herbyte</span>
          </div>
          <div className="flex items-center gap-4">
            <Link to="/sign-in" className="hover:text-[#2D5016]">Sign in</Link>
            <Link to="/sign-up" className="hover:text-[#2D5016]">Create account</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
