import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Leaf, AlertTriangle, BookOpen, 
  Heart, Shield, Pill, ArrowLeft, ShoppingBag, Sparkles, ExternalLink, Edit, Trash2, User
} from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import ProductCard from "../components/products/ProductCard";
import AIPersonalizedRemedyInsight from "../components/remedies/AIPersonalizedRemedyInsight";
import CommentSection from "../components/shared/CommentSection";
import WishlistButton from "../components/shared/WishlistButton";
import ShareButtons from "../components/shared/ShareButtons";
import EditRemedyModal from "../components/shared/EditRemedyModal";

export default function RemedyProfile() {
  const urlParams = new URLSearchParams(window.location.search);
      const remedyId = urlParams.get('id');
      const [showAIInsight, setShowAIInsight] = useState(false);
      const [showEditModal, setShowEditModal] = useState(false);
      const [user, setUser] = useState(null);
      const queryClient = useQueryClient();

  // Fetch current user
  React.useEffect(() => {
    const fetchUser = async () => {
      try {
        const currentUser = await api.auth.me();
        setUser(currentUser);
      } catch (error) {
        console.error("Error fetching user:", error);
      }
    };
    fetchUser();
  }, []);

  const { data: remedy, isLoading: remedyLoading } = useQuery({
    queryKey: ['remedy', remedyId],
    queryFn: async () => {
      const remedies = await api.entities.Remedy.filter({ id: remedyId });
      return remedies[0];
    },
    enabled: !!remedyId,
  });

  const { data: products, isLoading: productsLoading } = useQuery({
    queryKey: ['products-for-remedy', remedyId],
    queryFn: async () => {
      const allProducts = await api.entities.Product.filter({ 
        linked_remedy_id: remedyId,
        moderation_status: "Approved",
        availability: true
      });
      return allProducts;
    },
    enabled: !!remedyId,
    initialData: [],
  });

  // Query to find herbs used in this remedy
  const { data: availableHerbs, isLoading: herbsLoading } = useQuery({
    queryKey: ['herbs-for-remedy', remedy?.herbs_used],
    queryFn: async () => {
      if (!remedy?.herbs_used || remedy.herbs_used.length === 0) return [];
      
      const allHerbs = await api.entities.Herb.list();
      
      const matchedHerbs = allHerbs.filter(herb => {
        return remedy.herbs_used.some(remedyHerbName => {
          const herbCommonName = herb.common_name.toLowerCase();
          const herbBotanicalName = herb.botanical_name?.toLowerCase() || '';
          const remedyHerb = remedyHerbName.toLowerCase();
          
          return herbCommonName.includes(remedyHerb) || 
                 remedyHerb.includes(herbCommonName) ||
                 herbBotanicalName.includes(remedyHerb) ||
                 remedyHerb.includes(herbBotanicalName);
        });
      });
      
      return matchedHerbs;
    },
    enabled: !!remedy?.herbs_used && remedy.herbs_used.length > 0,
    initialData: [],
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.entities.Remedy.delete(remedyId),
    onSuccess: () => {
      alert("Remedy deleted successfully!");
      window.location.href = createPageUrl("ExploreRemedies");
    },
    onError: (error) => {
        alert(`Error deleting remedy: ${error.message}`);
    }
  });

  const handleDelete = () => {
    if (window.confirm(`Are you sure you want to delete "${remedy.name}"? This action cannot be undone.`)) {
      deleteMutation.mutate();
    }
  };

  const isAdmin = user?.role === "admin";
    const isCreator = user?.email === remedy?.created_by;
    const canEdit = isAdmin || isCreator;

  if (remedyLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Leaf className="w-12 h-12 text-[#4A7C2E] animate-pulse mx-auto mb-4" />
          <p className="text-gray-600">Loading remedy information...</p>
        </div>
      </div>
    );
  }

  if (!remedy) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Remedy not found</h2>
          <Link to={createPageUrl("ExploreRemedies")}>
            <Button>Back to Explore Remedies</Button>
          </Link>
        </div>
      </div>
    );
  }

  const getHerbForName = (herbName) => {
    if (!availableHerbs) return null;
    
    return availableHerbs.find(herb => {
      const herbCommonName = herb.common_name.toLowerCase();
      const herbBotanicalName = herb.botanical_name?.toLowerCase() || '';
      const remedyHerb = herbName.toLowerCase();
      
      return herbCommonName.includes(remedyHerb) || 
             remedyHerb.includes(herbCommonName) ||
             herbBotanicalName.includes(remedyHerb) ||
             remedyHerb.includes(herbBotanicalName);
    });
  };

  return (
    <div className="min-h-screen pb-12">
      {/* Hero Section */}
      <section className="bg-gradient-to-br from-[#2D5016] to-[#4A7C2E] text-white py-8">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex items-center justify-between">
            <Link to={createPageUrl("ExploreRemedies")} className="inline-flex items-center gap-2 text-white/80 hover:text-white mb-6">
              <ArrowLeft className="w-4 h-4" />
              Back to Explore Remedies
            </Link>

            {canEdit && (
                                <div className="flex gap-2 mb-6">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="bg-white/10 border-white/30 text-white hover:bg-white/20"
                                    onClick={() => setShowEditModal(true)}
                                  >
                                    <Edit className="w-4 h-4 mr-2" />
                                    Edit Remedy
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="bg-red-500/20 border-red-300 text-white hover:bg-red-500/30"
                                    onClick={handleDelete}
                                    disabled={deleteMutation.isPending}
                                  >
                                    <Trash2 className="w-4 h-4 mr-2" />
                                    Delete
                                  </Button>
                                </div>
                              )}
          </div>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-6 -mt-8">
        {/* Edit Permission Badge */}
                      {canEdit && (
                        <Alert className="mb-4 bg-blue-50 border-blue-200">
                          <Shield className="h-4 w-4 text-blue-600" />
                          <AlertDescription className="text-blue-900">
                            <strong>{isAdmin ? "Admin Mode" : "Creator Mode"}:</strong> You can edit or delete this remedy record.
                          </AlertDescription>
                        </Alert>
                      )}

        {/* Contributor Badge */}
        {remedy.submitted_by && (
          <Alert className="mb-4 bg-green-50 border-green-200">
            <User className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-900">
              <strong>Community Contribution:</strong> Submitted by {remedy.submitted_by}
            </AlertDescription>
          </Alert>
        )}

        {/* Main Content Card */}
        <Card className="overflow-hidden shadow-xl mb-8">
          <div className="grid md:grid-cols-3 gap-8">
            {/* Image */}
            <div className="md:col-span-1">
              <div className="relative h-64 md:h-full bg-gray-100">
                {remedy.image_url ? (
                  <img 
                    src={remedy.image_url} 
                    alt={remedy.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#4A7C2E]/20 to-[#2D5016]/20">
                    <Leaf className="w-24 h-24 text-[#2D5016]/40" />
                  </div>
                )}
              </div>
            </div>

            {/* Header Info */}
            <div className="md:col-span-2 p-6 md:p-8">
              <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
                <div className="flex-1">
                  <h1 className="text-3xl md:text-4xl font-bold text-[#2D5016] mb-2">
                    {remedy.name}
                  </h1>
                  <p className="text-xl text-gray-600 mb-4">
                    For: {remedy.health_condition}
                  </p>
                  <p className="text-sm text-gray-500">
                    Primary Herb: {remedy.primary_herb_name}
                  </p>
                  {remedy.submitted_by && (
                    <p className="text-xs text-gray-500 mt-2 flex items-center gap-1">
                      <User className="w-3 h-3" />
                      Contributed by: {remedy.submitted_by}
                    </p>
                  )}
                </div>

                <div className="flex flex-col gap-2">
                  {remedy.safety_rating === "Generally Safe" && (
                    <Badge className="bg-green-500 text-white text-sm px-3 py-1">
                      <Shield className="w-4 h-4 mr-1" />
                      Generally Safe
                    </Badge>
                  )}
                  {remedy.safety_rating === "Use with Caution" && (
                    <Badge className="bg-yellow-500 text-white text-sm px-3 py-1">
                      <AlertTriangle className="w-4 h-4 mr-1" />
                      Use with Caution
                    </Badge>
                  )}
                  {remedy.safety_rating === "High Risk - Expert Guidance Required" && (
                    <Badge className="bg-red-500 text-white text-sm px-3 py-1">
                      <AlertTriangle className="w-4 h-4 mr-1" />
                      High Risk
                    </Badge>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap gap-3 mb-6">
                {remedy.category && (
                  <Badge variant="outline" className="bg-[#4A7C2E]/10 text-[#2D5016] border-[#4A7C2E]/30 px-3 py-1">
                    {remedy.category}
                  </Badge>
                )}
                {remedy.region && (
                  <Badge variant="outline" className="px-3 py-1">
                    {remedy.region}
                  </Badge>
                )}
              </div>

              <p className="text-gray-700 leading-relaxed mb-6">
                {remedy.description}
              </p>

              <div className="flex flex-wrap gap-3">
                                    <Button 
                                      onClick={() => setShowAIInsight(true)}
                                      className="bg-[#4A7C2E] hover:bg-[#2D5016]"
                                    >
                                      <Sparkles className="w-4 h-4 mr-2" />
                                      Get Personalized AI Insight
                                    </Button>

                                    <WishlistButton
                                      entityType="Remedy"
                                      entityId={remedyId}
                                      entityName={remedy.name}
                                      entityImageUrl={remedy.image_url}
                                      entityMetadata={{
                                        health_condition: remedy.health_condition,
                                        primary_herb_name: remedy.primary_herb_name,
                                        category: remedy.category
                                      }}
                                    />

                                    <ShareButtons
                                      title={remedy.name}
                                      description={remedy.description}
                                      imageUrl={remedy.image_url}
                                      entityType="remedy"
                                    />
                                  </div>
            </div>
          </div>
        </Card>

        {/* Herbs Used in This Remedy - Now with Links */}
        {remedy.herbs_used && remedy.herbs_used.length > 0 && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-[#2D5016]">
                <Leaf className="w-5 h-5" />
                Herbs Used in This Remedy
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {remedy.herbs_used.map((herbName, index) => {
                  const matchedHerb = getHerbForName(herbName);
                  
                  if (matchedHerb) {
                    // Herb exists - show as clickable card
                    return (
                      <Link 
                        key={index} 
                        to={`${createPageUrl("HerbProfile")}?id=${matchedHerb.id}`}
                        className="group"
                      >
                        <div className="p-4 border-2 rounded-lg hover:border-[#4A7C2E] hover:shadow-md transition-all duration-200 bg-white">
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="font-semibold text-[#2D5016] group-hover:text-[#4A7C2E]">
                              {herbName}
                            </h4>
                            <ExternalLink className="w-4 h-4 text-gray-400 group-hover:text-[#4A7C2E]" />
                          </div>
                          <p className="text-sm italic text-gray-600">{matchedHerb.botanical_name}</p>
                          <p className="text-xs text-gray-500 mt-2 line-clamp-2">{matchedHerb.description}</p>
                          <div className="mt-3">
                            <span className="text-xs text-[#4A7C2E] font-medium group-hover:underline">
                              View Herb Details →
                            </span>
                          </div>
                        </div>
                      </Link>
                    );
                  } else {
                    // Herb doesn't exist - show as simple badge
                    return (
                      <div key={index} className="p-4 border rounded-lg bg-gray-50">
                        <h4 className="font-semibold text-gray-700">{herbName}</h4>
                        <p className="text-xs text-gray-500 mt-1">Herb profile not yet available</p>
                      </div>
                    );
                  }
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Detailed Information Tabs */}
        <Tabs defaultValue="preparation" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2 md:grid-cols-4 bg-white border">
            <TabsTrigger value="preparation">Preparation</TabsTrigger>
            <TabsTrigger value="benefits">Benefits</TabsTrigger>
            <TabsTrigger value="safety">Safety</TabsTrigger>
            <TabsTrigger value="research">Research</TabsTrigger>
          </TabsList>

          {/* Preparation */}
          <TabsContent value="preparation">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-[#2D5016]">
                  <Pill className="w-5 h-5" />
                  How to Prepare & Use
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="p-4 border rounded-lg">
                  <h3 className="font-medium text-[#2D5016] mb-2">Preparation Method</h3>
                  <p className="text-gray-700 whitespace-pre-line">{remedy.preparation_method}</p>
                </div>

                {remedy.dosage && (
                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <h3 className="font-semibold text-lg mb-2 flex items-center gap-2">
                      <Pill className="w-5 h-5 text-blue-600" />
                      Recommended Dosage
                    </h3>
                    <p className="text-gray-800 whitespace-pre-line">{remedy.dosage}</p>
                  </div>
                )}

                {remedy.duration_of_use && (
                  <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                    <h3 className="font-semibold mb-2">Duration of Use</h3>
                    <p className="text-gray-800">{remedy.duration_of_use}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Benefits */}
          <TabsContent value="benefits">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-[#2D5016]">
                  <Heart className="w-5 h-5" />
                  Health Benefits & Expected Effects
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {remedy.observed_effects && (
                  <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                    <h3 className="font-semibold text-lg mb-2">Expected Effects</h3>
                    <p className="text-gray-800 leading-relaxed">{remedy.observed_effects}</p>
                  </div>
                )}

                {remedy.conditions_treated && remedy.conditions_treated.length > 0 && (
                  <div>
                    <h3 className="font-semibold text-lg mb-4">Conditions Treated</h3>
                    <div className="flex flex-wrap gap-2">
                      {remedy.conditions_treated.map((condition, index) => (
                        <Badge key={index} variant="outline" className="bg-white">
                          {condition}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Safety */}
          <TabsContent value="safety">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-[#2D5016]">
                  <AlertTriangle className="w-5 h-5" />
                  Safety Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {remedy.risk_warnings && remedy.risk_warnings.length > 0 && (
                  <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
                    <h3 className="font-semibold text-lg mb-3 text-orange-900">Warnings</h3>
                    <ul className="space-y-2">
                      {remedy.risk_warnings.map((warning, index) => (
                        <li key={index} className="flex items-start gap-2">
                          <span className="text-orange-600 mt-1">⚠️</span>
                          <span className="text-gray-800">{warning}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {remedy.drug_interactions && remedy.drug_interactions.length > 0 && (
                  <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                    <h3 className="font-semibold text-lg mb-3 text-red-900">Drug Interactions</h3>
                    <ul className="space-y-2">
                      {remedy.drug_interactions.map((interaction, index) => (
                        <li key={index} className="flex items-start gap-2">
                          <span className="text-red-600 mt-1">⚠️</span>
                          <span className="text-gray-800">{interaction}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {remedy.contraindications && remedy.contraindications.length > 0 && (
                  <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                    <h3 className="font-semibold text-lg mb-3 text-red-900">Contraindications</h3>
                    <ul className="space-y-2">
                      {remedy.contraindications.map((contra, index) => (
                        <li key={index} className="flex items-start gap-2">
                          <span className="text-red-600 mt-1">⛔</span>
                          <span className="text-gray-800">{contra}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {remedy.side_effects && remedy.side_effects.length > 0 && (
                  <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <h3 className="font-semibold text-lg mb-3 text-yellow-900">Possible Side Effects</h3>
                    <ul className="space-y-2">
                      {remedy.side_effects.map((effect, index) => (
                        <li key={index} className="flex items-start gap-2">
                          <span className="text-yellow-600 mt-1">⚡</span>
                          <span className="text-gray-800">{effect}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Research */}
          <TabsContent value="research">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-[#2D5016]">
                  <BookOpen className="w-5 h-5" />
                  Research References
                </CardTitle>
              </CardHeader>
              <CardContent>
                {remedy.research_references && remedy.research_references.length > 0 ? (
                  <div className="space-y-4">
                    {remedy.research_references.map((ref, index) => (
                      <div key={index} className="p-4 border rounded-lg hover:bg-gray-50 transition-colors">
                        <h4 className="font-medium text-gray-900 mb-2">{ref.title}</h4>
                        <p className="text-sm text-gray-600 mb-2">{ref.source}</p>
                        {ref.url && (
                          <a 
                            href={ref.url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-[#4A7C2E] hover:underline text-sm"
                          >
                            View Research →
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500">No research references available</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Available Products Section */}
        {products && products.length > 0 && (
          <Card className="mt-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-[#2D5016]">
                <ShoppingBag className="w-5 h-5" />
                Available Products for This Remedy
              </CardTitle>
              <p className="text-sm text-gray-600 mt-2">
                Don't want to make it yourself? These sellers offer ready-made products for this remedy.
              </p>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {products.map(product => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Comment Section - NEW */}
        <CommentSection 
          entityType="Remedy"
          entityId={remedyId}
          entityName={remedy.name}
        />
      </div>

      {/* AI Personalized Insight Modal */}
                  {showAIInsight && (
                    <AIPersonalizedRemedyInsight 
                      remedy={remedy} 
                      onClose={() => setShowAIInsight(false)} 
                    />
                  )}

                  {/* Edit Remedy Modal */}
                  {showEditModal && (
                    <EditRemedyModal
                      remedy={remedy}
                      onClose={() => setShowEditModal(false)}
                    />
                  )}
                </div>
              );
            }