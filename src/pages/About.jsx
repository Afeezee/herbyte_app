import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Shield, Users, BookOpen, Sparkles, Target, Heart, Beaker, Leaf, ShoppingBag } from "lucide-react";
import { usePageMeta } from "@/lib/usePageMeta";

export default function About() {
  usePageMeta({ title: "About" });
  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="bg-gradient-to-br from-[#2D5016] to-[#4A7C2E] text-white py-20">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-6">About Herbyte</h1>
          <p className="text-xl text-white/90 leading-relaxed">
            The world's most comprehensive herbal medicine platform—combining education, community wisdom, and a trusted marketplace to preserve traditional knowledge and promote safe natural healing.
          </p>
        </div>
      </section>

      {/* Mission Statement */}
      <section className="py-16 bg-white">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <div className="w-16 h-16 bg-[#4A7C2E]/10 rounded-full flex items-center justify-center mb-6">
                <Target className="w-8 h-8 text-[#2D5016]" />
              </div>
              <h2 className="text-3xl font-bold text-[#2D5016] mb-4">Our Mission</h2>
              <p className="text-gray-700 leading-relaxed mb-4">
                Herbyte was created to bridge the gap between traditional herbal wisdom and modern scientific validation. We believe that indigenous knowledge and evidence-based research can coexist to provide safe, effective natural healing solutions for everyone.
              </p>
              <p className="text-gray-700 leading-relaxed">
                Our platform uniquely combines three essential elements: a comprehensive herb database for learning about medicinal plants, a validated remedy repository for discovering formulations, and a trusted marketplace connecting practitioners with those seeking quality herbal products.
              </p>
            </div>
            <div>
              <img 
                src="https://images.unsplash.com/photo-1505751172876-fa1923c5c528?w=600&h=400&fit=crop" 
                alt="Herbal medicine research"
                className="rounded-xl shadow-xl"
              />
            </div>
          </div>
        </div>
      </section>

      {/* What Makes Us Different */}
      <section className="py-16 bg-gradient-to-br from-[#F5F1E8] to-[#FFFEF9]">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-[#2D5016] mb-4">What Makes Herbyte Unique</h2>
            <p className="text-gray-600 text-lg">The only platform combining three essential herbal medicine resources</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <Card className="hover:shadow-xl transition-shadow bg-white">
              <CardContent className="p-8">
                <div className="w-14 h-14 bg-[#4A7C2E]/10 rounded-full flex items-center justify-center mb-6">
                  <Leaf className="w-7 h-7 text-[#2D5016]" />
                </div>
                <h3 className="text-xl font-bold text-[#2D5016] mb-3">Herb Database</h3>
                <p className="text-gray-700 leading-relaxed">
                  Learn about individual medicinal plants—their properties, active compounds, traditional uses, and modern research. Each herb profile is thoroughly documented and scientifically validated.
                </p>
              </CardContent>
            </Card>

            <Card className="hover:shadow-xl transition-shadow bg-white">
              <CardContent className="p-8">
                <div className="w-14 h-14 bg-[#4A7C2E]/10 rounded-full flex items-center justify-center mb-6">
                  <Beaker className="w-7 h-7 text-[#2D5016]" />
                </div>
                <h3 className="text-xl font-bold text-[#2D5016] mb-3">Remedy Repository</h3>
                <p className="text-gray-700 leading-relaxed">
                  Discover herbal formulations and remedy recipes from traditional healers worldwide. Each remedy includes detailed preparation methods, dosage guidance, and AI-verified safety information.
                </p>
              </CardContent>
            </Card>

            <Card className="hover:shadow-xl transition-shadow bg-white">
              <CardContent className="p-8">
                <div className="w-14 h-14 bg-[#4A7C2E]/10 rounded-full flex items-center justify-center mb-6">
                  <ShoppingBag className="w-7 h-7 text-[#2D5016]" />
                </div>
                <h3 className="text-xl font-bold text-[#2D5016] mb-3">Trusted Marketplace</h3>
                <p className="text-gray-700 leading-relaxed">
                  Connect with verified practitioners and purchase quality herbal products. Every seller is vetted, and products are linked to remedy formulations for complete transparency.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Core Values */}
      <section className="py-16 bg-white">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-[#2D5016] mb-4">Our Core Values</h2>
            <p className="text-gray-600 text-lg">The principles that guide everything we do</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <Card className="hover:shadow-xl transition-shadow">
              <CardContent className="p-8">
                <div className="w-14 h-14 bg-[#4A7C2E]/10 rounded-full flex items-center justify-center mb-6">
                  <Shield className="w-7 h-7 text-[#2D5016]" />
                </div>
                <h3 className="text-xl font-bold text-[#2D5016] mb-3">Safety First</h3>
                <p className="text-gray-700 leading-relaxed">
                  Every herb, remedy, and product undergoes rigorous AI safety checks and expert review to identify potential risks, interactions, and contraindications.
                </p>
              </CardContent>
            </Card>

            <Card className="hover:shadow-xl transition-shadow">
              <CardContent className="p-8">
                <div className="w-14 h-14 bg-[#4A7C2E]/10 rounded-full flex items-center justify-center mb-6">
                  <BookOpen className="w-7 h-7 text-[#2D5016]" />
                </div>
                <h3 className="text-xl font-bold text-[#2D5016] mb-3">Evidence-Based</h3>
                <p className="text-gray-700 leading-relaxed">
                  All information is backed by peer-reviewed research, clinical trials, and reputable phytotherapy sources from trusted medical databases.
                </p>
              </CardContent>
            </Card>

            <Card className="hover:shadow-xl transition-shadow">
              <CardContent className="p-8">
                <div className="w-14 h-14 bg-[#4A7C2E]/10 rounded-full flex items-center justify-center mb-6">
                  <Heart className="w-7 h-7 text-[#2D5016]" />
                </div>
                <h3 className="text-xl font-bold text-[#2D5016] mb-3">Cultural Respect</h3>
                <p className="text-gray-700 leading-relaxed">
                  We honor and preserve indigenous knowledge systems while ensuring traditional remedies meet modern safety and efficacy standards.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Understanding Our Structure */}
      <section className="py-16 bg-gradient-to-br from-[#F5F1E8] to-[#FFFEF9]">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-[#2D5016] mb-4">Understanding Herbs vs. Remedies</h2>
            <p className="text-gray-600 text-lg max-w-3xl mx-auto">
              We distinguish between individual medicinal plants and herbal formulations for clarity and better education
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            <Card className="bg-white">
              <CardContent className="p-8">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                    <Leaf className="w-6 h-6 text-green-700" />
                  </div>
                  <h3 className="text-2xl font-bold text-[#2D5016]">Herbs</h3>
                </div>
                <p className="text-gray-700 leading-relaxed mb-4">
                  <strong>Individual medicinal plants</strong> with documented properties and uses. Examples: Turmeric, Ginger, Chamomile, Echinacea.
                </p>
                <ul className="space-y-2 text-gray-700">
                  <li className="flex items-start gap-2">
                    <span className="text-green-600 mt-1">✓</span>
                    <span>Botanical information & identification</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-600 mt-1">✓</span>
                    <span>Active chemical compounds</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-600 mt-1">✓</span>
                    <span>Health benefits & research</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-600 mt-1">✓</span>
                    <span>Safety information & contraindications</span>
                  </li>
                </ul>
              </CardContent>
            </Card>

            <Card className="bg-white">
              <CardContent className="p-8">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                    <Beaker className="w-6 h-6 text-blue-700" />
                  </div>
                  <h3 className="text-2xl font-bold text-[#2D5016]">Remedies</h3>
                </div>
                <p className="text-gray-700 leading-relaxed mb-4">
                  <strong>Herbal formulations</strong> combining one or more herbs for specific health conditions. Examples: Triphala, Golden Milk, Sleepy Time Tea.
                </p>
                <ul className="space-y-2 text-gray-700">
                  <li className="flex items-start gap-2">
                    <span className="text-blue-600 mt-1">✓</span>
                    <span>Complete preparation recipes</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-600 mt-1">✓</span>
                    <span>Specific dosage guidance</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-600 mt-1">✓</span>
                    <span>Targeted health conditions</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-600 mt-1">✓</span>
                    <span>Traditional usage & modern validation</span>
                  </li>
                </ul>
              </CardContent>
            </Card>
          </div>

          <div className="mt-8 p-6 bg-white rounded-xl border-2 border-[#4A7C2E]/20">
            <p className="text-gray-700 text-center leading-relaxed">
              <strong>Example:</strong> <span className="text-[#4A7C2E]">Turmeric</span> is an <strong>herb</strong> (individual plant), while <span className="text-[#4A7C2E]">Golden Milk</span> is a <strong>remedy</strong> (formulation combining turmeric, black pepper, milk, and honey for anti-inflammatory benefits).
            </p>
          </div>
        </div>
      </section>

      {/* Scientific Validation */}
      <section className="py-16 bg-white">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div className="order-2 md:order-1">
              <img 
                src="https://images.unsplash.com/photo-1532187863486-abf9dbad1b69?w=600&h=400&fit=crop" 
                alt="Scientific research"
                className="rounded-xl shadow-xl"
              />
            </div>
            <div className="order-1 md:order-2">
              <div className="w-16 h-16 bg-[#4A7C2E]/10 rounded-full flex items-center justify-center mb-6">
                <Sparkles className="w-8 h-8 text-[#2D5016]" />
              </div>
              <h2 className="text-3xl font-bold text-[#2D5016] mb-4">AI-Powered Validation</h2>
              <p className="text-gray-700 leading-relaxed mb-4">
                Our advanced AI systems analyze every submission for scientific credibility, safety concerns, and potential drug interactions. This technology helps us:
              </p>
              <ul className="space-y-3 text-gray-700">
                <li className="flex items-start gap-2">
                  <span className="text-[#4A7C2E] mt-1">✓</span>
                  <span>Identify potentially harmful herb combinations</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[#4A7C2E] mt-1">✓</span>
                  <span>Verify claims against peer-reviewed research</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[#4A7C2E] mt-1">✓</span>
                  <span>Enrich remedy data with scientific references</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[#4A7C2E] mt-1">✓</span>
                  <span>Flag submissions requiring expert review</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[#4A7C2E] mt-1">✓</span>
                  <span>Provide personalized safety guidance to users</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Expert Partnerships */}
      <section className="py-16 bg-gradient-to-br from-[#F5F1E8] to-[#FFFEF9]">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-12">
            <div className="w-16 h-16 bg-[#4A7C2E]/10 rounded-full flex items-center justify-center mx-auto mb-6">
              <Users className="w-8 h-8 text-[#2D5016]" />
            </div>
            <h2 className="text-3xl font-bold text-[#2D5016] mb-4">Expert Partnerships</h2>
            <p className="text-gray-600 text-lg max-w-2xl mx-auto">
              We collaborate with leading herbalists, naturopathic doctors, pharmacologists, and indigenous medicine practitioners to ensure our information is accurate and culturally sensitive.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            <Card>
              <CardContent className="p-6">
                <h3 className="font-semibold text-lg text-[#2D5016] mb-2">Medical Professionals</h3>
                <p className="text-gray-600">
                  Board-certified naturopathic doctors and clinical herbalists review flagged submissions and validate safety information.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <h3 className="font-semibold text-lg text-[#2D5016] mb-2">Research Institutions</h3>
                <p className="text-gray-600">
                  We partner with universities and research centers to access the latest phytotherapy studies and clinical trials.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <h3 className="font-semibold text-lg text-[#2D5016] mb-2">Indigenous Communities</h3>
                <p className="text-gray-600">
                  Traditional medicine practitioners help us preserve and respect indigenous knowledge systems and remedy formulations.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <h3 className="font-semibold text-lg text-[#2D5016] mb-2">Pharmacology Experts</h3>
                <p className="text-gray-600">
                  Pharmacologists verify drug interaction data and ensure accurate safety warnings for both herbs and remedies.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Call to Action */}
      <section className="py-16 bg-gradient-to-br from-[#2D5016] to-[#4A7C2E] text-white">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className="text-3xl font-bold mb-4">Join Us in Our Mission</h2>
          <p className="text-xl text-white/90 mb-8">
            Whether you're a healthcare professional, traditional healer, herbal seller, or someone passionate about natural healing—we invite you to be part of this growing community.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a href="/submitremedy">
              <button className="px-8 py-3 bg-white text-[#2D5016] rounded-lg font-semibold hover:bg-white/90 transition-colors">
                Share Your Knowledge
              </button>
            </a>
            <a href="/sellerdashboard">
              <button className="px-8 py-3 border-2 border-white text-white rounded-lg font-semibold hover:bg-white/10 transition-colors">
                Become a Seller
              </button>
            </a>
            <a href="/contact">
              <button className="px-8 py-3 border-2 border-white text-white rounded-lg font-semibold hover:bg-white/10 transition-colors">
                Get in Touch
              </button>
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}