import React, { useState } from "react";
import { api } from "@/api/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { X, Upload, Loader2 } from "lucide-react";

export default function EditHerbModal({ herb, onClose, onSuccess }) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    common_name: herb.common_name || "",
    botanical_name: herb.botanical_name || "",
    local_names: herb.local_names?.join(", ") || "",
    description: herb.description || "",
    category: herb.category || "Other",
    region: herb.region || "Global",
    dosage: herb.dosage || "",
    safety_rating: herb.safety_rating || "Use with Caution",
    image_url: herb.image_url || ""
  });
  const [uploadingImage, setUploadingImage] = useState(false);

  const updateMutation = useMutation({
    mutationFn: (data) => api.entities.Herb.update(herb.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['herb', herb.id] });
      queryClient.invalidateQueries({ queryKey: ['herbs'] });
      onSuccess?.();
      onClose();
    },
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
      local_names: formData.local_names ? formData.local_names.split(',').map(n => n.trim()) : []
    };
    updateMutation.mutate(updateData);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <Card className="max-w-2xl w-full my-8 max-h-[90vh] overflow-y-auto">
        <CardHeader className="flex flex-row items-center justify-between sticky top-0 bg-white z-10 border-b">
          <CardTitle className="text-xl text-[#2D5016]">Edit Herb</CardTitle>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </CardHeader>
        <CardContent className="p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label>Image</Label>
              <div className="mt-2 flex items-center gap-4">
                {formData.image_url && (
                  <img src={formData.image_url} alt="Herb" className="w-24 h-24 object-cover rounded-lg" />
                )}
                <div className="flex-1">
                  <Input type="file" accept="image/*" onChange={handleImageUpload} disabled={uploadingImage} />
                  {uploadingImage && <p className="text-sm text-gray-500 mt-1">Uploading...</p>}
                </div>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="common_name">Common Name *</Label>
                <Input
                  id="common_name"
                  required
                  value={formData.common_name}
                  onChange={(e) => setFormData({...formData, common_name: e.target.value})}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="botanical_name">Botanical Name *</Label>
                <Input
                  id="botanical_name"
                  required
                  value={formData.botanical_name}
                  onChange={(e) => setFormData({...formData, botanical_name: e.target.value})}
                  className="mt-1"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="local_names">Local Names (comma separated)</Label>
              <Input
                id="local_names"
                value={formData.local_names}
                onChange={(e) => setFormData({...formData, local_names: e.target.value})}
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
                rows={4}
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

            <div>
              <Label htmlFor="dosage">Dosage</Label>
              <Input
                id="dosage"
                value={formData.dosage}
                onChange={(e) => setFormData({...formData, dosage: e.target.value})}
                className="mt-1"
              />
            </div>

            <div className="flex gap-3 pt-4">
              <Button type="submit" className="flex-1 bg-[#4A7C2E] hover:bg-[#2D5016]" disabled={updateMutation.isPending}>
                {updateMutation.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving...</> : "Save Changes"}
              </Button>
              <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}