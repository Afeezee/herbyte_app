import React, { useState } from "react";
import { api } from "@/api/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Legend
} from "recharts";
import { usePageMeta } from "@/lib/usePageMeta";
import {
  Shield, Users, Leaf, Beaker, Package, Calendar, MessageCircle,
  TrendingUp, Eye, Heart, Trash2, CheckCircle, XCircle, Clock,
  Search, AlertTriangle, Store
} from "lucide-react";
import { format } from "date-fns";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";

const COLORS = ['#4A7C2E', '#2D5016', '#6B9F4A', '#8BC34A', '#CDDC39'];

export default function AdminDashboard() {
  usePageMeta({ title: "Admin Dashboard" });
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const queryClient = useQueryClient();

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

  // Fetch all data
  const { data: herbs = [] } = useQuery({
    queryKey: ['admin-herbs'],
    queryFn: () => api.entities.Herb.list('-created_date'),
    enabled: user?.role === 'admin',
  });

  const { data: remedies = [] } = useQuery({
    queryKey: ['admin-remedies'],
    queryFn: () => api.entities.Remedy.list('-created_date'),
    enabled: user?.role === 'admin',
  });

  const { data: products = [] } = useQuery({
    queryKey: ['admin-products'],
    queryFn: () => api.entities.Product.list('-created_date'),
    enabled: user?.role === 'admin',
  });

  const { data: events = [] } = useQuery({
    queryKey: ['admin-events'],
    queryFn: () => api.entities.Event.list('-created_date'),
    enabled: user?.role === 'admin',
  });

  const { data: comments = [] } = useQuery({
    queryKey: ['admin-comments'],
    queryFn: () => api.entities.Comment.list('-created_date'),
    enabled: user?.role === 'admin',
  });

  const { data: users = [] } = useQuery({
    queryKey: ['admin-users'],
    queryFn: () => api.entities.User.list('-created_date'),
    enabled: user?.role === 'admin',
  });

  const { data: sellers = [] } = useQuery({
    queryKey: ['admin-sellers'],
    queryFn: () => api.entities.SellerProfile.list('-created_date'),
    enabled: user?.role === 'admin',
  });

  const { data: wishlists = [] } = useQuery({
    queryKey: ['admin-wishlists'],
    queryFn: () => api.entities.Wishlist.list('-created_date'),
    enabled: user?.role === 'admin',
  });

  // Submissions awaiting admin publish (herb + remedy)
  const { data: herbSubmissions = [] } = useQuery({
    queryKey: ['admin-herb-submissions'],
    queryFn: () => api.entities.HerbSubmission.list('-created_date'),
    enabled: user?.role === 'admin',
  });
  const { data: remedySubmissions = [] } = useQuery({
    queryKey: ['admin-remedy-submissions'],
    queryFn: () => api.entities.RemedySubmission.list('-created_date'),
    enabled: user?.role === 'admin',
  });

  const publishHerbMutation = useMutation({
    mutationFn: (id) => api.submissions.publishHerb(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-herb-submissions'] });
      queryClient.invalidateQueries({ queryKey: ['admin-herbs'] });
    },
    onError: (err) => alert(`Publish failed: ${err?.message ?? 'unknown error'}`),
  });
  const publishRemedyMutation = useMutation({
    mutationFn: (id) => api.submissions.publishRemedy(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-remedy-submissions'] });
      queryClient.invalidateQueries({ queryKey: ['admin-remedies'] });
    },
    onError: (err) => alert(`Publish failed: ${err?.message ?? 'unknown error'}`),
  });
  const rejectHerbSubmissionMutation = useMutation({
    mutationFn: (id) => api.entities.HerbSubmission.update(id, { moderation_status: 'Rejected' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-herb-submissions'] }),
  });
  const rejectRemedySubmissionMutation = useMutation({
    mutationFn: (id) => api.entities.RemedySubmission.update(id, { moderation_status: 'Rejected' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-remedy-submissions'] }),
  });

  // Delete mutations
  const deleteHerbMutation = useMutation({
    mutationFn: (id) => api.entities.Herb.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-herbs'] }),
  });

  const deleteRemedyMutation = useMutation({
    mutationFn: (id) => api.entities.Remedy.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-remedies'] }),
  });

  const deleteProductMutation = useMutation({
    mutationFn: (id) => api.entities.Product.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-products'] }),
  });

  const deleteEventMutation = useMutation({
    mutationFn: (id) => api.entities.Event.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-events'] }),
  });

  const deleteCommentMutation = useMutation({
    mutationFn: (id) => api.entities.Comment.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-comments'] }),
  });

  const updateProductMutation = useMutation({
    mutationFn: ({ id, data }) => api.entities.Product.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-products'] }),
  });

  const updateSellerMutation = useMutation({
    mutationFn: ({ id, data }) => api.entities.SellerProfile.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-sellers'] }),
  });

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Shield className="w-12 h-12 text-[#4A7C2E] animate-pulse" />
      </div>
    );
  }

  if (!user || user.role !== 'admin') {
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center">
            <Shield className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Access Denied</h2>
            <p className="text-gray-600 mb-6">You need admin privileges to access this dashboard.</p>
            <Link to={createPageUrl("Home")}>
              <Button>Go Home</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Analytics data
  const contentByCategory = [
    { name: 'Herbs', value: herbs.length },
    { name: 'Remedies', value: remedies.length },
    { name: 'Products', value: products.length },
    { name: 'Events', value: events.length },
  ];

  const engagementData = [
    { name: 'Comments', value: comments.length },
    { name: 'Wishlists', value: wishlists.length },
    { name: 'Users', value: users.length },
    { name: 'Sellers', value: sellers.length },
  ];

  // Content by region
  const regionData = {};
  [...herbs, ...remedies].forEach(item => {
    const region = item.region || 'Unknown';
    regionData[region] = (regionData[region] || 0) + 1;
  });
  const regionChartData = Object.entries(regionData).map(([name, value]) => ({ name, value }));

  // Recent activity (last 7 days)
  const last7Days = new Date();
  last7Days.setDate(last7Days.getDate() - 7);

  const recentHerbs = herbs.filter(h => new Date(h.created_date) > last7Days).length;
  const recentRemedies = remedies.filter(r => new Date(r.created_date) > last7Days).length;
  const recentComments = comments.filter(c => new Date(c.created_date) > last7Days).length;
  const recentUsers = users.filter(u => new Date(u.created_date) > last7Days).length;

  // Pending approvals
  const pendingProducts = products.filter(p => p.moderation_status === 'Pending');
  const pendingSellers = sellers.filter(s => s.moderation_status === 'Pending');

  return (
    <div className="min-h-screen py-8 bg-gray-50">
      <div className="max-w-7xl mx-auto px-6">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Shield className="w-8 h-8 text-[#4A7C2E]" />
            <h1 className="text-3xl font-bold text-[#2D5016]">Admin Dashboard</h1>
          </div>
          <p className="text-gray-600">Manage content, users, and monitor platform engagement</p>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4 mb-8">
          <Card className="bg-gradient-to-br from-green-500 to-green-600 text-white">
            <CardContent className="p-4 text-center">
              <Leaf className="w-6 h-6 mx-auto mb-2" />
              <p className="text-2xl font-bold">{herbs.length}</p>
              <p className="text-xs opacity-90">Herbs</p>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white">
            <CardContent className="p-4 text-center">
              <Beaker className="w-6 h-6 mx-auto mb-2" />
              <p className="text-2xl font-bold">{remedies.length}</p>
              <p className="text-xs opacity-90">Remedies</p>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-purple-500 to-purple-600 text-white">
            <CardContent className="p-4 text-center">
              <Package className="w-6 h-6 mx-auto mb-2" />
              <p className="text-2xl font-bold">{products.length}</p>
              <p className="text-xs opacity-90">Products</p>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-orange-500 to-orange-600 text-white">
            <CardContent className="p-4 text-center">
              <Calendar className="w-6 h-6 mx-auto mb-2" />
              <p className="text-2xl font-bold">{events.length}</p>
              <p className="text-xs opacity-90">Events</p>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-pink-500 to-pink-600 text-white">
            <CardContent className="p-4 text-center">
              <Users className="w-6 h-6 mx-auto mb-2" />
              <p className="text-2xl font-bold">{users.length}</p>
              <p className="text-xs opacity-90">Users</p>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-teal-500 to-teal-600 text-white">
            <CardContent className="p-4 text-center">
              <Store className="w-6 h-6 mx-auto mb-2" />
              <p className="text-2xl font-bold">{sellers.length}</p>
              <p className="text-xs opacity-90">Sellers</p>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-indigo-500 to-indigo-600 text-white">
            <CardContent className="p-4 text-center">
              <MessageCircle className="w-6 h-6 mx-auto mb-2" />
              <p className="text-2xl font-bold">{comments.length}</p>
              <p className="text-xs opacity-90">Comments</p>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-red-500 to-red-600 text-white">
            <CardContent className="p-4 text-center">
              <Heart className="w-6 h-6 mx-auto mb-2" />
              <p className="text-2xl font-bold">{wishlists.length}</p>
              <p className="text-xs opacity-90">Wishlists</p>
            </CardContent>
          </Card>
        </div>

        {/* Pending Approvals Alert */}
        {(pendingProducts.length > 0 || pendingSellers.length > 0) && (
          <Alert className="mb-6 bg-yellow-50 border-yellow-200">
            <AlertTriangle className="h-4 w-4 text-yellow-600" />
            <AlertDescription className="text-yellow-900">
              <strong>Pending Approvals:</strong> {pendingProducts.length} products and {pendingSellers.length} sellers awaiting review.
            </AlertDescription>
          </Alert>
        )}

        {/* Recent Activity Cards */}
        <div className="grid md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">New Herbs (7 days)</p>
                  <p className="text-2xl font-bold text-[#2D5016]">{recentHerbs}</p>
                </div>
                <TrendingUp className="w-8 h-8 text-green-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">New Remedies (7 days)</p>
                  <p className="text-2xl font-bold text-[#2D5016]">{recentRemedies}</p>
                </div>
                <TrendingUp className="w-8 h-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">New Comments (7 days)</p>
                  <p className="text-2xl font-bold text-[#2D5016]">{recentComments}</p>
                </div>
                <MessageCircle className="w-8 h-8 text-purple-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">New Users (7 days)</p>
                  <p className="text-2xl font-bold text-[#2D5016]">{recentUsers}</p>
                </div>
                <Users className="w-8 h-8 text-pink-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Charts */}
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Content Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={contentByCategory}
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                    label={({ name, value }) => `${name}: ${value}`}
                  >
                    {contentByCategory.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Content by Region</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={regionChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" fontSize={12} />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="value" fill="#4A7C2E" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Management Tabs */}
        <Tabs defaultValue="submissions" className="space-y-6">
          <TabsList className="grid grid-cols-4 md:grid-cols-8 bg-white border">
            <TabsTrigger value="submissions">
              Submissions
              {(herbSubmissions.filter(s => s.moderation_status !== 'Rejected' && !s.published_herb_id).length +
                remedySubmissions.filter(s => s.moderation_status !== 'Rejected' && !s.published_remedy_id).length) > 0 && (
                <span className="ml-1 px-1.5 py-0.5 bg-amber-500 text-white text-xs rounded-full">
                  {herbSubmissions.filter(s => s.moderation_status !== 'Rejected' && !s.published_herb_id).length +
                   remedySubmissions.filter(s => s.moderation_status !== 'Rejected' && !s.published_remedy_id).length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="herbs">Herbs</TabsTrigger>
            <TabsTrigger value="remedies">Remedies</TabsTrigger>
            <TabsTrigger value="products">Products</TabsTrigger>
            <TabsTrigger value="events">Events</TabsTrigger>
            <TabsTrigger value="users">Users</TabsTrigger>
            <TabsTrigger value="sellers">Sellers</TabsTrigger>
            <TabsTrigger value="comments">Comments</TabsTrigger>
          </TabsList>

          {/* Submissions Tab */}
          <TabsContent value="submissions">
            <SubmissionsPanel
              herbSubmissions={herbSubmissions}
              remedySubmissions={remedySubmissions}
              onPublishHerb={(id) => publishHerbMutation.mutate(id)}
              onPublishRemedy={(id) => publishRemedyMutation.mutate(id)}
              onRejectHerb={(id) => rejectHerbSubmissionMutation.mutate(id)}
              onRejectRemedy={(id) => rejectRemedySubmissionMutation.mutate(id)}
              publishingHerbId={publishHerbMutation.isPending ? publishHerbMutation.variables : null}
              publishingRemedyId={publishRemedyMutation.isPending ? publishRemedyMutation.variables : null}
            />
          </TabsContent>

          {/* Herbs Tab */}
          <TabsContent value="herbs">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Manage Herbs ({herbs.length})</CardTitle>
                  <div className="flex items-center gap-2">
                    <Search className="w-4 h-4 text-gray-400" />
                    <Input
                      placeholder="Search herbs..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-64"
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-3">Name</th>
                        <th className="text-left p-3">Category</th>
                        <th className="text-left p-3">Region</th>
                        <th className="text-left p-3">Submitted By</th>
                        <th className="text-left p-3">Created</th>
                        <th className="text-left p-3">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {herbs.filter(h => h.common_name?.toLowerCase().includes(searchQuery.toLowerCase())).slice(0, 20).map(herb => (
                        <tr key={herb.id} className="border-b hover:bg-gray-50">
                          <td className="p-3">
                            <Link to={`${createPageUrl("HerbProfile")}?id=${herb.id}`} className="text-[#4A7C2E] hover:underline font-medium">
                              {herb.common_name}
                            </Link>
                          </td>
                          <td className="p-3"><Badge variant="outline">{herb.category}</Badge></td>
                          <td className="p-3">{herb.region}</td>
                          <td className="p-3 text-sm text-gray-500">{herb.submitted_by || herb.created_by}</td>
                          <td className="p-3 text-sm text-gray-500">{format(new Date(herb.created_date), 'MMM d, yyyy')}</td>
                          <td className="p-3">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-red-500 hover:text-red-700"
                              onClick={() => {
                                if (confirm('Delete this herb?')) deleteHerbMutation.mutate(herb.id);
                              }}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Remedies Tab */}
          <TabsContent value="remedies">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Manage Remedies ({remedies.length})</CardTitle>
                  <div className="flex items-center gap-2">
                    <Search className="w-4 h-4 text-gray-400" />
                    <Input
                      placeholder="Search remedies..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-64"
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-3">Name</th>
                        <th className="text-left p-3">Condition</th>
                        <th className="text-left p-3">Primary Herb</th>
                        <th className="text-left p-3">Submitted By</th>
                        <th className="text-left p-3">Created</th>
                        <th className="text-left p-3">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {remedies.filter(r => r.name?.toLowerCase().includes(searchQuery.toLowerCase())).slice(0, 20).map(remedy => (
                        <tr key={remedy.id} className="border-b hover:bg-gray-50">
                          <td className="p-3">
                            <Link to={`${createPageUrl("RemedyProfile")}?id=${remedy.id}`} className="text-[#4A7C2E] hover:underline font-medium">
                              {remedy.name}
                            </Link>
                          </td>
                          <td className="p-3">{remedy.health_condition}</td>
                          <td className="p-3"><Badge variant="outline">{remedy.primary_herb_name}</Badge></td>
                          <td className="p-3 text-sm text-gray-500">{remedy.submitted_by || remedy.created_by}</td>
                          <td className="p-3 text-sm text-gray-500">{format(new Date(remedy.created_date), 'MMM d, yyyy')}</td>
                          <td className="p-3">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-red-500 hover:text-red-700"
                              onClick={() => {
                                if (confirm('Delete this remedy?')) deleteRemedyMutation.mutate(remedy.id);
                              }}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Products Tab */}
          <TabsContent value="products">
            <Card>
              <CardHeader>
                <CardTitle>Manage Products ({products.length})</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-3">Product</th>
                        <th className="text-left p-3">Seller</th>
                        <th className="text-left p-3">Price</th>
                        <th className="text-left p-3">Status</th>
                        <th className="text-left p-3">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {products.slice(0, 20).map(product => (
                        <tr key={product.id} className="border-b hover:bg-gray-50">
                          <td className="p-3">
                            <Link to={`${createPageUrl("ProductProfile")}?id=${product.id}`} className="text-[#4A7C2E] hover:underline font-medium">
                              {product.product_name}
                            </Link>
                          </td>
                          <td className="p-3">{product.seller_business_name}</td>
                          <td className="p-3">{product.currency} {product.price}</td>
                          <td className="p-3">
                            <Badge className={
                              product.moderation_status === 'Approved' ? 'bg-green-500' :
                              product.moderation_status === 'Pending' ? 'bg-yellow-500' : 'bg-red-500'
                            }>
                              {product.moderation_status}
                            </Badge>
                          </td>
                          <td className="p-3 flex gap-2">
                            {product.moderation_status === 'Pending' && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-green-500 hover:text-green-700"
                                  onClick={() => updateProductMutation.mutate({ id: product.id, data: { moderation_status: 'Approved' } })}
                                >
                                  <CheckCircle className="w-4 h-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-red-500 hover:text-red-700"
                                  onClick={() => updateProductMutation.mutate({ id: product.id, data: { moderation_status: 'Rejected' } })}
                                >
                                  <XCircle className="w-4 h-4" />
                                </Button>
                              </>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-red-500 hover:text-red-700"
                              onClick={() => {
                                if (confirm('Delete this product?')) deleteProductMutation.mutate(product.id);
                              }}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Events Tab */}
          <TabsContent value="events">
            <Card>
              <CardHeader>
                <CardTitle>Manage Events ({events.length})</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-3">Event</th>
                        <th className="text-left p-3">Type</th>
                        <th className="text-left p-3">Date</th>
                        <th className="text-left p-3">Organizer</th>
                        <th className="text-left p-3">Status</th>
                        <th className="text-left p-3">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {events.slice(0, 20).map(event => (
                        <tr key={event.id} className="border-b hover:bg-gray-50">
                          <td className="p-3">
                            <Link to={`${createPageUrl("EventProfile")}?id=${event.id}`} className="text-[#4A7C2E] hover:underline font-medium">
                              {event.title}
                            </Link>
                          </td>
                          <td className="p-3"><Badge variant="outline">{event.event_type}</Badge></td>
                          <td className="p-3">{format(new Date(event.date), 'MMM d, yyyy')}</td>
                          <td className="p-3">{event.organizer_name}</td>
                          <td className="p-3">
                            <Badge className={
                              event.status === 'Upcoming' ? 'bg-green-500' :
                              event.status === 'Ongoing' ? 'bg-blue-500' :
                              event.status === 'Completed' ? 'bg-gray-500' : 'bg-red-500'
                            }>
                              {event.status}
                            </Badge>
                          </td>
                          <td className="p-3">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-red-500 hover:text-red-700"
                              onClick={() => {
                                if (confirm('Delete this event?')) deleteEventMutation.mutate(event.id);
                              }}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Users Tab */}
          <TabsContent value="users">
            <Card>
              <CardHeader>
                <CardTitle>All Users ({users.length})</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-3">Name</th>
                        <th className="text-left p-3">Email</th>
                        <th className="text-left p-3">Role</th>
                        <th className="text-left p-3">Seller</th>
                        <th className="text-left p-3">Joined</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.slice(0, 30).map(u => (
                        <tr key={u.id} className="border-b hover:bg-gray-50">
                          <td className="p-3 font-medium">{u.full_name || 'N/A'}</td>
                          <td className="p-3 text-sm text-gray-600">{u.email}</td>
                          <td className="p-3">
                            <Badge className={u.role === 'admin' ? 'bg-purple-500' : 'bg-gray-500'}>
                              {u.role}
                            </Badge>
                          </td>
                          <td className="p-3">
                            {u.is_seller ? <CheckCircle className="w-4 h-4 text-green-500" /> : <XCircle className="w-4 h-4 text-gray-300" />}
                          </td>
                          <td className="p-3 text-sm text-gray-500">{format(new Date(u.created_date), 'MMM d, yyyy')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Sellers Tab */}
          <TabsContent value="sellers">
            <Card>
              <CardHeader>
                <CardTitle>Seller Profiles ({sellers.length})</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-3">Business Name</th>
                        <th className="text-left p-3">Contact</th>
                        <th className="text-left p-3">Location</th>
                        <th className="text-left p-3">Status</th>
                        <th className="text-left p-3">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sellers.slice(0, 20).map(seller => (
                        <tr key={seller.id} className="border-b hover:bg-gray-50">
                          <td className="p-3 font-medium">{seller.business_name}</td>
                          <td className="p-3 text-sm text-gray-600">{seller.contact_email}</td>
                          <td className="p-3">{seller.location || 'N/A'}</td>
                          <td className="p-3">
                            <Badge className={
                              seller.moderation_status === 'Approved' ? 'bg-green-500' :
                              seller.moderation_status === 'Pending' ? 'bg-yellow-500' : 'bg-red-500'
                            }>
                              {seller.moderation_status}
                            </Badge>
                          </td>
                          <td className="p-3 flex gap-2">
                            {seller.moderation_status === 'Pending' && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-green-500 hover:text-green-700"
                                  onClick={() => updateSellerMutation.mutate({ id: seller.id, data: { moderation_status: 'Approved' } })}
                                >
                                  <CheckCircle className="w-4 h-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-red-500 hover:text-red-700"
                                  onClick={() => updateSellerMutation.mutate({ id: seller.id, data: { moderation_status: 'Rejected' } })}
                                >
                                  <XCircle className="w-4 h-4" />
                                </Button>
                              </>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Comments Tab */}
          <TabsContent value="comments">
            <Card>
              <CardHeader>
                <CardTitle>Recent Comments ({comments.length})</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {comments.slice(0, 20).map(comment => (
                    <div key={comment.id} className="border rounded-lg p-4 hover:bg-gray-50">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="font-medium">{comment.author_name}</span>
                            <span className="text-xs text-gray-500">on {comment.entity_type}: {comment.entity_name}</span>
                            <span className="text-xs text-gray-400">{format(new Date(comment.created_date), 'MMM d, yyyy')}</span>
                          </div>
                          <p className="text-gray-700 text-sm">{comment.content}</p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-500 hover:text-red-700"
                          onClick={() => {
                            if (confirm('Delete this comment?')) deleteCommentMutation.mutate(comment.id);
                          }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SubmissionsPanel — reviews pending herb/remedy submissions, shows the
// AI's enrichment draft, and lets an admin Publish (creates the real
// herbs/remedies row via POST /api/submissions/{herb,remedy}/:id/publish)
// or Reject (marks the submission moderation_status so it stays out of
// the queue).
// ---------------------------------------------------------------------------

function SubmissionsPanel({
  herbSubmissions,
  remedySubmissions,
  onPublishHerb,
  onPublishRemedy,
  onRejectHerb,
  onRejectRemedy,
  publishingHerbId,
  publishingRemedyId,
}) {
  const pendingHerbs = herbSubmissions.filter(s => !s.published_herb_id && s.moderation_status !== 'Rejected');
  const pendingRemedies = remedySubmissions.filter(s => !s.published_remedy_id && s.moderation_status !== 'Rejected');

  return (
    <div className="space-y-6">
      <Alert className="bg-amber-50 border-amber-200">
        <AlertTriangle className="w-4 h-4 text-amber-700" />
        <AlertDescription className="text-amber-900">
          <strong>Human-in-the-loop publishing.</strong> AI moderation runs on
          every submission but no entry becomes public until an admin clicks
          Publish here. Review the AI's draft, open the submitter's note and
          the AI feedback, then approve or reject.
        </AlertDescription>
      </Alert>

      <Tabs defaultValue="remedies-sub">
        <TabsList className="bg-white border">
          <TabsTrigger value="remedies-sub">Remedies ({pendingRemedies.length})</TabsTrigger>
          <TabsTrigger value="herbs-sub">Herbs ({pendingHerbs.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="remedies-sub">
          <Card>
            <CardContent className="p-6">
              {pendingRemedies.length === 0 ? (
                <p className="text-gray-500 text-center py-10">No remedy submissions awaiting review.</p>
              ) : (
                <div className="space-y-4">
                  {pendingRemedies.map((s) => (
                    <SubmissionRow
                      key={s.id}
                      sub={s}
                      kind="remedy"
                      onPublish={() => onPublishRemedy(s.id)}
                      onReject={() => onRejectRemedy(s.id)}
                      isPublishing={publishingRemedyId === s.id}
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="herbs-sub">
          <Card>
            <CardContent className="p-6">
              {pendingHerbs.length === 0 ? (
                <p className="text-gray-500 text-center py-10">No herb submissions awaiting review.</p>
              ) : (
                <div className="space-y-4">
                  {pendingHerbs.map((s) => (
                    <SubmissionRow
                      key={s.id}
                      sub={s}
                      kind="herb"
                      onPublish={() => onPublishHerb(s.id)}
                      onReject={() => onRejectHerb(s.id)}
                      isPublishing={publishingHerbId === s.id}
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function statusBadge(status) {
  if (status === 'Approved') return 'bg-green-500';
  if (status === 'Rejected') return 'bg-red-500';
  if (status === 'Flagged - Risk Identified') return 'bg-orange-500';
  return 'bg-yellow-500'; // Pending Review
}

function SubmissionRow({ sub, kind, onPublish, onReject, isPublishing }) {
  const [expanded, setExpanded] = useState(false);
  const draft = sub.draft_payload ?? null;
  const title = kind === 'herb'
    ? (draft?.common_name ?? sub.common_name ?? '(no name)')
    : (draft?.name ?? sub.health_condition ?? '(no name)');
  const canPublish = sub.ready_to_publish === true && !!draft;

  return (
    <div className="border rounded-lg p-4 bg-white">
      <div className="flex items-start justify-between gap-4">
        <div className="flex gap-4 flex-1 min-w-0">
          {(draft?.image_url || sub.image_url) && (
            <img
              src={draft?.image_url ?? sub.image_url}
              alt={title}
              className="w-20 h-20 object-cover rounded"
            />
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <h4 className="font-semibold text-[#2D5016] truncate">{title}</h4>
              <Badge className={`${statusBadge(sub.moderation_status)} text-white text-xs`}>
                {sub.moderation_status}
              </Badge>
              {sub.risk_level && (
                <Badge variant="outline" className="text-xs">risk: {sub.risk_level}</Badge>
              )}
              {sub.expert_review_required && (
                <Badge variant="outline" className="text-xs bg-amber-50 text-amber-900 border-amber-300">
                  expert review
                </Badge>
              )}
            </div>
            <p className="text-sm text-gray-500 mb-1">
              Submitter: {sub.submitter_name || sub.created_by} ·
              {' '}{sub.created_date ? format(new Date(sub.created_date), 'd MMM yyyy, HH:mm') : ''}
            </p>
            {sub.ai_feedback && (
              <p className="text-sm text-gray-700 line-clamp-2">
                <span className="font-medium">AI:</span> {sub.ai_feedback}
              </p>
            )}
          </div>
        </div>
        <div className="flex flex-col gap-2 shrink-0">
          <Button
            size="sm"
            disabled={!canPublish || isPublishing}
            className="bg-[#4A7C2E] hover:bg-[#2D5016] text-white"
            onClick={onPublish}
            title={canPublish ? '' : 'AI did not approve — review the draft before publishing'}
          >
            {isPublishing ? '…' : 'Publish'}
          </Button>
          <Button size="sm" variant="outline" onClick={() => setExpanded(e => !e)}>
            {expanded ? 'Hide draft' : 'View draft'}
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="text-red-700 hover:bg-red-50"
            onClick={onReject}
          >
            Reject
          </Button>
        </div>
      </div>

      {expanded && (
        <div className="mt-4 pt-4 border-t text-sm space-y-2">
          {draft ? (
            <>
              {kind === 'herb' ? (
                <>
                  <KV label="Botanical name" value={draft.botanical_name} />
                  <KV label="Region" value={draft.region} />
                  <KV label="Category" value={draft.category} />
                  <KV label="Safety rating" value={draft.safety_rating} />
                  <KV label="Description" value={draft.description} />
                  <KV label="Dosage" value={draft.dosage} />
                  <KVList label="Drug interactions" items={draft.drug_interactions} />
                  <KVList label="Contraindications" value={draft.contraindications} items={draft.contraindications} />
                  <KVList label="Side effects" items={draft.side_effects} />
                  <KVList label="References" items={draft.research_references?.map(r => `${r.title} — ${r.url}`) ?? []} />
                </>
              ) : (
                <>
                  <KV label="Primary herb" value={draft.primary_herb_name} />
                  <KV label="Health condition" value={draft.health_condition} />
                  <KV label="Region" value={draft.region} />
                  <KV label="Category" value={draft.category} />
                  <KV label="Safety rating" value={draft.safety_rating} />
                  <KV label="Preparation" value={draft.preparation_method} />
                  <KV label="Dosage" value={draft.dosage} />
                  <KV label="Duration" value={draft.duration_of_use} />
                  <KV label="Description" value={draft.description} />
                  <KVList label="Drug interactions" items={draft.drug_interactions} />
                  <KVList label="Contraindications" items={draft.contraindications} />
                  <KVList label="Side effects" items={draft.side_effects} />
                  <KVList label="References" items={draft.research_references?.map(r => `${r.title} — ${r.url}`) ?? []} />
                </>
              )}
            </>
          ) : (
            <p className="text-gray-500">
              No AI draft on this submission — it was deferred (budget exhausted or AI failure).
              You can still Reject it or re-trigger via re-submission.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function KV({ label, value }) {
  if (value === undefined || value === null || value === '') return null;
  return (
    <div><span className="font-medium text-gray-700">{label}:</span> <span className="text-gray-800">{String(value)}</span></div>
  );
}

function KVList({ label, items }) {
  if (!items || items.length === 0) return null;
  return (
    <div>
      <div className="font-medium text-gray-700">{label}:</div>
      <ul className="list-disc pl-5 text-gray-800">
        {items.map((it, i) => <li key={i}>{it}</li>)}
      </ul>
    </div>
  );
}