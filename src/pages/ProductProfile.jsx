import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Package, Store, ExternalLink, ArrowLeft, 
  MapPin, Phone, Mail, Globe, Beaker, Edit, Trash2, Shield
} from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import CommentSection from "../components/shared/CommentSection";
import WishlistButton from "../components/shared/WishlistButton";
import ShareButtons from "../components/shared/ShareButtons";

export default function ProductProfile() {
  const urlParams = new URLSearchParams(window.location.search);
  const productId = urlParams.get('id');
  const [user, setUser] = useState(null);
  const queryClient = useQueryClient();

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

  const { data: product, isLoading: productLoading } = useQuery({
    queryKey: ['product', productId],
    queryFn: async () => {
      const products = await api.entities.Product.filter({ id: productId });
      return products[0];
    },
    enabled: !!productId,
  });

  const { data: seller, isLoading: sellerLoading } = useQuery({
    queryKey: ['seller', product?.seller_id],
    queryFn: async () => {
      const sellers = await api.entities.SellerProfile.filter({ id: product.seller_id });
      return sellers[0];
    },
    enabled: !!product?.seller_id,
  });

  const { data: remedy, isLoading: remedyLoading } = useQuery({
    queryKey: ['remedy-for-product', product?.linked_remedy_id],
    queryFn: async () => {
      if (!product?.linked_remedy_id) return null;
      const remedies = await api.entities.Remedy.filter({ id: product.linked_remedy_id });
      return remedies[0];
    },
    enabled: !!product?.linked_remedy_id,
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.entities.Product.delete(productId),
    onSuccess: () => {
      alert("Product deleted successfully!");
      window.location.href = createPageUrl("ExploreProducts");
    },
  });

  const handleDelete = () => {
    if (window.confirm(`Are you sure you want to delete "${product.product_name}"? This action cannot be undone.`)) {
      deleteMutation.mutate();
    }
  };

  const isAdmin = user?.role === "admin";
  const isSeller = user?.seller_profile_id === product?.seller_id;
  const canEdit = isAdmin || isSeller;

  if (productLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Package className="w-12 h-12 text-[#4A7C2E] animate-pulse mx-auto mb-4" />
          <p className="text-gray-600">Loading product information...</p>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Product not found</h2>
          <Link to={createPageUrl("ExploreProducts")}>
            <Button>Back to Products</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-12">
      <section className="bg-gradient-to-br from-[#2D5016] to-[#4A7C2E] text-white py-8">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex items-center justify-between">
            <Link to={createPageUrl("ExploreProducts")} className="inline-flex items-center gap-2 text-white/80 hover:text-white mb-6">
              <ArrowLeft className="w-4 h-4" />
              Back to Products
            </Link>

            {canEdit && (
              <div className="flex gap-2 mb-6">
                <Button
                  variant="outline"
                  size="sm"
                  className="bg-white/10 border-white/30 text-white hover:bg-white/20"
                  onClick={() => alert("Edit functionality - coming soon")}
                >
                  <Edit className="w-4 h-4 mr-2" />
                  Edit Product
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
        {canEdit && (
          <Alert className="mb-4 bg-blue-50 border-blue-200">
            <Shield className="h-4 w-4 text-blue-600" />
            <AlertDescription className="text-blue-900">
              <strong>{isAdmin ? "Admin Mode" : "Seller Mode"}:</strong> You can edit or delete this product.
            </AlertDescription>
          </Alert>
        )}

        <div className="grid lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <Card className="overflow-hidden shadow-xl">
              <div className="grid md:grid-cols-2 gap-6">
                <div className="bg-gray-100">
                  {product.image_urls && product.image_urls.length > 0 ? (
                    <img 
                      src={product.image_urls[0]} 
                      alt={product.product_name}
                      className="w-full h-96 object-cover"
                    />
                  ) : (
                    <div className="w-full h-96 flex items-center justify-center">
                      <Package className="w-24 h-24 text-gray-300" />
                    </div>
                  )}
                </div>

                <div className="p-6">
                  <Badge className="bg-[#4A7C2E] text-white mb-4">
                    {product.product_type}
                  </Badge>

                  <h1 className="text-3xl font-bold text-[#2D5016] mb-2">
                    {product.product_name}
                  </h1>

                  {product.size && (
                    <p className="text-gray-600 mb-4">{product.size}</p>
                  )}

                  <div className="mb-6">
                    <p className="text-4xl font-bold text-[#2D5016]">
                      {product.currency} {product.price.toFixed(2)}
                    </p>
                  </div>

                  <div className="space-y-4">
                    {product.linked_remedy_name && (
                      <div className="p-3 bg-green-50 rounded-lg">
                        <p className="text-sm font-medium text-green-900 mb-1">
                          <Beaker className="w-4 h-4 inline mr-1" />
                          Remedy:
                        </p>
                        <Link 
                          to={`${createPageUrl("RemedyProfile")}?id=${product.linked_remedy_id}`}
                          className="text-[#4A7C2E] hover:underline font-medium"
                        >
                          {product.linked_remedy_name}
                        </Link>
                      </div>
                    )}

                    <div className="space-y-2">
                      {product.purchase_url ? (
                        <a 
                          href={product.purchase_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block"
                        >
                          <Button className="w-full bg-[#4A7C2E] hover:bg-[#2D5016] text-lg py-6">
                            <ExternalLink className="w-5 h-5 mr-2" />
                            Buy Now
                          </Button>
                        </a>
                      ) : (
                        <p className="text-sm text-gray-500 text-center py-4">
                          Contact seller for purchase information
                        </p>
                      )}

                      <WishlistButton
                        entityType="Product"
                        entityId={productId}
                        entityName={product.product_name}
                        entityImageUrl={product.image_urls?.[0]}
                        entityMetadata={{
                          price: product.price,
                          currency: product.currency,
                          product_type: product.product_type,
                          seller_business_name: product.seller_business_name
                        }}
                        size="lg"
                      />

                      <ShareButtons
                        title={product.product_name}
                        description={product.description}
                        imageUrl={product.image_urls?.[0]}
                        entityType="product"
                      />

                      {!product.availability && (
                        <Badge className="bg-red-500 text-white w-full justify-center py-2">
                          Currently Out of Stock
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <CardContent className="border-t p-6">
                <h2 className="text-xl font-bold text-[#2D5016] mb-4">Description</h2>
                <p className="text-gray-700 leading-relaxed whitespace-pre-line">
                  {product.description}
                </p>

                {product.linked_herbs && product.linked_herbs.length > 0 && (
                  <div className="mt-6">
                    <h3 className="font-semibold text-lg text-[#2D5016] mb-3">Herbs Used</h3>
                    <div className="flex flex-wrap gap-2">
                      {product.linked_herbs.map((herb, index) => (
                        <Badge key={index} variant="outline" className="bg-[#4A7C2E]/5 text-[#2D5016]">
                          {herb}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {remedy && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-[#2D5016]">
                    <Beaker className="w-5 h-5" />
                    About This Remedy
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <h3 className="font-bold text-lg mb-2">{remedy.name}</h3>
                  <p className="text-gray-600 mb-4 line-clamp-3">{remedy.description}</p>
                  <Link to={`${createPageUrl("RemedyProfile")}?id=${remedy.id}`}>
                    <Button variant="outline" className="w-full">
                      View Full Remedy Details
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            )}
          </div>

          <div className="space-y-6">
            <Card className="shadow-xl sticky top-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-[#2D5016]">
                  <Store className="w-5 h-5" />
                  Seller Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {seller ? (
                  <>
                    {seller.logo_url && (
                      <img 
                        src={seller.logo_url} 
                        alt={seller.business_name}
                        className="w-24 h-24 object-cover rounded-lg"
                      />
                    )}

                    <div>
                      <h3 className="font-bold text-xl text-[#2D5016] mb-2">
                        {seller.business_name}
                      </h3>
                      <p className="text-gray-600 leading-relaxed">
                        {seller.description}
                      </p>
                    </div>

                    <div className="space-y-3 pt-4 border-t">
                      {seller.location && (
                        <div className="flex items-start gap-3">
                          <MapPin className="w-4 h-4 text-gray-500 mt-1" />
                          <span className="text-gray-700">{seller.location}</span>
                        </div>
                      )}

                      <div className="flex items-start gap-3">
                        <Mail className="w-4 h-4 text-gray-500 mt-1" />
                        <a 
                          href={`mailto:${seller.contact_email}`}
                          className="text-[#4A7C2E] hover:underline"
                        >
                          {seller.contact_email}
                        </a>
                      </div>

                      {seller.phone_number && (
                        <div className="flex items-start gap-3">
                          <Phone className="w-4 h-4 text-gray-500 mt-1" />
                          <a 
                            href={`tel:${seller.phone_number}`}
                            className="text-[#4A7C2E] hover:underline"
                          >
                            {seller.phone_number}
                          </a>
                        </div>
                      )}

                      {seller.website_url && (
                        <div className="flex items-start gap-3">
                          <Globe className="w-4 h-4 text-gray-500 mt-1" />
                          <a 
                            href={seller.website_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[#4A7C2E] hover:underline break-all"
                          >
                            Visit Website
                          </a>
                        </div>
                      )}
                    </div>

                    {seller.certifications && seller.certifications.length > 0 && (
                      <div className="pt-4 border-t">
                        <p className="text-sm font-medium text-gray-700 mb-2">Certifications</p>
                        <div className="flex flex-wrap gap-2">
                          {seller.certifications.map((cert, index) => (
                            <Badge key={index} variant="outline" className="text-xs">
                              {cert}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                ) : sellerLoading ? (
                  <p className="text-gray-500">Loading seller information...</p>
                ) : (
                  <p className="text-gray-500">Seller information not available</p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        <CommentSection 
          entityType="Product"
          entityId={productId}
          entityName={product.product_name}
        />
      </div>
    </div>
  );
}