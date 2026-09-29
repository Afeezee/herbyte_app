import React, { useState } from "react";
import { api } from "@/api/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  User, MessageCircle, Leaf, Beaker, Package, Shield,
  Calendar, Mail, ExternalLink, Store, Edit, Trash2, Heart, TrendingUp
} from "lucide-react";
import { usePageMeta } from "@/lib/usePageMeta";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { format } from "date-fns";

export default function UserProfile() {
  usePageMeta({ title: "Your Profile" });
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

  // Fetch user's comments
  const { data: comments, isLoading: commentsLoading } = useQuery({
    queryKey: ['user-comments', user?.email],
    queryFn: async () => {
      if (!user?.email) return [];
      return await api.entities.Comment.filter({ author_email: user.email }, '-created_date');
    },
    enabled: !!user?.email,
    initialData: [],
  });

  // Fetch user's herbs
  const { data: herbs, isLoading: herbsLoading } = useQuery({
    queryKey: ['user-herbs', user?.email],
    queryFn: async () => {
      if (!user?.email) return [];
      const allHerbs = await api.entities.Herb.list();
      return allHerbs.filter(herb => herb.created_by === user.email);
    },
    enabled: !!user?.email,
    initialData: [],
  });

  // Fetch user's remedies
  const { data: remedies, isLoading: remediesLoading } = useQuery({
    queryKey: ['user-remedies', user?.email],
    queryFn: async () => {
      if (!user?.email) return [];
      const allRemedies = await api.entities.Remedy.list();
      return allRemedies.filter(remedy => remedy.created_by === user.email);
    },
    enabled: !!user?.email,
    initialData: [],
  });

  // Fetch seller profile if user is a seller
  const { data: sellerProfile, isLoading: sellerLoading } = useQuery({
    queryKey: ['seller-profile', user?.seller_profile_id],
    queryFn: async () => {
      if (!user?.seller_profile_id) return null;
      const profiles = await api.entities.SellerProfile.filter({ id: user.seller_profile_id });
      return profiles[0];
    },
    enabled: !!user?.seller_profile_id,
  });

  // Fetch user's products if they are a seller
  const { data: products, isLoading: productsLoading } = useQuery({
    queryKey: ['user-products', sellerProfile?.id],
    queryFn: async () => {
      if (!sellerProfile?.id) return [];
      return await api.entities.Product.filter({ seller_id: sellerProfile.id });
    },
    enabled: !!sellerProfile?.id,
    initialData: [],
  });

  // Fetch user's wishlist for stats
  const { data: wishlistItems } = useQuery({
    queryKey: ['user-wishlist-stats', user?.email],
    queryFn: async () => {
      if (!user?.email) return [];
      return await api.entities.Wishlist.filter({ user_email: user.email });
    },
    enabled: !!user?.email,
    initialData: [],
  });

  // Delete mutations
  const deleteHerbMutation = useMutation({
    mutationFn: (id) => api.entities.Herb.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-herbs'] });
      alert("Herb deleted successfully!");
    },
  });

  const deleteRemedyMutation = useMutation({
    mutationFn: (id) => api.entities.Remedy.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-remedies'] });
      alert("Remedy deleted successfully!");
    },
  });

  const deleteProductMutation = useMutation({
    mutationFn: (id) => api.entities.Product.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-products'] });
      alert("Product deleted successfully!");
    },
  });

  const handleDeleteHerb = (id, name) => {
    if (window.confirm(`Are you sure you want to delete "${name}"? This action cannot be undone.`)) {
      deleteHerbMutation.mutate(id);
    }
  };

  const handleDeleteRemedy = (id, name) => {
    if (window.confirm(`Are you sure you want to delete "${name}"? This action cannot be undone.`)) {
      deleteRemedyMutation.mutate(id);
    }
  };

  const handleDeleteProduct = (id, name) => {
    if (window.confirm(`Are you sure you want to delete "${name}"? This action cannot be undone.`)) {
      deleteProductMutation.mutate(id);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-600">Loading profile...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center">
            <User className="w-12 h-12 text-[#4A7C2E] mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Sign In Required</h2>
            <p className="text-gray-600 mb-6">
              You need to be signed in to view your profile.
            </p>
            <Button onClick={() => api.auth.redirectToLogin(window.location.href)}>
              Sign In
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const totalContributions = comments.length + herbs.length + remedies.length + products.length;
  const totalReplies = comments.filter(c => c.parent_comment_id).length;
  const totalParentComments = comments.filter(c => !c.parent_comment_id).length;

  return (
    <div className="min-h-screen py-12">
      <div className="max-w-7xl mx-auto px-6">
        {/* Profile Header */}
        <Card className="mb-8 bg-gradient-to-br from-[#2D5016] to-[#4A7C2E] text-white">
          <CardContent className="p-8">
            <div className="flex items-start gap-6">
              <div className="w-20 h-20 bg-white/10 rounded-full flex items-center justify-center flex-shrink-0">
                <User className="w-10 h-10 text-white" />
              </div>
              <div className="flex-1">
                <h1 className="text-3xl font-bold mb-2">{user.full_name || "User"}</h1>
                <div className="flex flex-wrap gap-3 mb-4">
                  <Badge className="bg-white/20 text-white border-0">
                    <Mail className="w-3 h-3 mr-1" />
                    {user.email}
                  </Badge>
                  {user.role === "admin" && (
                    <Badge className="bg-yellow-500 text-white border-0">
                      <Shield className="w-3 h-3 mr-1" />
                      Admin
                    </Badge>
                  )}
                  {user.is_seller && (
                    <Badge className="bg-green-500 text-white border-0">
                      <Store className="w-3 h-3 mr-1" />
                      Seller
                    </Badge>
                  )}
                </div>
                <p className="text-white/80">
                  Member since {format(new Date(user.created_date || Date.now()), 'MMMM yyyy')}
                </p>
              </div>
              <div className="text-center">
                <div className="text-4xl font-bold">{totalContributions}</div>
                <p className="text-white/80 text-sm">Total Contributions</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Stats Cards */}
        <div className="grid md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardContent className="p-6 text-center">
              <MessageCircle className="w-8 h-8 text-[#4A7C2E] mx-auto mb-2" />
              <div className="text-3xl font-bold text-gray-900">{totalParentComments}</div>
              <p className="text-sm text-gray-600">Comments</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6 text-center">
              <TrendingUp className="w-8 h-8 text-blue-500 mx-auto mb-2" />
              <div className="text-3xl font-bold text-gray-900">{totalReplies}</div>
              <p className="text-sm text-gray-600">Replies</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6 text-center">
              <Heart className="w-8 h-8 text-red-500 mx-auto mb-2" />
              <div className="text-3xl font-bold text-gray-900">{wishlistItems.length}</div>
              <p className="text-sm text-gray-600">Saved Items</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6 text-center">
              <Leaf className="w-8 h-8 text-green-500 mx-auto mb-2" />
              <div className="text-3xl font-bold text-gray-900">{herbs.length + remedies.length}</div>
              <p className="text-sm text-gray-600">Knowledge Shared</p>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="comments" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4 bg-white border">
            <TabsTrigger value="comments">
              <MessageCircle className="w-4 h-4 mr-2" />
              Comments ({comments.length})
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

          {/* Comments Tab */}
          <TabsContent value="comments">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-[#2D5016]">
                  <MessageCircle className="w-5 h-5" />
                  Your Comments & Replies
                </CardTitle>
              </CardHeader>
              <CardContent>
                {commentsLoading ? (
                  <p className="text-gray-500 text-center py-8">Loading...</p>
                ) : comments.length > 0 ? (
                  <div className="space-y-4">
                    {comments.map((comment) => (
                      <div key={comment.id} className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
                        <div className="flex items-start justify-between gap-4 mb-2">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="bg-[#4A7C2E]/5 text-[#2D5016]">
                              {comment.entity_type}
                            </Badge>
                            {comment.parent_comment_id && (
                              <Badge variant="outline" className="bg-blue-50 text-blue-700">
                                Reply
                              </Badge>
                            )}
                            <span className="text-sm text-gray-500">
                              {format(new Date(comment.created_date), 'MMM d, yyyy')}
                            </span>
                          </div>
                        </div>
                        <p className="text-sm text-gray-600 mb-2">
                          {comment.parent_comment_id ? "Replied on" : "Commented on"}: <span className="font-medium text-[#2D5016]">{comment.entity_name}</span>
                        </p>
                        <p className="text-gray-700 leading-relaxed">{comment.content}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 text-center py-12">
                    You haven't commented yet. Start engaging with the community!
                  </p>
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
                  Herbs You've Contributed
                </CardTitle>
              </CardHeader>
              <CardContent>
                {herbsLoading ? (
                  <p className="text-gray-500 text-center py-8">Loading...</p>
                ) : herbs.length > 0 ? (
                  <div className="grid md:grid-cols-2 gap-4">
                    {herbs.map((herb) => (
                      <div key={herb.id} className="border rounded-lg p-4 hover:shadow-md transition-all group">
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <Link to={`${createPageUrl("HerbProfile")}?id=${herb.id}`} className="flex-1">
                            <h3 className="font-semibold text-[#2D5016] group-hover:text-[#4A7C2E]">
                              {herb.common_name}
                            </h3>
                          </Link>
                          <div className="flex gap-1">
                            <Link to={`${createPageUrl("HerbProfile")}?id=${herb.id}`}>
                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                <ExternalLink className="w-4 h-4 text-gray-400 group-hover:text-[#4A7C2E]" />
                              </Button>
                            </Link>
                            <Button 
                              variant="ghost" 
                              size="sm"
                              className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                              onClick={() => handleDeleteHerb(herb.id, herb.common_name)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                        <p className="text-sm italic text-gray-600 mb-2">{herb.botanical_name}</p>
                        <p className="text-xs text-gray-500 line-clamp-2">{herb.description}</p>
                        <div className="mt-3 flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">{herb.category}</Badge>
                          <span className="text-xs text-gray-500">
                            {format(new Date(herb.created_date), 'MMM d, yyyy')}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <p className="text-gray-500 mb-4">You haven't contributed any herbs yet.</p>
                    <Link to={createPageUrl("SubmitRemedy")}>
                      <Button className="bg-[#4A7C2E] hover:bg-[#2D5016]">
                        <Leaf className="w-4 h-4 mr-2" />
                        Submit an Herb
                      </Button>
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
                  Remedies You've Contributed
                </CardTitle>
              </CardHeader>
              <CardContent>
                {remediesLoading ? (
                  <p className="text-gray-500 text-center py-8">Loading...</p>
                ) : remedies.length > 0 ? (
                  <div className="grid md:grid-cols-2 gap-4">
                    {remedies.map((remedy) => (
                      <div key={remedy.id} className="border rounded-lg p-4 hover:shadow-md transition-all group">
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <Link to={`${createPageUrl("RemedyProfile")}?id=${remedy.id}`} className="flex-1">
                            <h3 className="font-semibold text-[#2D5016] group-hover:text-[#4A7C2E]">
                              {remedy.name}
                            </h3>
                          </Link>
                          <div className="flex gap-1">
                            <Link to={`${createPageUrl("RemedyProfile")}?id=${remedy.id}`}>
                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                <ExternalLink className="w-4 h-4 text-gray-400 group-hover:text-[#4A7C2E]" />
                              </Button>
                            </Link>
                            <Button 
                              variant="ghost" 
                              size="sm"
                              className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                              onClick={() => handleDeleteRemedy(remedy.id, remedy.name)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                        <p className="text-sm text-gray-600 mb-2">For: {remedy.health_condition}</p>
                        <p className="text-xs text-gray-500 line-clamp-2">{remedy.description}</p>
                        <div className="mt-3 flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">{remedy.category}</Badge>
                          <span className="text-xs text-gray-500">
                            {format(new Date(remedy.created_date), 'MMM d, yyyy')}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <p className="text-gray-500 mb-4">You haven't contributed any remedies yet.</p>
                    <Link to={createPageUrl("SubmitRemedy")}>
                      <Button className="bg-[#4A7C2E] hover:bg-[#2D5016]">
                        <Beaker className="w-4 h-4 mr-2" />
                        Submit a Remedy
                      </Button>
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
                  Your Products
                </CardTitle>
              </CardHeader>
              <CardContent>
                {productsLoading ? (
                  <p className="text-gray-500 text-center py-8">Loading...</p>
                ) : products.length > 0 ? (
                  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {products.map((product) => (
                      <div key={product.id} className="border rounded-lg overflow-hidden hover:shadow-md transition-all group">
                        <div className="h-32 bg-gray-100 relative">
                          {product.image_urls && product.image_urls.length > 0 ? (
                            <img src={product.image_urls[0]} alt={product.product_name} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <Package className="w-12 h-12 text-gray-300" />
                            </div>
                          )}
                          <div className="absolute top-2 right-2 flex gap-1">
                            <Link to={`${createPageUrl("ProductProfile")}?id=${product.id}`}>
                              <Button variant="secondary" size="sm" className="h-7 w-7 p-0">
                                <ExternalLink className="w-3 h-3" />
                              </Button>
                            </Link>
                            <Button 
                              variant="secondary"
                              size="sm"
                              className="h-7 w-7 p-0 bg-red-500 hover:bg-red-600 text-white"
                              onClick={() => handleDeleteProduct(product.id, product.product_name)}
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                        </div>
                        <div className="p-4">
                          <h3 className="font-semibold text-[#2D5016] group-hover:text-[#4A7C2E] mb-2">
                            {product.product_name}
                          </h3>
                          <p className="text-lg font-bold text-gray-900 mb-2">
                            {product.currency} {product.price.toFixed(2)}
                          </p>
                          <div className="flex items-center gap-2">
                            <Badge className={
                              product.moderation_status === "Approved" ? "bg-green-500 text-white" :
                              product.moderation_status === "Pending" ? "bg-yellow-500 text-white" :
                              "bg-red-500 text-white"
                            }>
                              {product.moderation_status}
                            </Badge>
                            <span className="text-xs text-gray-500">
                              {format(new Date(product.created_date), 'MMM d, yyyy')}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <p className="text-gray-500 mb-4">
                      {user.is_seller 
                        ? "You haven't added any products yet." 
                        : "You need to become a seller to add products."}
                    </p>
                    <Link to={createPageUrl("SellerDashboard")}>
                      <Button className="bg-[#4A7C2E] hover:bg-[#2D5016]">
                        <Store className="w-4 h-4 mr-2" />
                        {user.is_seller ? "Add Products" : "Become a Seller"}
                      </Button>
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