import React, { useState, useEffect } from "react";
import { api } from "@/api/client";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Filter, Sparkles, X } from "lucide-react";
import RemedyCard from "../components/remedies/RemedyCard";
import AISearchSuggestions from "../components/herbs/AISearchSuggestions";
import { usePageMeta } from "@/lib/usePageMeta";

const CATEGORIES = ["All", "Adaptogen", "Anti-inflammatory", "Digestive", "Immune Support", "Cardiovascular", "Respiratory", "Nervous System", "Antimicrobial", "Pain Relief", "Skin Health", "Other"];
const REGIONS = ["All", "Africa", "Asia", "Europe", "North America", "South America", "Australia", "Middle East", "Global"];

export default function ExploreRemedies() {
  usePageMeta({ title: "Explore Remedies" });
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [selectedRegion, setSelectedRegion] = useState("All");
  const [selectedCondition, setSelectedCondition] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);

  const { data: remedies, isLoading } = useQuery({
    queryKey: ['remedies'],
    queryFn: () => api.entities.Remedy.filter({ approved_by_ai: true }, '-created_date'),
    initialData: [],
  });

  const filteredRemedies = remedies.filter(remedy => {
    const matchesSearch = !searchQuery || 
      remedy.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      remedy.primary_herb_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      remedy.health_condition?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      remedy.description?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesCategory = selectedCategory === "All" || remedy.category === selectedCategory;
    const matchesRegion = selectedRegion === "All" || remedy.region === selectedRegion;
    
    const matchesCondition = !selectedCondition || 
      remedy.health_condition?.toLowerCase().includes(selectedCondition.toLowerCase()) ||
      remedy.conditions_treated?.some(condition => 
        condition.toLowerCase().includes(selectedCondition.toLowerCase())
      );

    return matchesSearch && matchesCategory && matchesRegion && matchesCondition;
  });

  const handleAISearch = async () => {
    if (!searchQuery) return;
    
    setLoadingSuggestions(true);
    try {
      const result = await api.ai.searchSuggestions({ kind: "remedy", query: searchQuery });
      setAiSuggestions(result.suggestions || []);
    } catch (error) {
      console.error("AI search error:", error);
    }
    setLoadingSuggestions(false);
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery.length > 2) {
        handleAISearch();
      } else {
        setAiSuggestions([]);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  return (
    <div className="min-h-screen">
      {/* Header Section */}
      <section className="bg-gradient-to-br from-[#2D5016] to-[#4A7C2E] text-white py-12 md:py-16">
        <div className="max-w-7xl mx-auto px-6">
          <h1 className="text-3xl md:text-5xl font-bold mb-4">Explore Herbal Remedies</h1>
          <p className="text-white/90 text-lg">Find natural solutions for your health needs</p>
        </div>
      </section>

      {/* Search & Filter Section */}
      <section className="bg-white border-b sticky top-0 z-40 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <Input
                type="text"
                placeholder="Search by remedy name, condition, symptom, or herb..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-10 h-12 text-base"
              />
              {searchQuery && (
                <button
                  onClick={() => {
                    setSearchQuery("");
                    setAiSuggestions([]);
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
              
              {loadingSuggestions && (
                <div className="absolute left-3 top-full mt-2 text-sm text-gray-500 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 animate-pulse" />
                  AI suggestions loading...
                </div>
              )}
            </div>

            <Button
              variant="outline"
              onClick={() => setShowFilters(!showFilters)}
              className="md:w-auto border-[#2D5016] text-[#2D5016] hover:bg-[#F5F1E8]"
            >
              <Filter className="w-4 h-4 mr-2" />
              {showFilters ? "Hide Filters" : "Show Filters"}
            </Button>
          </div>

          {/* AI Suggestions */}
          {aiSuggestions.length > 0 && (
            <AISearchSuggestions 
              suggestions={aiSuggestions} 
              onSelect={(suggestion) => setSearchQuery(suggestion)}
            />
          )}

          {/* Filter Options */}
          {showFilters && (
            <div className="grid md:grid-cols-3 gap-4 mt-6 p-6 bg-gray-50 rounded-lg">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
                <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(category => (
                      <SelectItem key={category} value={category}>{category}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Region</label>
                <Select value={selectedRegion} onValueChange={setSelectedRegion}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {REGIONS.map(region => (
                      <SelectItem key={region} value={region}>{region}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Health Condition</label>
                <Input
                  type="text"
                  placeholder="e.g., anxiety, inflammation..."
                  value={selectedCondition}
                  onChange={(e) => setSelectedCondition(e.target.value)}
                />
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Results Section */}
      <section className="py-12">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex justify-between items-center mb-6">
            <p className="text-gray-600">
              {isLoading ? "Loading..." : `${filteredRemedies.length} remedies found`}
            </p>
            
            {(searchQuery || selectedCategory !== "All" || selectedRegion !== "All" || selectedCondition) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearchQuery("");
                  setSelectedCategory("All");
                  setSelectedRegion("All");
                  setSelectedCondition("");
                  setAiSuggestions([]);
                }}
                className="text-[#2D5016]"
              >
                <X className="w-4 h-4 mr-2" />
                Clear Filters
              </Button>
            )}
          </div>

          {isLoading ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3, 4, 5, 6].map(i => (
                <div key={i} className="bg-gray-100 rounded-xl h-96 animate-pulse"></div>
              ))}
            </div>
          ) : filteredRemedies.length > 0 ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredRemedies.map(remedy => (
                <RemedyCard key={remedy.id} remedy={remedy} />
              ))}
            </div>
          ) : (
            <div className="text-center py-20 bg-gray-50 rounded-xl">
              <Search className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 mb-2">No remedies found</h3>
              <p className="text-gray-600 mb-6">Try adjusting your filters or search query</p>
              <Button
                onClick={() => {
                  setSearchQuery("");
                  setSelectedCategory("All");
                  setSelectedRegion("All");
                  setSelectedCondition("");
                }}
                variant="outline"
              >
                Clear All Filters
              </Button>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}