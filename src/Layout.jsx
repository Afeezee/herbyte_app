import React from "react";
import { Link, useLocation } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Leaf, Search, BookOpen, Send, Info, Mail, Menu, MessageCircle, Beaker, Store, User, Heart, Calendar, Shield } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Alert, AlertDescription } from "@/components/ui/alert";
import AIAssistant from "./components/herbs/AIAssistant";

const navigationItems = [
  {
    title: "Home",
    url: createPageUrl("Home"),
    icon: Leaf,
  },
  {
    title: "Explore Remedies",
    url: createPageUrl("ExploreRemedies"),
    icon: Beaker,
  },
  {
    title: "Browse Herbs",
    url: createPageUrl("ExploreHerbs"),
    icon: Search,
  },
  {
    title: "Shop Products",
    url: createPageUrl("ExploreProducts"),
    icon: BookOpen,
  },
  {
    title: "Events",
    url: createPageUrl("Events"),
    icon: Calendar,
  },
  {
    title: "Become a Seller",
    url: createPageUrl("SellerDashboard"),
    icon: Store,
  },
  {
    title: "Submit Remedy",
    url: createPageUrl("SubmitRemedy"),
    icon: Send,
  },
  {
    title: "My Wishlist",
    url: createPageUrl("Wishlist"),
    icon: Heart,
  },
  {
    title: "My Profile",
    url: createPageUrl("UserProfile"),
    icon: User,
  },
  {
    title: "About Us",
    url: createPageUrl("About"),
    icon: Info,
  },
  {
    title: "Contact",
    url: createPageUrl("Contact"),
    icon: Mail,
  },
];

const adminNavItem = {
  title: "Admin Dashboard",
  url: createPageUrl("AdminDashboard"),
  icon: Shield,
};

