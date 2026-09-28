import React, { useState } from "react";
import { api } from "@/api/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Sparkles, AlertTriangle, CheckCircle, Loader2 } from "lucide-react";

export default function AIPersonalizedRemedyInsight({ remedy, onClose }) {
  const [formData, setFormData] = useState({
    age: "",
    health_condition: "",
    current_medications: "",
    allergies: "",
    additional_info: ""
  });
  const [aiResponse, setAiResponse] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const result = await api.ai.remedyInsight({
        remedy: {
          name: remedy.name,
          description: remedy.description,
          primary_herb_name: remedy.primary_herb_name,
          health_condition: remedy.health_condition,
          preparation_method: remedy.preparation_method,
          dosage: remedy.dosage,
          drug_interactions: remedy.drug_interactions,
          contraindications: remedy.contraindications,
          side_effects: remedy.side_effects,
          safety_rating: remedy.safety_rating,
        },
        profile: {
          age: formData.age,
          health_condition: formData.health_condition,
          current_medications: formData.current_medications,
          allergies: formData.allergies,
          additional_info: formData.additional_info,
        },
      });
      setAiResponse(result);
    } catch (error) {
      console.error("AI analysis error:", error);
      alert(error?.message ?? "Failed to get AI insight. Please try again.");
    }

    setLoading(false);
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-2xl text-[#2D5016]">
            <Sparkles className="w-6 h-6" />
            Personalized AI Insight for {remedy.name}
          </DialogTitle>
        </DialogHeader>

        {!aiResponse ? (
          <form onSubmit={handleSubmit} className="space-y-6 mt-4">
            <Alert>
              <AlertDescription className="text-sm">
                Provide your information to receive personalized guidance about using this remedy. All analysis is for educational purposes only.
              </AlertDescription>
            </Alert>

            <div className="space-y-4">
              <div>
                <Label htmlFor="age">Age (optional)</Label>
                <Input
                  id="age"
                  type="number"
                  value={formData.age}
                  onChange={(e) => setFormData({...formData, age: e.target.value})}
                  placeholder="Your age"
                />
              </div>

              <div>
                <Label htmlFor="condition">What health condition are you addressing? *</Label>
                <Input
                  id="condition"
                  required
                  value={formData.health_condition}
                  onChange={(e) => setFormData({...formData, health_condition: e.target.value})}
                  placeholder="e.g., digestive issues, constipation, detoxification"
                />
              </div>

              <div>
                <Label htmlFor="medications">Current Medications (optional)</Label>
                <Textarea
                  id="medications"
                  value={formData.current_medications}
                  onChange={(e) => setFormData({...formData, current_medications: e.target.value})}
                  placeholder="List any medications you're currently taking"
                  rows={3}
                />
              </div>

              <div>
                <Label htmlFor="allergies">Known Allergies (optional)</Label>
                <Input
                  id="allergies"
                  value={formData.allergies}
                  onChange={(e) => setFormData({...formData, allergies: e.target.value})}
                  placeholder="Any known allergies"
                />
              </div>

              <div>
                <Label htmlFor="additional">Additional Information (optional)</Label>
                <Textarea
                  id="additional"
                  value={formData.additional_info}
                  onChange={(e) => setFormData({...formData, additional_info: e.target.value})}
                  placeholder="Any other relevant health information"
                  rows={3}
                />
              </div>
            </div>

            <div className="flex gap-3">
              <Button type="submit" disabled={loading} className="flex-1 bg-[#4A7C2E] hover:bg-[#2D5016]">
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 mr-2" />
                    Get AI Insight
                  </>
                )}
              </Button>
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
            </div>
          </form>
        ) : (
          <div className="space-y-6 mt-4">
            {/* Recommendation Badge */}
            <div className="flex items-center justify-center">
              {aiResponse.recommendation === "Suitable" && (
                <div className="flex items-center gap-2 px-6 py-3 bg-green-100 border-2 border-green-300 rounded-full">
                  <CheckCircle className="w-6 h-6 text-green-700" />
                  <span className="font-bold text-green-900 text-lg">{aiResponse.recommendation}</span>
                </div>
              )}
              {aiResponse.recommendation === "Use with Caution" && (
                <div className="flex items-center gap-2 px-6 py-3 bg-yellow-100 border-2 border-yellow-300 rounded-full">
                  <AlertTriangle className="w-6 h-6 text-yellow-700" />
                  <span className="font-bold text-yellow-900 text-lg">{aiResponse.recommendation}</span>
                </div>
              )}
              {(aiResponse.recommendation === "Not Recommended" || aiResponse.recommendation === "Consult Healthcare Professional") && (
                <div className="flex items-center gap-2 px-6 py-3 bg-red-100 border-2 border-red-300 rounded-full">
                  <AlertTriangle className="w-6 h-6 text-red-700" />
                  <span className="font-bold text-red-900 text-lg">{aiResponse.recommendation}</span>
                </div>
              )}
            </div>

            {/* Reasoning */}
            <div className="p-4 bg-gray-50 rounded-lg">
              <h3 className="font-semibold text-lg mb-2 text-[#2D5016]">Analysis</h3>
              <p className="text-gray-700 leading-relaxed">{aiResponse.reasoning}</p>
            </div>

            {/* Potential Risks */}
            {aiResponse.potential_risks && aiResponse.potential_risks.length > 0 && (
              <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
                <h3 className="font-semibold text-lg mb-3 text-orange-900">Potential Risks</h3>
                <ul className="space-y-2">
                  {aiResponse.potential_risks.map((risk, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <span className="text-orange-600 mt-1">⚠️</span>
                      <span className="text-gray-800">{risk}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Dosage Guidance */}
            {aiResponse.dosage_guidance && (
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <h3 className="font-semibold text-lg mb-2 text-blue-900">Dosage Guidance</h3>
                <p className="text-gray-800">{aiResponse.dosage_guidance}</p>
              </div>
            )}

            {/* Alternative Remedies */}
            {aiResponse.alternative_remedies && aiResponse.alternative_remedies.length > 0 && (
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <h3 className="font-semibold text-lg mb-3 text-green-900">Alternative Remedies to Consider</h3>
                <div className="flex flex-wrap gap-2">
                  {aiResponse.alternative_remedies.map((alt, index) => (
                    <span key={index} className="px-3 py-1 bg-white border border-green-300 rounded-full text-sm">
                      {alt}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Professional Consultation */}
            {aiResponse.professional_consultation_needed && (
              <Alert className="bg-red-50 border-red-300">
                <AlertTriangle className="h-4 w-4 text-red-600" />
                <AlertDescription className="text-red-900">
                  <strong>Important:</strong> We strongly recommend consulting a healthcare professional before using this remedy given your specific circumstances.
                </AlertDescription>
              </Alert>
            )}

            {/* Additional Notes */}
            {aiResponse.additional_notes && (
              <div className="p-4 bg-gray-50 rounded-lg">
                <h3 className="font-semibold text-lg mb-2">Additional Notes</h3>
                <p className="text-gray-700">{aiResponse.additional_notes}</p>
              </div>
            )}

            <div className="flex gap-3 pt-4 border-t">
              <Button onClick={onClose} className="flex-1">
                Close
              </Button>
              <Button 
                variant="outline" 
                onClick={() => setAiResponse(null)}
                className="flex-1"
              >
                New Analysis
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}