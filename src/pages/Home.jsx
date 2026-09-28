import React from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/api/client";
import { Button } from "@/components/ui/button";
import { ArrowRight, Shield, Users, Sparkles, Search, BookOpen, CheckCircle, Beaker, Leaf, ShoppingBag, Store } from "lucide-react";
import RemedyCard from "../components/remedies/RemedyCard";
import TestimonialCard from "../components/home/TestimonialCard";

export default function Home() {
  const { data: featuredRemedies, isLoading } = useQuery({
    queryKey: ['featured-remedies'],
    queryFn: () => api.entities.Remedy.filter({ featured: true, approved_by_ai: true }, '-created_date', 6),
    initialData: []
  });

  return (
    <div>
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-[#2D5016] to-[#4A7C2E] text-white">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1515377905703-c4788e51af15?w=1600')] bg-cover bg-center"></div>
        </div>
        
        <div className="relative max-w-7xl mx-auto px-6 py-20 md:py-32">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm px-4 py-2 rounded-full mb-6">
                <Sparkles className="w-4 h-4" />
                <span className="text-sm font-medium">AI-Validated Herbal Knowledge</span>
              </div>
              
              <h1 className="text-4xl md:text-6xl font-bold leading-tight mb-6">
                Your Complete Herbal Medicine Resource
              </h1>
              
              <p className="text-lg md:text-xl text-white/90 mb-8 leading-relaxed">
                Discover evidence-based herbal remedies, learn about medicinal plants, and shop quality products—all in one trusted platform backed by AI safety validation and scientific research.
              </p>
              
              <div className="flex flex-col sm:flex-row gap-4">
                <Link to={createPageUrl("ExploreRemedies")}>
                  <Button size="lg" className="bg-white text-[#2D5016] hover:bg-white/90 w-full sm:w-auto">
                    <Beaker className="w-5 h-5 mr-2" />
                    Find Remedies
                  </Button>
                </Link>
                <Link to={createPageUrl("ExploreHerbs")}>
                  <Button size="lg" variant="outline" className="bg-background text-[#2D5016] px-8 text-sm font-medium rounded-md inline-flex items-center justify-center gap-2 whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 border shadow-sm hover:text-accent-foreground h-10 border-white hover:bg-white/10 w-full sm:w-auto">
                    <Leaf className="w-5 h-5 mr-2" />
                    Learn About Herbs
                  </Button>
                </Link>
                <Link to={createPageUrl("SellerDashboard")}>
                  <Button size="lg" variant="outline" className="bg-background text-[#2D5016] px-8 text-sm font-medium rounded-md inline-flex items-center justify-center gap-2 whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 border shadow-sm hover:text-accent-foreground h-10 border-white hover:bg-white/10 w-full sm:w-auto">
                    <Store className="w-5 h-5 mr-2" />
                    Become a Seller
                  </Button>
                </Link>
              </div>
            </div>

            <div className="hidden md:block">
              <div className="relative">
                <img
                  src="https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=600&h=600&fit=crop"
                  alt="Herbal medicine"
                  className="rounded-2xl shadow-2xl" />

                <div className="absolute -bottom-6 -left-6 bg-white p-6 rounded-xl shadow-xl">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-[#4A7C2E]/10 rounded-full flex items-center justify-center">
                      <Shield className="w-6 h-6 text-[#2D5016]" />
                    </div>
                    <div>
                      <p className="font-semibold text-[#2D5016]">100% Verified</p>
                      <p className="text-sm text-gray-600">AI Safety Checked</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* What We Offer Section */}
      <section className="py-16 md:py-24 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-[#2D5016] mb-4">
              Everything You Need for Herbal Wellness
            </h2>
            <p className="text-gray-600 text-lg max-w-3xl mx-auto">
              Herbyte is your comprehensive platform for herbal medicine—combining education, community wisdom, and a trusted marketplace
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <Link to={createPageUrl("ExploreRemedies")} className="group">
              <div className="bg-gradient-to-br from-[#4A7C2E]/5 to-[#2D5016]/5 rounded-xl p-8 hover:shadow-xl transition-all duration-300 h-full border-2 border-transparent group-hover:border-[#4A7C2E]/20">
                <div className="w-14 h-14 bg-[#4A7C2E]/10 rounded-full flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                  <Beaker className="w-7 h-7 text-[#2D5016]" />
                </div>
                <h3 className="text-xl font-semibold text-[#2D5016] mb-3">
                  Find Herbal Remedies
                </h3>
                <p className="text-gray-600 leading-relaxed mb-4">
                  Browse hundreds of traditional and modern herbal remedy formulations. Each recipe includes preparation methods, dosage guidance, and safety information validated by AI.
                </p>
                <div className="flex items-center text-[#4A7C2E] font-medium">
                  <span className="text-sm">Explore Remedies</span>
                  <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            </Link>

            <Link to={createPageUrl("ExploreHerbs")} className="group">
              <div className="bg-gradient-to-br from-[#4A7C2E]/5 to-[#2D5016]/5 rounded-xl p-8 hover:shadow-xl transition-all duration-300 h-full border-2 border-transparent group-hover:border-[#4A7C2E]/20">
                <div className="w-14 h-14 bg-[#4A7C2E]/10 rounded-full flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                  <Leaf className="w-7 h-7 text-[#2D5016]" />
                </div>
                <h3 className="text-xl font-semibold text-[#2D5016] mb-3">
                  Learn About Herbs
                </h3>
                <p className="text-gray-600 leading-relaxed mb-4">
                  Learn about individual medicinal plants from around the world. Discover their properties, health benefits, active compounds, and traditional uses backed by research.
                </p>
                <div className="flex items-center text-[#4A7C2E] font-medium">
                  <span className="text-sm">Browse Herbs</span>
                  <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            </Link>

            <Link to={createPageUrl("SellerDashboard")} className="group">
              <div className="bg-gradient-to-br from-[#4A7C2E]/5 to-[#2D5016]/5 rounded-xl p-8 hover:shadow-xl transition-all duration-300 h-full border-2 border-transparent group-hover:border-[#4A7C2E]/20">
                <div className="w-14 h-14 bg-[#4A7C2E]/10 rounded-full flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                  <Store className="w-7 h-7 text-[#2D5016]" />
                </div>
                <h3 className="text-xl font-semibold text-[#2D5016] mb-3">
                  Become a Seller
                </h3>
                <p className="text-gray-600 leading-relaxed mb-4">
                  Are you a herbal practitioner? Join our community and share your products with people seeking natural remedies. Get verified and start selling today.
                </p>
                <div className="flex items-center text-[#4A7C2E] font-medium">
                  <span className="text-sm">Setup Your Store</span>
                  <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            </Link>
          </div>
        </div>
      </section>

      {/* Mission Statement */}
      <section className="py-16 md:py-24 bg-gradient-to-br from-[#F5F1E8] to-[#FFFEF9]">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-[#2D5016] mb-6">
              Bridging Traditional Wisdom with Modern Science
            </h2>
            <p className="text-lg text-gray-700 leading-relaxed max-w-4xl mx-auto">
              Herbyte preserves indigenous herbal knowledge while ensuring every remedy and herb profile meets rigorous safety standards through AI-powered validation and expert review. We're building the world's most comprehensive, trustworthy herbal medicine resource.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            <div className="bg-white rounded-xl p-6 shadow-md text-center">
              <div className="text-3xl font-bold text-[#2D5016] mb-2">1000+</div>
              <p className="text-gray-600">Verified Remedies</p>
            </div>
            <div className="bg-white rounded-xl p-6 shadow-md text-center">
              <div className="text-3xl font-bold text-[#2D5016] mb-2">500+</div>
              <p className="text-gray-600">Medicinal Herbs</p>
            </div>
            <div className="bg-white rounded-xl p-6 shadow-md text-center">
              <div className="text-3xl font-bold text-[#2D5016] mb-2">100%</div>
              <p className="text-gray-600">AI Safety Verified</p>
            </div>
          </div>
        </div>
      </section>

      {/* Why Choose Herbyte */}
      <section className="py-16 md:py-24 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-[#2D5016] mb-4">
              Why Trust Herbyte?
            </h2>
            <p className="text-gray-600 text-lg">The only platform combining herbal education with verified marketplace</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-white rounded-xl p-8 shadow-md hover:shadow-xl transition-all duration-300">
              <div className="w-14 h-14 bg-[#4A7C2E]/10 rounded-full flex items-center justify-center mb-6">
                <Shield className="w-7 h-7 text-[#2D5016]" />
              </div>
              <h3 className="text-xl font-semibold text-[#2D5016] mb-3">
                AI Safety Verification
              </h3>
              <p className="text-gray-600 leading-relaxed">
                Every remedy submission is analyzed by advanced AI to identify potential risks, drug interactions, contraindications, and scientific validity before publication.
              </p>
            </div>

            <div className="bg-white rounded-xl p-8 shadow-md hover:shadow-xl transition-all duration-300">
              <div className="w-14 h-14 bg-[#4A7C2E]/10 rounded-full flex items-center justify-center mb-6">
                <BookOpen className="w-7 h-7 text-[#2D5016]" />
              </div>
              <h3 className="text-xl font-semibold text-[#2D5016] mb-3">
                Evidence-Based Information
              </h3>
              <p className="text-gray-600 leading-relaxed">
                All herb and remedy information is backed by peer-reviewed research, clinical trials, and reputable phytotherapy sources from trusted medical databases.
              </p>
            </div>

            <div className="bg-white rounded-xl p-8 shadow-md hover:shadow-xl transition-all duration-300">
              <div className="w-14 h-14 bg-[#4A7C2E]/10 rounded-full flex items-center justify-center mb-6">
                <Users className="w-7 h-7 text-[#2D5016]" />
              </div>
              <h3 className="text-xl font-semibold text-[#2D5016] mb-3">
                Trusted Marketplace
              </h3>
              <p className="text-gray-600 leading-relaxed">
                Connect with verified herbal practitioners and sellers. Every product listing is moderated and linked to validated remedy formulations for transparency.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Remedies */}
      <section className="py-16 md:py-24 bg-gradient-to-br from-[#F5F1E8] to-[#FFFEF9]">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex justify-between items-center mb-12">
            <div>
              <h2 className="text-3xl md:text-4xl font-bold text-[#2D5016] mb-2">
                Featured Remedies
              </h2>
              <p className="text-gray-600">Explore our most trusted and well-researched herbal formulations</p>
            </div>
            <Link to={createPageUrl("ExploreRemedies")}>
              <Button variant="outline" className="border-[#2D5016] text-[#2D5016] hover:bg-[#2D5016] hover:text-white">
                View All
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
          </div>

          {isLoading ? (
            <div className="grid md:grid-cols-3 gap-6">
              {[1, 2, 3].map((i) => (
                <div key={i} className="bg-gray-100 rounded-xl h-80 animate-pulse"></div>
              ))}
            </div>
          ) : featuredRemedies.length > 0 ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {featuredRemedies.map((remedy) => (
                <RemedyCard key={remedy.id} remedy={remedy} />
              ))}
            </div>
          ) : (
            <div className="text-center py-12 bg-white rounded-xl">
              <p className="text-gray-500">Featured remedies will appear here soon</p>
            </div>
          )}
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-16 md:py-24 bg-gradient-to-br from-[#2D5016] to-[#4A7C2E] text-white">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Trusted by Practitioners & Enthusiasts
            </h2>
            <p className="text-white/80 text-lg">Real experiences from our community members</p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            <TestimonialCard
              name="Dr. Sarah Mitchell"
              role="Naturopathic Doctor"
              content="Herbyte has become an invaluable resource in my practice. The clear distinction between individual herbs and remedy formulations, combined with AI safety features, gives me confidence in my recommendations." />

            <TestimonialCard
              name="James Chen"
              role="Traditional Medicine Practitioner"
              content="Finally, a platform that respects indigenous knowledge while ensuring scientific rigor. I can now share my traditional remedy formulations knowing they're validated and preserved for future generations." />

            <TestimonialCard
              name="Maria Rodriguez"
              role="Herbalist & Seller"
              content="The marketplace integration is brilliant. I can showcase my products directly alongside the remedies they're based on. Customers love having both educational resources and ready-made options." />
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 md:py-24 bg-white">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-[#2D5016] mb-6">
            Join the Herbal Medicine Revolution
          </h2>
          <p className="text-lg text-gray-600 mb-8 max-w-2xl mx-auto">
            Whether you're seeking natural remedies, want to learn about medicinal plants, or ready to share your expertise—Herbyte welcomes you.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to={createPageUrl("ExploreRemedies")}>
              <Button size="lg" className="bg-[#2D5016] hover:bg-[#4A7C2E] w-full sm:w-auto">
                <Beaker className="w-5 h-5 mr-2" />
                Explore Remedies
              </Button>
            </Link>
            <Link to={createPageUrl("SubmitRemedy")}>
              <Button size="lg" variant="outline" className="border-[#2D5016] text-[#2D5016] hover:bg-[#F5F1E8] w-full sm:w-auto">
                Share a Remedy
              </Button>
            </Link>
            <Link to={createPageUrl("SellerDashboard")}>
              <Button size="lg" variant="outline" className="border-[#2D5016] text-[#2D5016] hover:bg-[#F5F1E8] w-full sm:w-auto">
                Become a Seller
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}