export default function Layout({ children, currentPageName }) {
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);
  const [showAIAssistant, setShowAIAssistant] = React.useState(false);
  const [user, setUser] = React.useState(null);

  React.useEffect(() => {
    const fetchUser = async () => {
      try {
        const { api } = await import("@/api/client");
        const currentUser = await api.auth.me();
        setUser(currentUser);
      } catch {
        // Not logged in
      }
    };
    fetchUser();
  }, []);

  const allNavItems = user?.role === 'admin' 
    ? [...navigationItems, adminNavItem] 
    : navigationItems;

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#FFFEF9] to-[#F5F1E8]">
      <style>{`
        :root {
          --primary-green: #2D5016;
          --secondary-green: #4A7C2E;
          --accent-green: #6B9F4A;
          --warm-beige: #F5F1E8;
          --cream: #FFFEF9;
          --text-dark: #1F2937;
          --text-medium: #4B5563;
        }
      `}</style>

      {/* Desktop Header */}
      <header className="hidden lg:block sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-[#2D5016]/10 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between gap-4">
            <Link to={createPageUrl("Home")} className="flex items-center gap-3 group flex-shrink-0">
              <div className="w-10 h-10 bg-gradient-to-br from-[#2D5016] to-[#4A7C2E] rounded-full flex items-center justify-center shadow-md group-hover:shadow-lg transition-shadow">
                <Leaf className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-[#2D5016] tracking-tight whitespace-nowrap">Herbyte</h1>
                <p className="text-xs text-[#4A7C2E] whitespace-nowrap">Evidence-Based Herbal Medicine</p>
              </div>
            </Link>

            <nav className="flex items-center gap-4 flex-wrap justify-end">
              {allNavItems.map((item) => (
                <Link
                  key={item.title}
                  to={item.url}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all duration-200 whitespace-nowrap ${
                    location.pathname === item.url
                      ? "text-[#2D5016] bg-[#4A7C2E]/10 font-medium"
                      : "text-[#4B5563] hover:text-[#2D5016] hover:bg-[#F5F1E8]"
                  }`}
                >
                  <item.icon className="w-4 h-4 flex-shrink-0" />
                  <span className="text-sm">{item.title}</span>
                </Link>
              ))}
            </nav>
          </div>
        </div>
      </header>

      {/* Tablet Header */}
      <header className="hidden md:block lg:hidden sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-[#2D5016]/10 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <Link to={createPageUrl("Home")} className="flex items-center gap-3 group">
                <div className="w-10 h-10 bg-gradient-to-br from-[#2D5016] to-[#4A7C2E] rounded-full flex items-center justify-center shadow-md group-hover:shadow-lg transition-shadow">
                  <Leaf className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-[#2D5016] tracking-tight">Herbyte</h1>
                  <p className="text-xs text-[#4A7C2E]">Evidence-Based Herbal Medicine</p>
                </div>
              </Link>
            </div>

            <nav className="flex flex-wrap items-center gap-2">
              {allNavItems.map((item) => (
                <Link
                  key={item.title}
                  to={item.url}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all duration-200 text-sm whitespace-nowrap ${
                    location.pathname === item.url
                      ? "text-[#2D5016] bg-[#4A7C2E]/10 font-medium"
                      : "text-[#4B5563] hover:text-[#2D5016] hover:bg-[#F5F1E8]"
                  }`}
                >
                  <item.icon className="w-4 h-4" />
                  <span>{item.title}</span>
                </Link>
              ))}
            </nav>
          </div>
        </div>
      </header>

      {/* Mobile Header */}
      <header className="md:hidden sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-[#2D5016]/10 shadow-sm">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between">
            <Link to={createPageUrl("Home")} className="flex items-center gap-2">
              <div className="w-9 h-9 bg-gradient-to-br from-[#2D5016] to-[#4A7C2E] rounded-full flex items-center justify-center">
                <Leaf className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold text-[#2D5016]">Herbyte</span>
            </Link>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-lg hover:bg-[#F5F1E8] transition-colors"
            >
              <Menu className="w-6 h-6 text-[#2D5016]" />
            </button>
          </div>
        </div>
        
        {mobileMenuOpen && (
          <nav className="border-t border-[#2D5016]/10 bg-white p-4 space-y-2">
            {allNavItems.map((item) => (
              <Link
                key={item.title}
                to={item.url}
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
                  location.pathname === item.url
                    ? "text-[#2D5016] bg-[#4A7C2E]/10 font-medium"
                    : "text-[#4B5563] hover:bg-[#F5F1E8]"
                }`}
              >
                <item.icon className="w-5 h-5" />
                <span>{item.title}</span>
              </Link>
            ))}
          </nav>
        )}
      </header>

      <main className="min-h-[calc(100vh-200px)]">
        {children}
      </main>

      <button
        onClick={() => setShowAIAssistant(true)}
        className="fixed bottom-6 right-6 z-50 w-16 h-16 bg-gradient-to-br from-[#4A7C2E] to-[#2D5016] text-white rounded-full shadow-2xl hover:shadow-3xl hover:scale-110 transition-all duration-300 flex items-center justify-center group"
        aria-label="Open AI Herbal Assistant"
      >
        <MessageCircle className="w-7 h-7 group-hover:scale-110 transition-transform" />
        <span className="absolute -top-1 -right-1 w-4 h-4 bg-green-400 rounded-full animate-pulse"></span>
      </button>

      {showAIAssistant && (
        <AIAssistant onClose={() => setShowAIAssistant(false)} />
      )}

      <footer className="bg-[#2D5016] text-white mt-20">
        <div className="max-w-7xl mx-auto px-6 py-12">
          <div className="grid md:grid-cols-4 gap-8">
            <div className="md:col-span-2">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center">
                  <Leaf className="w-6 h-6 text-white" />
                </div>
                <span className="text-2xl font-bold">Herbyte</span>
              </div>
              <p className="text-white/80 leading-relaxed mb-4">
                Evidence-based herbal medicine information platform dedicated to preserving indigenous knowledge while ensuring scientific validation and safety.
              </p>
              <p className="text-xs text-white/60">
                © 2025 Herbyte. All rights reserved.
              </p>
            </div>

            <div>
              <h3 className="font-semibold mb-4">Quick Links</h3>
              <ul className="space-y-2">
                {allNavItems.map((item) => (
                  <li key={item.title}>
                    <Link
                      to={item.url}
                      className="text-white/80 hover:text-white transition-colors text-sm"
                    >
                      {item.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h3 className="font-semibold mb-4">Safety & Trust</h3>
              <ul className="space-y-2 text-sm text-white/80">
                <li>✓ Evidence-Based Information</li>
                <li>✓ AI-Powered Safety Checks</li>
                <li>✓ Expert Validation</li>
                <li>✓ Research-Backed Data</li>
              </ul>
            </div>
          </div>

          <div className="border-t border-white/10 mt-8 pt-8 text-center text-sm text-white/60">
            <p>
              Developed by{' '}
              <a 
                href="https://cereustechnologies.com" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-[#6B9F4A] hover:text-[#4A7C2E] transition-colors font-medium"
              >
                Cereus Technologies
              </a>
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}