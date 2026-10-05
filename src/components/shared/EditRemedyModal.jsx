import React, { useState } from "react";
import { api } from "@/api/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { X, Loader2, Sparkles, Trash2, ImageIcon } from "lucide-react";

export default function EditRemedyModal({ remedy, onClose, onSuccess }) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    name: remedy.name || "",
    description: remedy.description || "",
    primary_herb_name: remedy.primary_herb_name || "",
    herbs_used: remedy.herbs_used?.join(", ") || "",
    health_condition: remedy.health_condition || "",
    preparation_method: remedy.preparation_method || "",
    dosage: remedy.dosage || "",
    duration_of_use: remedy.duration_of_use || "",
    observed_effects: remedy.observed_effects || "",
    category: remedy.category || "Other",
    region: remedy.region || "Global",
    safety_rating: remedy.safety_rating || "Use with Caution",
    image_url: remedy.image_url || ""
  });
  const [uploadingImage, setUploadingImage] = useState(false);

  const updateMutation = useMutation({
    mutationFn: (data) => api.entities.Remedy.update(remedy.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['remedy', remedy.id] });
      queryClient.invalidateQueries({ queryKey: ['remedies'] });
      onSuccess?.();
      onClose();
    },
  });

  const regenerateImageMutation = useMutation({
    mutationFn: () => api.regenerate.remedyImage(remedy.id),
    onSuccess: (res) => {
      if (res?.image_url) {
        setFormData((f) => ({ ...f, image_url: res.image_url }));
        queryClient.invalidateQueries({ queryKey: ['remedy', remedy.id] });
        queryClient.invalidateQueries({ queryKey: ['remedies'] });
      } else {
        alert(res?.message || "No image found. Try editing the primary herb name and retrying.");
      }
    },
    onError: (err) => alert(`Image fetch failed: ${err?.message ?? "unknown error"}`),
  });

  const regenerateMutation = useMutation({
    mutationFn: () => api.regenerate.remedy(remedy.id),
    onSuccess: (res) => {
      const r = res?.record;
      if (r) {
        setFormData({
          name: r.name || formData.name,
          description: r.description || formData.description,
          primary_herb_name: r.primary_herb_name || formData.primary_herb_name,
          herbs_used: r.herbs_used?.join(", ") || formData.herbs_used,
          health_condition: r.health_condition || formData.health_condition,
          preparation_method: r.preparation_method || formData.preparation_method,
          dosage: r.dosage || formData.dosage,
          duration_of_use: r.duration_of_use || formData.duration_of_use,
          observed_effects: r.observed_effects || formData.observed_effects,
          category: r.category || formData.category,
          region: r.region || formData.region,
          safety_rating: r.safety_rating || formData.safety_rating,
          image_url: r.image_url || formData.image_url,
        });
      }
      queryClient.invalidateQueries({ queryKey: ['remedy', remedy.id] });
      queryClient.invalidateQueries({ queryKey: ['remedies'] });
      const filled = res?.filled_fields ?? [];
      alert(filled.length
        ? `Filled ${filled.length} missing field(s): ${filled.join(", ")}`
        : "No empty fields to fill — record already complete.");
    },
    onError: (err) => alert(`Regenerate failed: ${err?.message ?? "unknown error"}`),
  });

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploadingImage(true);
    try {
      const { file_url } = await api.integrations.Core.UploadFile({ file });
      setFormData({...formData, image_url: file_url});
    } catch (error) {
      console.error("Image upload error:", error);
      alert("Failed to upload image.");
    }
    setUploadingImage(false);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const updateData = {
      ...formData,
      herbs_used: formData.herbs_used ? formData.herbs_used.split(',').map(h => h.trim()) : []
    };
    updateMutation.mutate(updateData);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <Card className="max-w-2xl w-full my-8 max-h-[90vh] overflow-y-auto">
        <CardHeader className="flex flex-row items-center justify-between sticky top-0 bg-white z-10 border-b">
          <CardTitle className="text-xl text-[#2D5016]">Edit Remedy</CardTitle>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </CardHeader>
        <CardContent className="p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label>Image</Label>
              <div className="mt-2 flex items-start gap-4">
                {formData.image_url ? (
                  <div className="relative">
                    <img src={formData.image_url} alt="Remedy" className="w-24 h-24 object-cover rounded-lg border" />
                    <button
                      type="button"
                      onClick={() => setFormData({...formData, image_url: ""})}
                      className="absolute -top-2 -right-2 bg-white border border-red-300 text-red-600 rounded-full p-1 shadow hover:bg-red-50"
                      title="Remove image"
                      aria-label="Remove image"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <div className="w-24 h-24 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center text-gray-400">
                    <ImageIcon className="w-6 h-6" />
                  </div>
                )}
                <div className="flex-1 space-y-2">
                  <Input type="file" accept="image/*" onChange={handleImageUpload} disabled={uploadingImage} />
                  {uploadingImage && <p className="text-sm text-gray-500">Uploading…</p>}
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="border-emerald-600 text-emerald-700 hover:bg-emerald-50"
                      onClick={() => regenerateImageMutation.mutate()}
                      disabled={regenerateImageMutation.isPending || uploadingImage}
                      title="Replace with a fresh image from Wikipedia/Wikimedia Commons (fallback: Unsplash)"
                    >
                      {regenerateImageMutation.isPending
                        ? <><Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> Fetching…</>
                        : <><Sparkles className="w-3.5 h-3.5 mr-1" /> Fetch new image</>}
                    </Button>
                    {formData.image_url && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-red-600 hover:bg-red-50"
                        onClick={() => setFormData({...formData, image_url: ""})}
                      >
                        <Trash2 className="w-3.5 h-3.5 mr-1" /> Remove
                      </Button>
                    )}
                  </div>
                  <p className="text-xs text-gray-500">
                    Upload a file, fetch one automatically, or remove the current image. Changes save when you click <strong>Save Changes</strong>.
                  </p>
                </div>
              </div>
            </div>

            <div>
              <Label htmlFor="name">Remedy Name *</Label>
              <Input
                id="name"
                required
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
                className="mt-1"
              />
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="primary_herb_name">Primary Herb *</Label>
                <Input
                  id="primary_herb_name"
                  required
                  value={formData.primary_herb_name}
                  onChange={(e) => setFormData({...formData, primary_herb_name: e.target.value})}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="health_condition">Health Condition *</Label>
                <Input
                  id="health_condition"
                  required
                  value={formData.health_condition}
                  onChange={(e) => setFormData({...formData, health_condition: e.target.value})}
                  className="mt-1"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="herbs_used">Other Herbs (comma separated)</Label>
              <Input
                id="herbs_used"
                value={formData.herbs_used}
                onChange={(e) => setFormData({...formData, herbs_used: e.target.value})}
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="description">Description *</Label>
              <Textarea
                id="description"
                required
                value={formData.description}
                onChange={(e) => setFormData({...formData, description: e.target.value})}
                rows={3}
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="preparation_method">Preparation Method *</Label>
              <Textarea
                id="preparation_method"
                required
                value={formData.preparation_method}
                onChange={(e) => setFormData({...formData, preparation_method: e.target.value})}
                rows={3}
                className="mt-1"
              />
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="dosage">Dosage</Label>
                <Input
                  id="dosage"
                  value={formData.dosage}
                  onChange={(e) => setFormData({...formData, dosage: e.target.value})}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="duration_of_use">Duration of Use</Label>
                <Input
                  id="duration_of_use"
                  value={formData.duration_of_use}
                  onChange={(e) => setFormData({...formData, duration_of_use: e.target.value})}
                  className="mt-1"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="observed_effects">Observed Effects</Label>
              <Textarea
                id="observed_effects"
                value={formData.observed_effects}
                onChange={(e) => setFormData({...formData, observed_effects: e.target.value})}
                rows={2}
                className="mt-1"
              />
            </div>

            <div className="grid md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="category">Category</Label>
                <select
                  id="category"
                  value={formData.category}
                  onChange={(e) => setFormData({...formData, category: e.target.value})}
                  className="mt-1 w-full border rounded-md p-2"
                >
                  <option value="Adaptogen">Adaptogen</option>
                  <option value="Anti-inflammatory">Anti-inflammatory</option>
                  <option value="Digestive">Digestive</option>
                  <option value="Immune Support">Immune Support</option>
                  <option value="Cardiovascular">Cardiovascular</option>
                  <option value="Respiratory">Respiratory</option>
                  <option value="Nervous System">Nervous System</option>
                  <option value="Antimicrobial">Antimicrobial</option>
                  <option value="Pain Relief">Pain Relief</option>
                  <option value="Skin Health">Skin Health</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div>
                <Label htmlFor="region">Region</Label>
                <select
                  id="region"
                  value={formData.region}
                  onChange={(e) => setFormData({...formData, region: e.target.value})}
                  className="mt-1 w-full border rounded-md p-2"
                >
                  <option value="Africa">Africa</option>
                  <option value="Asia">Asia</option>
                  <option value="Europe">Europe</option>
                  <option value="North America">North America</option>
                  <option value="South America">South America</option>
                  <option value="Australia">Australia</option>
                  <option value="Middle East">Middle East</option>
                  <option value="Global">Global</option>
                </select>
              </div>
              <div>
                <Label htmlFor="safety_rating">Safety Rating</Label>
                <select
                  id="safety_rating"
                  value={formData.safety_rating}
                  onChange={(e) => setFormData({...formData, safety_rating: e.target.value})}
                  className="mt-1 w-full border rounded-md p-2"
                >
                  <option value="Generally Safe">Generally Safe</option>
                  <option value="Use with Caution">Use with Caution</option>
                  <option value="High Risk - Expert Guidance Required">High Risk</option>
                </select>
              </div>
            </div>

            <div className="flex flex-wrap gap-3 pt-4">
              <Button type="submit" className="flex-1 bg-[#4A7C2E] hover:bg-[#2D5016]" disabled={updateMutation.isPending || regenerateMutation.isPending}>
                {updateMutation.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving...</> : "Save Changes"}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="border-emerald-600 text-emerald-700 hover:bg-emerald-50"
                onClick={() => regenerateMutation.mutate()}
                disabled={regenerateMutation.isPending || updateMutation.isPending}
                title="Fill any empty fields with AI-generated content (web-searched). Existing values are never overwritten."
              >
                {regenerateMutation.isPending
                  ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Regenerating…</>
                  : <><Sparkles className="w-4 h-4 mr-2" /> Regenerate missing</>}
              </Button>
              <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}