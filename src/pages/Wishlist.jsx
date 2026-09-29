import React, { useState } from "react";
import { api } from "@/api/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Heart, Leaf, Beaker, Package, Trash2, ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { usePageMeta } from "@/lib/usePageMeta";

export default function WishlistPage() {
  usePageMeta({ title: "Wishlist" });
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
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
      setLoading(false);
    };
    fetchUser();
  }, []);

  // Fetch all wishlist items
  const { data: allWishlistItems, isLoading: wishlistLoading } = useQuery({
    queryKey: ['wishlist-all', user?.email],
    queryFn: async () => {
      if (!user?.email) return [];
      return await api.entities.Wishlist.filter({ user_email: user.email }, '-created_date');
    },
    enabled: !!user?.email,
    initialData: [],
  });

  // Delete mutation
  const removeFromWishlistMutation = useMutation({
    mutationFn: (id) => api.entities.Wishlist.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wishlist-all'] });
      queryClient.invalidateQueries({ queryKey: ['wishlist-item'] });
    },
  });

  const handleRemove = (id) => {
    if (window.confirm("Remove this item from your wishlist?")) {
      removeFromWishlistMutation.mutate(id);
    }
  };

  // Filter by entity type
  const herbs = allWishlistItems.filter(item => item.entity_type === "Herb");
  const remedies = allWishlistItems.filter(item => item.entity_type === "Remedy");
  const products = allWishlistItems.filter(item => item.entity_type === "Product");

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-600">Loading wishlist...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center">
            <Heart className="w-12 h-12 text-[#4A7C2E] mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Sign In Required</h2>
            <p className="text-gray-600 mb-6">
              Sign in to save and view your favorite herbs, remedies, and products.
            </p>
            <Button onClick={() => api.auth.redirectToLogin(window.location.href)}>
              Sign In
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-12">
      <div className="max-w-7xl mx-auto px-6">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <Heart className="w-10 h-10 text-red-500 fill-current" />
            <h1 className="text-4xl font-bold text-[#2D5016]">My Wishlist</h1>
          </div>
          <p className="text-gray-600 text-lg">
            {allWishlistItems.length} {allWishlistItems.length === 1 ? 'item' : 'items'} saved
          </p>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="all" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4 bg-white border">
            <TabsTrigger value="all">
              All ({allWishlistItems.length})
            </TabsTrigger>
            <TabsTrigger value="herbs">
              <Leaf className="w-4 h-4 mr-2" />
              Herbs ({herbs.length})
            </TabsTrigger>
            <TabsTrigger value="remedies">
              <Beaker className="w-4 h-4 mr-2" />
              Remedies ({remedies.length})
            </TabsTrigger>
            <TabsTrigger value="products">
              <Package className="w-4 h-4 mr-2" />
              Products ({products.length})
            </TabsTrigger>
          </TabsList>

          {/* All Items Tab */}
          <TabsContent value="all">
            <Card>
              <CardHeader>
                <CardTitle className="text-[#2D5016]">All Saved Items</CardTitle>
              </CardHeader>
              <CardContent>
                {wishlistLoading ? (
                  <p className="text-gray-500 text-center py-8">Loading...</p>
                ) : allWishlistItems.length > 0 ? (
                  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {allWishlistItems.map((item) => (
                      <WishlistItemCard key={item.id} item={item} onRemove={handleRemove} />
                    ))}
                  </div>
                ) : (
                  <EmptyWishlist />
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Herbs Tab */}
          <TabsContent value="herbs">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-[#2D5016]">
                  <Leaf className="w-5 h-5" />
                  Saved Herbs
                </CardTitle>
              </CardHeader>
              <CardContent>
                {herbs.length > 0 ? (
                  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {herbs.map((item) => (
                      <WishlistItemCard key={item.id} item={item} onRemove={handleRemove} />
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <Leaf className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500 mb-4">No herbs saved yet</p>
                    <Link to={createPageUrl("ExploreHerbs")}>
                      <Button variant="outline">Browse Herbs</Button>
                    </Link>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Remedies Tab */}
          <TabsContent value="remedies">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-[#2D5016]">
                  <Beaker className="w-5 h-5" />
                  Saved Remedies
                </CardTitle>
              </CardHeader>
              <CardContent>
                {remedies.length > 0 ? (
                  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {remedies.map((item) => (
                      <WishlistItemCard key={item.id} item={item} onRemove={handleRemove} />
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <Beaker className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500 mb-4">No remedies saved yet</p>
                    <Link to={createPageUrl("ExploreRemedies")}>
                      <Button variant="outline">Browse Remedies</Button>
                    </Link>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Products Tab */}
          <TabsContent value="products">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-[#2D5016]">
                  <Package className="w-5 h-5" />
                  Saved Products
                </CardTitle>
              </CardHeader>
              <CardContent>
                {products.length > 0 ? (
                  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {products.map((item) => (
                      <WishlistItemCard key={item.id} item={item} onRemove={handleRemove} />
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500 mb-4">No products saved yet</p>
                    <Link to={createPageUrl("ExploreProducts")}>
                      <Button variant="outline">Browse Products</Button>
                    </Link>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function WishlistItemCard({ item, onRemove }) {
  const getPageUrl = () => {
    switch (item.entity_type) {
      case "Herb":
        return `${createPageUrl("HerbProfile")}?id=${item.entity_id}`;
      case "Remedy":
        return `${createPageUrl("RemedyProfile")}?id=${item.entity_id}`;
      case "Product":
        return `${createPageUrl("ProductProfile")}?id=${item.entity_id}`;
      default:
        return "#";
    }
  };

  return (
    <div className="border rounded-lg overflow-hidden hover:shadow-lg transition-all duration-300 group relative">
      <Link to={getPageUrl()}>
        <div className="h-40 bg-gray-100 relative">
          {item.entity_image_url ? (
            <img 
              src={item.entity_image_url} 
              alt={item.entity_name}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              {item.entity_type === "Herb" && <Leaf className="w-16 h-16 text-gray-300" />}
              {item.entity_type === "Remedy" && <Beaker className="w-16 h-16 text-gray-300" />}
              {item.entity_type === "Product" && <Package className="w-16 h-16 text-gray-300" />}
            </div>
          )}
          <Badge className="absolute top-2 left-2 bg-white/90 text-[#2D5016]">
            {item.entity_type}
          </Badge>
        </div>
        <div className="p-4">
          <h3 className="font-semibold text-[#2D5016] group-hover:text-[#4A7C2E] mb-2 line-clamp-2">
            {item.entity_name}
          </h3>
          {item.entity_metadata && (
            <div className="text-sm text-gray-600 space-y-1">
              {item.entity_metadata.botanical_name && (
                <p className="italic">{item.entity_metadata.botanical_name}</p>
              )}
              {item.entity_metadata.health_condition && (
                <p>For: {item.entity_metadata.health_condition}</p>
              )}
              {item.entity_metadata.price && (
                <p className="font-bold text-lg text-gray-900">
                  {item.entity_metadata.currency || "$"} {item.entity_metadata.price}
                </p>
              )}
            </div>
          )}
        </div>
      </Link>
      <div className="px-4 pb-4 flex gap-2">
        <Link to={getPageUrl()} className="flex-1">
          <Button variant="outline" size="sm" className="w-full">
            <ExternalLink className="w-4 h-4 mr-2" />
            View
          </Button>
        </Link>
        <Button 
          variant="ghost" 
          size="sm"
          onClick={() => onRemove(item.id)}
          className="text-red-500 hover:text-red-700 hover:bg-red-50"
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}

function EmptyWishlist() {
  return (
    <div className="text-center py-16">
      <Heart className="w-20 h-20 text-gray-300 mx-auto mb-6" />
      <h3 className="text-2xl font-semibold text-gray-900 mb-3">Your wishlist is empty</h3>
      <p className="text-gray-600 mb-8 max-w-md mx-auto">
        Start saving herbs, remedies, and products you're interested in. Click the heart icon on any item to add it here.
      </p>
      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        <Link to={createPageUrl("ExploreHerbs")}>
          <Button className="bg-[#4A7C2E] hover:bg-[#2D5016]">
            <Leaf className="w-4 h-4 mr-2" />
            Browse Herbs
          </Button>
        </Link>
        <Link to={createPageUrl("ExploreRemedies")}>
          <Button variant="outline">
            <Beaker className="w-4 h-4 mr-2" />
            Browse Remedies
          </Button>
        </Link>
        <Link to={createPageUrl("ExploreProducts")}>
          <Button variant="outline">
            <Package className="w-4 h-4 mr-2" />
            Browse Products
          </Button>
        </Link>
      </div>
    </div>
  );
}