import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Leaf, MapPin, AlertTriangle, Beaker, BookOpen, 
  Heart, Shield, Pill, Sparkles, ArrowLeft, Edit, Trash2, User
} from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import AIPersonalizedInsight from "../components/herbs/AIPersonalizedInsight";
import CommentSection from "../components/shared/CommentSection";
import WishlistButton from "../components/shared/WishlistButton";
import ShareButtons from "../components/shared/ShareButtons";
import EditHerbModal from "../components/shared/EditHerbModal";

export default function HerbProfile() {
  const urlParams = new URLSearchParams(window.location.search);
  const herbId = urlParams.get('id');
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

  const { data: herb, isLoading } = useQuery({
    queryKey: ['herb', herbId],
    queryFn: async () => {
      const herbs = await api.entities.Herb.filter({ id: herbId });
      return herbs[0];
    },
    enabled: !!herbId,
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.entities.Herb.delete(herbId),
    onSuccess: () => {
      alert("Herb deleted successfully!");
      window.location.href = createPageUrl("ExploreHerbs");
    },
    onError: (error) => {
      alert(`Error deleting herb: ${error.message}`);
      console.error("Error deleting herb:", error);
    }
  });

  const handleDelete = () => {
    if (window.confirm(`Are you sure you want to delete "${herb.common_name}"? This action cannot be undone.`)) {
      deleteMutation.mutate();
    }
  };

  const isAdmin = user?.role === "admin";
  const isCreator = user?.email === herb?.created_by;
  const canEdit = isAdmin || isCreator;

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Leaf className="w-12 h-12 text-[#4A7C2E] animate-pulse mx-auto mb-4" />
          <p className="text-gray-600">Loading herb information...</p>
        </div>
      </div>
    );
  }

  if (!herb) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Herb not found</h2>
          <Link to={createPageUrl("ExploreHerbs")}>
            <Button>Back to Explore</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-12">
      {/* Hero Section */}
      <section className="bg-gradient-to-br from-[#2D5016] to-[#4A7C2E] text-white py-8">
        <div className="max-w-7xl mx-auto px-6">
          {/* Modified: Added flex container for back link and admin buttons */}
          <div className="flex items-center justify-between">
            <Link to={createPageUrl("ExploreHerbs")} className="inline-flex items-center gap-2 text-white/80 hover:text-white mb-6">
              <ArrowLeft className="w-4 h-4" />
              Back to Explore
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
                                    Edit Herb
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
                            <strong>{isAdmin ? "Admin Mode" : "Creator Mode"}:</strong> You can edit or delete this herb record.
                          </AlertDescription>
                        </Alert>
                      )}

        {/* Contributor Badge */}
        {herb.submitted_by && herb.community_contributed && (
          <Alert className="mb-4 bg-green-50 border-green-200">
            <User className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-900">
              <strong>Community Contribution:</strong> Submitted by {herb.submitted_by}
            </AlertDescription>
          </Alert>
        )}

        {/* Main Content Card */}
        <Card className="overflow-hidden shadow-xl mb-8">
          <div className="grid md:grid-cols-3 gap-8">
            {/* Image */}
            <div className="md:col-span-1">
              <div className="relative h-64 md:h-full bg-gray-100">
                {herb.image_url ? (
                  <img 
                    src={herb.image_url} 
                    alt={herb.common_name}
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
                    {herb.common_name}
                  </h1>
                  <p className="text-xl italic text-gray-600 mb-4">{herb.botanical_name}</p>
                  {herb.local_names && herb.local_names.length > 0 && (
                    <p className="text-sm text-gray-500">
                      Also known as: {herb.local_names.join(", ")}
                    </p>
                  )}
                  {herb.submitted_by && (
                    <p className="text-xs text-gray-500 mt-2 flex items-center gap-1">
                      <User className="w-3 h-3" />
                      Contributed by: {herb.submitted_by}
                    </p>
                  )}
                </div>

                <div className="flex flex-col gap-2">
                  {herb.safety_rating === "Generally Safe" && (
                    <Badge className="bg-green-500 text-white text-sm px-3 py-1">
                      <Shield className="w-4 h-4 mr-1" />
                      Generally Safe
                    </Badge>
                  )}
                  {herb.safety_rating === "Use with Caution" && (
                    <Badge className="bg-yellow-500 text-white text-sm px-3 py-1">
                      <AlertTriangle className="w-4 h-4 mr-1" />
                      Use with Caution
                    </Badge>
                  )}
                  {herb.safety_rating === "High Risk - Expert Guidance Required" && (
                    <Badge className="bg-red-500 text-white text-sm px-3 py-1">
                      <AlertTriangle className="w-4 h-4 mr-1" />
                      High Risk
                    </Badge>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap gap-3 mb-6">
                <Badge variant="outline" className="bg-[#4A7C2E]/10 text-[#2D5016] border-[#4A7C2E]/30 px-3 py-1">
                  {herb.category}
                </Badge>
                {herb.region && (
                  <Badge variant="outline" className="px-3 py-1">
                    <MapPin className="w-3 h-3 mr-1" />
                    {herb.region}
                  </Badge>
                )}
              </div>

              <p className="text-gray-700 leading-relaxed mb-6">
                {herb.description}
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
                                      entityType="Herb"
                                      entityId={herbId}
                                      entityName={herb.common_name}
                                      entityImageUrl={herb.image_url}
                                      entityMetadata={{
                                        botanical_name: herb.botanical_name,
                                        category: herb.category,
                                        region: herb.region
                                      }}
                                    />

                                    <ShareButtons
                                      title={herb.common_name}
                                      description={herb.description}
                                      imageUrl={herb.image_url}
                                      entityType="herb"
                                    />
                                  </div>
            </div>
          </div>
        </Card>

        {/* Detailed Information Tabs */}
        <Tabs defaultValue="benefits" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2 md:grid-cols-5 bg-white border">
            <TabsTrigger value="benefits">Benefits</TabsTrigger>
            <TabsTrigger value="usage">Usage</TabsTrigger>
            <TabsTrigger value="safety">Safety</TabsTrigger>
            <TabsTrigger value="compounds">Compounds</TabsTrigger>
            <TabsTrigger value="research">Research</TabsTrigger>
          </TabsList>

          {/* Health Benefits */}
          <TabsContent value="benefits">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-[#2D5016]">
                  <Heart className="w-5 h-5" />
                  Health Benefits & Conditions Treated
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {herb.health_benefits && herb.health_benefits.length > 0 && (
                  <div>
                    <h3 className="font-semibold text-lg mb-4">Documented Benefits</h3>
                    <div className="grid gap-4">
                      {herb.health_benefits.map((benefit, index) => (
                        <div key={index} className="flex items-start gap-3 p-4 bg-gray-50 rounded-lg">
                          <div className="flex-1">
                            <p className="font-medium text-gray-900">{benefit.benefit}</p>
                          </div>
                          <Badge 
                            variant="outline"
                            className={
                              benefit.evidence_level === "Strong Clinical Evidence" ? "bg-green-100 border-green-300 text-green-800" :
                              benefit.evidence_level === "Moderate Evidence" ? "bg-blue-100 border-blue-300 text-blue-800" :
                              benefit.evidence_level === "Preliminary Research" ? "bg-yellow-100 border-yellow-300 text-yellow-800" :
                              "bg-gray-100 border-gray-300 text-gray-800"
                            }
                          >
                            {benefit.evidence_level}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {herb.conditions_treated && herb.conditions_treated.length > 0 && (
                  <div>
                    <h3 className="font-semibold text-lg mb-4">Conditions Treated</h3>
                    <div className="flex flex-wrap gap-2">
                      {herb.conditions_treated.map((condition, index) => (
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

          {/* Usage & Dosage */}
          <TabsContent value="usage">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-[#2D5016]">
                  <Pill className="w-5 h-5" />
                  Preparation & Dosage
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {herb.preparation_methods && herb.preparation_methods.length > 0 && (
                  <div>
                    <h3 className="font-semibold text-lg mb-4">Preparation Methods</h3>
                    <div className="space-y-4">
                      {herb.preparation_methods.map((prep, index) => (
                        <div key={index} className="p-4 border rounded-lg">
                          <h4 className="font-medium text-[#2D5016] mb-2">{prep.method}</h4>
                          <p className="text-gray-700">{prep.instructions}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {herb.dosage && (
                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <h3 className="font-semibold text-lg mb-2 flex items-center gap-2">
                      <Pill className="w-5 h-5 text-blue-600" />
                      Recommended Dosage
                    </h3>
                    <p className="text-gray-800">{herb.dosage}</p>
                  </div>
                )}

                <Alert>
                  <AlertDescription>
                    Always start with the lowest recommended dose and consult a healthcare professional before use, especially if you have existing medical conditions or take medications.
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Safety Information */}
          <TabsContent value="safety">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-[#2D5016]">
                  <AlertTriangle className="w-5 h-5" />
                  Safety Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {herb.drug_interactions && herb.drug_interactions.length > 0 && (
                  <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                    <h3 className="font-semibold text-lg mb-3 text-red-900">Drug Interactions</h3>
                    <ul className="space-y-2">
                      {herb.drug_interactions.map((interaction, index) => (
                        <li key={index} className="flex items-start gap-2">
                          <span className="text-red-600 mt-1">⚠️</span>
                          <span className="text-gray-800">{interaction}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {herb.contraindications && herb.contraindications.length > 0 && (
                  <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
                    <h3 className="font-semibold text-lg mb-3 text-orange-900">Contraindications</h3>
                    <ul className="space-y-2">
                      {herb.contraindications.map((contra, index) => (
                        <li key={index} className="flex items-start gap-2">
                          <span className="text-orange-600 mt-1">⛔</span>
                          <span className="text-gray-800">{contra}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {herb.side_effects && herb.side_effects.length > 0 && (
                  <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <h3 className="font-semibold text-lg mb-3 text-yellow-900">Possible Side Effects</h3>
                    <ul className="space-y-2">
                      {herb.side_effects.map((effect, index) => (
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

          {/* Chemical Compounds */}
          <TabsContent value="compounds">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-[#2D5016]">
                  <Beaker className="w-5 h-5" />
                  Major Chemical Compounds
                </CardTitle>
              </CardHeader>
              <CardContent>
                {herb.major_compounds && herb.major_compounds.length > 0 ? (
                  <div className="flex flex-wrap gap-3">
                    {herb.major_compounds.map((compound, index) => (
                      <Badge key={index} variant="outline" className="bg-purple-50 border-purple-200 text-purple-800 px-3 py-1">
                        {compound}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500">No compound information available</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Research References */}
          <TabsContent value="research">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-[#2D5016]">
                  <BookOpen className="w-5 h-5" />
                  Research References
                </CardTitle>
              </CardHeader>
              <CardContent>
                {herb.research_references && herb.research_references.length > 0 ? (
                  <div className="space-y-4">
                    {herb.research_references.map((ref, index) => (
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

        {/* Comment Section - NEW */}
        <CommentSection 
          entityType="Herb"
          entityId={herbId}
          entityName={herb.common_name}
        />
      </div>

      {/* AI Personalized Insight Modal */}
                  {showAIInsight && (
                    <AIPersonalizedInsight 
                      herb={herb} 
                      onClose={() => setShowAIInsight(false)} 
                    />
                  )}

                  {/* Edit Herb Modal */}
                  {showEditModal && (
                    <EditHerbModal
                      herb={herb}
                      onClose={() => setShowEditModal(false)}
                    />
                  )}
                </div>
              );
            }