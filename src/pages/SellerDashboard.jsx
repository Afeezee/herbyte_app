
import React, { useState } from "react";
import { api } from "@/api/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Store, Package, Plus, Edit, Trash2, AlertCircle,
  CheckCircle, Clock, Upload, X
} from "lucide-react";
import { usePageMeta } from "@/lib/usePageMeta";

export default function SellerDashboard() {
  usePageMeta({ title: "Seller Dashboard" });
  const queryClient = useQueryClient();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editingProfile, setEditingProfile] = useState(false);
  const [addingProduct, setAddingProduct] = useState(false);
  
  // Fetch current user
  React.useEffect(() => {
    const fetchUser = async () => {
      try {
        const currentUser = await api.auth.me();
        setUser(currentUser);
      } catch (error) {
        console.error("Error fetching user:", error);
      }
      setLoading(false);
    };
    fetchUser();
  }, []);

  const { data: sellerProfile, isLoading: profileLoading } = useQuery({
    queryKey: ['seller-profile', user?.seller_profile_id],
    queryFn: async () => {
      if (!user?.seller_profile_id) return null;
      const profiles = await api.entities.SellerProfile.filter({ id: user.seller_profile_id });
      return profiles[0];
    },
    enabled: !!user?.seller_profile_id,
  });

  const { data: products, isLoading: productsLoading } = useQuery({
    queryKey: ['my-products', user?.seller_profile_id],
    queryFn: async () => {
      if (!user?.seller_profile_id) return [];
      return await api.entities.Product.filter({ seller_id: user.seller_profile_id });
    },
    enabled: !!user?.seller_profile_id,
    initialData: [],
  });

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-600">Loading...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center">
            <AlertCircle className="w-12 h-12 text-orange-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Sign In Required</h2>
            <p className="text-gray-600 mb-6">
              You need to be signed in to access the seller dashboard.
            </p>
            <Button onClick={() => api.auth.redirectToLogin(window.location.href)}>
              Sign In
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Not a seller and no profile - show become a seller page
  if (!user.is_seller && !sellerProfile) {
    return (
      <>
        <div className="min-h-screen flex items-center justify-center px-6">
          <Card className="max-w-2xl w-full">
            <CardContent className="p-8 text-center">
              <Store className="w-16 h-16 text-[#4A7C2E] mx-auto mb-6" />
              <h2 className="text-3xl font-bold text-[#2D5016] mb-4">Become a Seller</h2>
              <p className="text-gray-600 mb-6 leading-relaxed">
                Join our community of herbal medicine practitioners and sellers. Share your products with people seeking natural remedies.
              </p>
              <Button 
                size="lg"
                className="bg-[#4A7C2E] hover:bg-[#2D5016]"
                onClick={() => setEditingProfile(true)}
              >
                <Plus className="w-5 h-5 mr-2" />
                Create Seller Profile
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Profile Form Modal - Rendered outside the card so it can be shown */}
        {editingProfile && (
          <ProfileFormModal
            profile={null} // Pass null for creation
            userId={user.id}
            onClose={() => setEditingProfile(false)}
          />
        )}
      </>
    );
  }

  return (
    <div className="min-h-screen py-12">
      <div className="max-w-7xl mx-auto px-6">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-[#2D5016] mb-2">Seller Dashboard</h1>
          <p className="text-gray-600">Manage your business profile and product listings</p>
        </div>

        <Tabs defaultValue="profile" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2 bg-white border max-w-md">
            <TabsTrigger value="profile">
              <Store className="w-4 h-4 mr-2" />
              Business Profile
            </TabsTrigger>
            <TabsTrigger value="products">
              <Package className="w-4 h-4 mr-2" />
              Products ({products.length})
            </TabsTrigger>
          </TabsList>

          {/* Business Profile Tab */}
          <TabsContent value="profile">
            {sellerProfile ? (
              <ProfileView 
                profile={sellerProfile} 
                onEdit={() => setEditingProfile(true)} 
              />
            ) : (
              <Card>
                <CardContent className="p-12 text-center">
                  <Store className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">No profile yet</h3>
                  <p className="text-gray-600 mb-6">Create your seller profile to get started</p>
                  <Button onClick={() => setEditingProfile(true)}>
                    Create Profile
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Products Tab */}
          <TabsContent value="products">
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-[#2D5016]">Your Products</h2>
                <Button 
                  onClick={() => setAddingProduct(true)}
                  className="bg-[#4A7C2E] hover:bg-[#2D5016]"
                  disabled={!sellerProfile}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Product
                </Button>
              </div>

              {!sellerProfile && (
                <Alert className="bg-orange-50 border-orange-200">
                  <AlertCircle className="h-4 w-4 text-orange-600" />
                  <AlertDescription className="text-orange-900">
                    Please complete your business profile before adding products.
                  </AlertDescription>
                </Alert>
              )}

              {productsLoading ? (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="bg-gray-100 rounded-xl h-64 animate-pulse"></div>
                  ))}
                </div>
              ) : products.length > 0 ? (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {products.map(product => (
                    <ProductItem key={product.id} product={product} />
                  ))}
                </div>
              ) : (
                <Card>
                  <CardContent className="p-12 text-center">
                    <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">No products yet</h3>
                    <p className="text-gray-600 mb-6">Start adding products to showcase your herbal remedies</p>
                    <Button 
                      onClick={() => setAddingProduct(true)}
                      disabled={!sellerProfile}
                    >
                      Add Your First Product
                    </Button>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>
        </Tabs>

        {/* Product Form Modal */}
        {addingProduct && sellerProfile && (
          <ProductFormModal
            sellerProfile={sellerProfile}
            onClose={() => setAddingProduct(false)}
          />
        )}

        {/* Profile Edit Modal */}
        {editingProfile && (
          <ProfileFormModal
            profile={sellerProfile}
            userId={user.id}
            onClose={() => setEditingProfile(false)}
          />
        )}
      </div>
    </div>
  );
}

function ProfileView({ profile, onEdit }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between">
        <div>
          <CardTitle className="text-2xl text-[#2D5016] mb-2">{profile.business_name}</CardTitle>
          <Badge className={
            profile.moderation_status === "Approved" ? "bg-green-500" :
            profile.moderation_status === "Pending" ? "bg-yellow-500" :
            "bg-red-500"
          }>
            {profile.moderation_status}
          </Badge>
        </div>
        <Button variant="outline" onClick={onEdit}>
          <Edit className="w-4 h-4 mr-2" />
          Edit
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {profile.logo_url && (
          <img src={profile.logo_url} alt="Logo" className="w-32 h-32 object-cover rounded-lg" />
        )}
        <div>
          <p className="text-sm font-medium text-gray-700">Description</p>
          <p className="text-gray-600">{profile.description}</p>
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <p className="text-sm font-medium text-gray-700">Contact Email</p>
            <p className="text-gray-600">{profile.contact_email}</p>
          </div>
          {profile.phone_number && (
            <div>
              <p className="text-sm font-medium text-gray-700">Phone</p>
              <p className="text-gray-600">{profile.phone_number}</p>
            </div>
          )}
          {profile.location && (
            <div>
              <p className="text-sm font-medium text-gray-700">Location</p>
              <p className="text-gray-600">{profile.location}</p>
            </div>
          )}
          {profile.website_url && (
            <div>
              <p className="text-sm font-medium text-gray-700">Website</p>
              <a href={profile.website_url} target="_blank" rel="noopener noreferrer" className="text-[#4A7C2E] hover:underline">
                {profile.website_url}
              </a>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function ProfileFormModal({ profile, userId, onClose }) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState(profile || {
    business_name: "",
    contact_email: "",
    phone_number: "",
    website_url: "",
    description: "",
    location: "",
    certifications: [],
    specialties: [],
    years_in_practice: "",
    terms_accepted: false
  });
  const [uploadingLogo, setUploadingLogo] = useState(false);

  const createMutation = useMutation({
    mutationFn: async (data) => {
      const newProfile = await api.entities.SellerProfile.create(data);
      // Update user to link to this profile
      await api.auth.updateMe({
        seller_profile_id: newProfile.id,
        is_seller: true
      });
      return newProfile;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['seller-profile'] });
      window.location.reload(); // Reload to show dashboard correctly with new seller status
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data) => api.entities.SellerProfile.update(profile.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['seller-profile'] });
      onClose();
    },
  });

  const handleLogoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploadingLogo(true);
    try {
      const { file_url } = await api.integrations.Core.UploadFile({ file });
      setFormData({...formData, logo_url: file_url});
    } catch (error) {
      console.error("Logo upload error:", error);
      alert("Failed to upload logo. Please try again.");
    }
    setUploadingLogo(false);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (profile) {
      updateMutation.mutate(formData);
    } else {
      if (!formData.terms_accepted) {
        alert("Please accept the terms and conditions");
        return;
      }
      createMutation.mutate(formData);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-6 overflow-y-auto">
      <Card className="max-w-2xl w-full my-8">
        <CardHeader>
          <CardTitle className="text-2xl text-[#2D5016]">
            {profile ? "Edit Business Profile" : "Create Seller Profile"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <Label htmlFor="business_name">Business Name *</Label>
              <Input
                id="business_name"
                required
                value={formData.business_name}
                onChange={(e) => setFormData({...formData, business_name: e.target.value})}
                className="mt-2"
              />
            </div>

            <div>
              <Label>Business Logo (Optional)</Label>
              <div className="mt-2">
                {formData.logo_url ? (
                  <div className="relative inline-block">
                    <img src={formData.logo_url} alt="Logo" className="w-32 h-32 object-cover rounded-lg" />
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      className="absolute top-2 right-2"
                      onClick={() => setFormData({...formData, logo_url: ""})}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="border-2 border-dashed rounded-lg p-6 text-center max-w-xs">
                    <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                    <Input
                      type="file"
                      accept="image/*"
                      onChange={handleLogoUpload}
                      disabled={uploadingLogo}
                    />
                  </div>
                )}
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <Label htmlFor="contact_email">Contact Email *</Label>
                <Input
                  id="contact_email"
                  type="email"
                  required
                  value={formData.contact_email}
                  onChange={(e) => setFormData({...formData, contact_email: e.target.value})}
                  className="mt-2"
                />
              </div>

              <div>
                <Label htmlFor="phone_number">Phone Number</Label>
                <Input
                  id="phone_number"
                  value={formData.phone_number || ""}
                  onChange={(e) => setFormData({...formData, phone_number: e.target.value})}
                  className="mt-2"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="description">About Your Business *</Label>
              <Textarea
                id="description"
                required
                value={formData.description}
                onChange={(e) => setFormData({...formData, description: e.target.value})}
                rows={4}
                className="mt-2"
              />
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <Label htmlFor="location">Location</Label>
                <Input
                  id="location"
                  value={formData.location || ""}
                  onChange={(e) => setFormData({...formData, location: e.target.value})}
                  placeholder="City, Country"
                  className="mt-2"
                />
              </div>

              <div>
                <Label htmlFor="website_url">Website</Label>
                <Input
                  id="website_url"
                  type="url"
                  value={formData.website_url || ""}
                  onChange={(e) => setFormData({...formData, website_url: e.target.value})}
                  placeholder="https://..."
                  className="mt-2"
                />
              </div>
            </div>

            {!profile && (
              <div className="flex items-start gap-2">
                <input
                  type="checkbox"
                  id="terms"
                  checked={formData.terms_accepted}
                  onChange={(e) => setFormData({...formData, terms_accepted: e.target.checked})}
                  className="mt-1"
                />
                <Label htmlFor="terms" className="text-sm">
                  I agree to the platform terms and conditions and confirm that my products comply with local regulations
                </Label>
              </div>
            )}

            <div className="flex gap-3">
              <Button 
                type="submit" 
                className="flex-1 bg-[#4A7C2E] hover:bg-[#2D5016]"
                disabled={createMutation.isPending || updateMutation.isPending}
              >
                {profile ? "Update Profile" : "Create Profile"}
              </Button>
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function ProductItem({ product }) {
  return (
    <Card className="overflow-hidden">
      <div className="relative h-40 bg-gray-100">
        {product.image_urls && product.image_urls.length > 0 ? (
          <img src={product.image_urls[0]} alt={product.product_name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Package className="w-12 h-12 text-gray-300" />
          </div>
        )}
        <div className="absolute top-2 right-2">
          <Badge className={
            product.moderation_status === "Approved" ? "bg-green-500" :
            product.moderation_status === "Pending" ? "bg-yellow-500" :
            "bg-red-500"
          }>
            {product.moderation_status}
          </Badge>
        </div>
      </div>
      <CardContent className="p-4">
        <h3 className="font-bold text-lg text-[#2D5016] mb-1">{product.product_name}</h3>
        <p className="text-2xl font-bold text-gray-900 mb-2">
          {product.currency} {product.price.toFixed(2)}
        </p>
        <p className="text-sm text-gray-600 line-clamp-2">{product.description}</p>
      </CardContent>
    </Card>
  );
}

function ProductFormModal({ sellerProfile, onClose }) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    product_name: "",
    description: "",
    price: "",
    currency: "USD",
    product_type: "Tea Blend",
    size: "",
    purchase_url: "",
    linked_remedy_id: "",
    linked_remedy_name: "",
    linked_herbs: [],
    availability: true
  });
  const [uploadingImages, setUploadingImages] = useState(false);
  const [images, setImages] = useState([]);

  const { data: remedies } = useQuery({
    queryKey: ['approved-remedies'],
    queryFn: () => api.entities.Remedy.filter({ approved_by_ai: true }),
    initialData: [],
  });

  const createMutation = useMutation({
    mutationFn: (data) => api.entities.Product.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-products'] });
      onClose();
    },
  });

  const handleImageUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    setUploadingImages(true);
    try {
      const uploadPromises = files.map(file => 
        api.integrations.Core.UploadFile({ file })
      );
      const results = await Promise.all(uploadPromises);
      const urls = results.map(r => r.file_url);
      setImages([...images, ...urls]);
    } catch (error) {
      console.error("Image upload error:", error);
      alert("Failed to upload images. Please try again.");
    }
    setUploadingImages(false);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    const productData = {
      ...formData,
      price: parseFloat(formData.price),
      seller_id: sellerProfile.id,
      seller_business_name: sellerProfile.business_name,
      image_urls: images
    };

    createMutation.mutate(productData);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-6 overflow-y-auto">
      <Card className="max-w-3xl w-full my-8">
        <CardHeader>
          <CardTitle className="text-2xl text-[#2D5016]">Add New Product</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <Label>Product Images</Label>
              <div className="mt-2 space-y-4">
                <div className="flex flex-wrap gap-4">
                  {images.map((url, index) => (
                    <div key={index} className="relative">
                      <img src={url} alt={`Product ${index + 1}`} className="w-24 h-24 object-cover rounded-lg" />
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        className="absolute -top-2 -right-2"
                        onClick={() => setImages(images.filter((_, i) => i !== index))}
                      >
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                  ))}
                </div>
                <div className="border-2 border-dashed rounded-lg p-6 text-center">
                  <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                  <Input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleImageUpload}
                    disabled={uploadingImages}
                    className="max-w-xs mx-auto"
                  />
                </div>
              </div>
            </div>

            <div>
              <Label htmlFor="product_name">Product Name *</Label>
              <Input
                id="product_name"
                required
                value={formData.product_name}
                onChange={(e) => setFormData({...formData, product_name: e.target.value})}
                className="mt-2"
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
                className="mt-2"
              />
            </div>

            <div className="grid md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="price">Price *</Label>
                <Input
                  id="price"
                  type="number"
                  step="0.01"
                  required
                  value={formData.price}
                  onChange={(e) => setFormData({...formData, price: e.target.value})}
                  className="mt-2"
                />
              </div>

              <div>
                <Label htmlFor="currency">Currency</Label>
                <Input
                  id="currency"
                  value={formData.currency}
                  onChange={(e) => setFormData({...formData, currency: e.target.value})}
                  className="mt-2"
                />
              </div>

              <div>
                <Label htmlFor="size">Size</Label>
                <Input
                  id="size"
                  value={formData.size}
                  onChange={(e) => setFormData({...formData, size: e.target.value})}
                  placeholder="e.g., 100ml"
                  className="mt-2"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="product_type">Product Type *</Label>
              <select
                id="product_type"
                required
                value={formData.product_type}
                onChange={(e) => setFormData({...formData, product_type: e.target.value})}
                className="mt-2 w-full border rounded-md p-2"
              >
                <option value="Tea Blend">Tea Blend</option>
                <option value="Tincture">Tincture</option>
                <option value="Salve">Salve</option>
                <option value="Capsules">Capsules</option>
                <option value="Extract">Extract</option>
                <option value="Powder">Powder</option>
                <option value="Oil">Oil</option>
                <option value="Cream">Cream</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div>
              <Label htmlFor="linked_remedy">Link to Remedy (Optional)</Label>
              <select
                id="linked_remedy"
                value={formData.linked_remedy_id}
                onChange={(e) => {
                  const selectedRemedy = remedies.find(r => r.id === e.target.value);
                  setFormData({
                    ...formData, 
                    linked_remedy_id: e.target.value,
                    linked_remedy_name: selectedRemedy ? selectedRemedy.name : ""
                  });
                }}
                className="mt-2 w-full border rounded-md p-2"
              >
                <option value="">Select a remedy...</option>
                {remedies.map(remedy => (
                  <option key={remedy.id} value={remedy.id}>{remedy.name}</option>
                ))}
              </select>
            </div>

            <div>
              <Label htmlFor="purchase_url">Purchase URL</Label>
              <Input
                id="purchase_url"
                type="url"
                value={formData.purchase_url}
                onChange={(e) => setFormData({...formData, purchase_url: e.target.value})}
                placeholder="Link where customers can buy"
                className="mt-2"
              />
            </div>

            <Alert>
              <AlertDescription>
                Products will be reviewed before being published. Make sure all information is accurate.
              </AlertDescription>
            </Alert>

            <div className="flex gap-3">
              <Button type="submit" className="flex-1 bg-[#4A7C2E] hover:bg-[#2D5016]">
                Add Product
              </Button>
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
