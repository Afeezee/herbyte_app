import React, { useState } from "react";
import { api } from "@/api/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Sparkles, Loader2, MessageCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function AIAssistant({ onClose }) {
  const [symptoms, setSymptoms] = useState("");
  const [aiResponse, setAiResponse] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const result = await api.ai.assistant({ symptoms });
      setAiResponse(result);
    } catch (error) {
      console.error("AI assistant error:", error);
      alert(error?.message ?? "Failed to get recommendations. Please try again.");
    }

    setLoading(false);
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-2xl text-[#2D5016]">
            <Sparkles className="w-6 h-6" />
            AI Herbal Assistant
          </DialogTitle>
        </DialogHeader>

        {!aiResponse ? (
          <form onSubmit={handleSubmit} className="space-y-6 mt-4">
            <Alert>
              <MessageCircle className="h-4 w-4" />
              <AlertDescription>
                Describe your symptoms or health concerns, and I'll suggest herbs that may help. Remember, this is educational information only.
              </AlertDescription>
            </Alert>

            <div>
              <Label htmlFor="symptoms">What symptoms or health concerns are you experiencing? *</Label>
              <Textarea
                id="symptoms"
                required
                value={symptoms}
                onChange={(e) => setSymptoms(e.target.value)}
                placeholder="e.g., I've been experiencing chronic stress and difficulty sleeping. I also have occasional digestive discomfort..."
                rows={6}
                className="mt-2"
              />
              <p className="text-sm text-gray-500 mt-2">
                Be as detailed as possible for better recommendations
              </p>
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
                    Get Recommendations
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
            {/* General Advice */}
            {aiResponse.general_advice && (
              <div className="p-4 bg-[#4A7C2E]/5 border border-[#4A7C2E]/20 rounded-lg">
                <p className="text-gray-800 leading-relaxed">{aiResponse.general_advice}</p>
              </div>
            )}

            {/* Recommended Herbs */}
            {aiResponse.recommended_herbs && aiResponse.recommended_herbs.length > 0 && (
              <div>
                <h3 className="text-xl font-semibold text-[#2D5016] mb-4">Recommended Herbs</h3>
                <div className="grid gap-4">
                  {aiResponse.recommended_herbs.map((herb, index) => (
                    <div key={index} className="p-5 border-2 border-[#4A7C2E]/20 rounded-xl hover:border-[#4A7C2E]/40 transition-all">
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div>
                          <h4 className="font-bold text-lg text-[#2D5016]">{herb.herb_name}</h4>
                          <p className="text-sm italic text-gray-600">{herb.botanical_name}</p>
                        </div>
                        <Badge className="bg-[#4A7C2E] text-white">#{index + 1}</Badge>
                      </div>
                      
                      <div className="space-y-3 mt-4">
                        <div>
                          <p className="text-sm font-semibold text-gray-700 mb-1">Why This Herb:</p>
                          <p className="text-gray-600">{herb.reason}</p>
                        </div>
                        
                        <div className="grid md:grid-cols-2 gap-3">
                          <div className="p-3 bg-blue-50 rounded-lg">
                            <p className="text-sm font-semibold text-blue-900 mb-1">Preparation:</p>
                            <p className="text-sm text-gray-700">{herb.preparation}</p>
                          </div>
                          
                          <div className="p-3 bg-green-50 rounded-lg">
                            <p className="text-sm font-semibold text-green-900 mb-1">Dosage:</p>
                            <p className="text-sm text-gray-700">{herb.dosage}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Safety Warnings */}
            {aiResponse.safety_warnings && aiResponse.safety_warnings.length > 0 && (
              <div className="p-4 bg-orange-50 border-2 border-orange-200 rounded-lg">
                <h3 className="font-semibold text-lg mb-3 text-orange-900 flex items-center gap-2">
                  ⚠️ Important Safety Information
                </h3>
                <ul className="space-y-2">
                  {aiResponse.safety_warnings.map((warning, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <span className="text-orange-600 mt-1">•</span>
                      <span className="text-gray-800">{warning}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* When to Seek Medical Help */}
            {aiResponse.seek_medical_help_if && aiResponse.seek_medical_help_if.length > 0 && (
              <div className="p-4 bg-red-50 border-2 border-red-200 rounded-lg">
                <h3 className="font-semibold text-lg mb-3 text-red-900 flex items-center gap-2">
                  🚨 Seek Professional Medical Help If:
                </h3>
                <ul className="space-y-2">
                  {aiResponse.seek_medical_help_if.map((condition, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <span className="text-red-600 mt-1">•</span>
                      <span className="text-gray-800">{condition}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Lifestyle Recommendations */}
            {aiResponse.lifestyle_recommendations && aiResponse.lifestyle_recommendations.length > 0 && (
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <h3 className="font-semibold text-lg mb-3 text-green-900">
                  💚 Complementary Lifestyle Recommendations
                </h3>
                <ul className="space-y-2">
                  {aiResponse.lifestyle_recommendations.map((rec, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <span className="text-green-600 mt-1">✓</span>
                      <span className="text-gray-800">{rec}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <Alert className="bg-amber-50 border-amber-300">
              <AlertDescription className="text-amber-900">
                <strong>Disclaimer:</strong> These recommendations are for educational purposes only and do not constitute medical advice. Always consult with a qualified healthcare professional before starting any herbal treatment.
              </AlertDescription>
            </Alert>

            <div className="flex gap-3 pt-4 border-t">
              <Button onClick={onClose} className="flex-1">
                Close
              </Button>
              <Button 
                variant="outline" 
                onClick={() => {
                  setAiResponse(null);
                  setSymptoms("");
                }}
                className="flex-1"
              >
                New Consultation
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}