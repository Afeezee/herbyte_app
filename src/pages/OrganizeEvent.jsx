import React, { useState } from "react";
import { api } from "@/api/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Calendar, Upload, X, CheckCircle, Info } from "lucide-react";
import { usePageMeta } from "@/lib/usePageMeta";

export default function OrganizeEvent() {
  usePageMeta({ title: "Organize an Event" });
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    event_type: "Workshop",
    date: "",
    start_time: "",
    end_time: "",
    location_type: "In-Person",
    location_address: "",
    city: "",
    country: "",
    organizer_name: "",
    organizer_email: "",
    organizer_phone: "",
    max_attendees: "",
    registration_required: false,
    registration_link: "",
    is_free: true,
    price: "",
    currency: "USD",
    topics_covered: "",
    benefits: "",
    target_audience: "",
    status: "Upcoming"
  });

  const [uploadedImage, setUploadedImage] = useState(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [submissionComplete, setSubmissionComplete] = useState(false);
  const [createdEventId, setCreatedEventId] = useState(null);

  React.useEffect(() => {
    const fetchUser = async () => {
      try {
        const currentUser = await api.auth.me();
        setUser(currentUser);
        setFormData(prev => ({
          ...prev,
          organizer_name: currentUser.full_name || "",
          organizer_email: currentUser.email || ""
        }));
      } catch (error) {
        console.error("User not logged in");
      }
      setLoading(false);
    };
    fetchUser();
  }, []);

  const createEventMutation = useMutation({
    mutationFn: (eventData) => api.entities.Event.create(eventData),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      setCreatedEventId(data.id);
      setSubmissionComplete(true);
    },
  });

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploadingImage(true);
    try {
      const { file_url } = await api.integrations.Core.UploadFile({ file });
      setUploadedImage(file_url);
    } catch (error) {
      console.error("Image upload error:", error);
      alert("Failed to upload image. Please try again.");
    }
    setUploadingImage(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!user) {
      api.auth.redirectToLogin(window.location.href);
      return;
    }

    const eventData = {
      ...formData,
      topics_covered: formData.topics_covered ? formData.topics_covered.split(',').map(t => t.trim()) : [],
      benefits: formData.benefits ? formData.benefits.split('\n').filter(b => b.trim()) : [],
      max_attendees: formData.max_attendees ? parseInt(formData.max_attendees) : null,
      price: formData.is_free ? null : parseFloat(formData.price),
      image_url: uploadedImage || "https://images.unsplash.com/photo-1505751172876-fa1923c5c528?w=800&h=600&fit=crop",
      featured: false
    };

    createEventMutation.mutate(eventData);
  };

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
            <Calendar className="w-12 h-12 text-[#4A7C2E] mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Sign In Required</h2>
            <p className="text-gray-600 mb-6">
              You need to be signed in to organize events on Herbyte.
            </p>
            <Button 
              onClick={() => api.auth.redirectToLogin(window.location.href)}
              className="bg-[#4A7C2E] hover:bg-[#2D5016]"
            >
              Sign In to Continue
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (submissionComplete) {
    return (
      <div className="min-h-screen py-12">
        <div className="max-w-2xl mx-auto px-6">
          <Card>
            <CardContent className="p-8 text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckCircle className="w-10 h-10 text-green-600" />
              </div>
              
              <h2 className="text-3xl font-bold text-[#2D5016] mb-4">
                Event Created Successfully!
              </h2>
              
              <p className="text-gray-700 mb-8">
                Your event has been published and is now visible to the Herbyte community.
              </p>

              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Button onClick={() => window.location.href = `/eventprofile?id=${createdEventId}`}>
                  View Event
                </Button>
                <Button 
                  variant="outline"
                  onClick={() => {
                    setSubmissionComplete(false);
                    setCreatedEventId(null);
                    setUploadedImage(null);
                    setFormData({
                      title: "",
                      description: "",
                      event_type: "Workshop",
                      date: "",
                      start_time: "",
                      end_time: "",
                      location_type: "In-Person",
                      location_address: "",
                      city: "",
                      country: "",
                      organizer_name: user.full_name || "",
                      organizer_email: user.email || "",
                      organizer_phone: "",
                      max_attendees: "",
                      registration_required: false,
                      registration_link: "",
                      is_free: true,
                      price: "",
                      currency: "USD",
                      topics_covered: "",
                      benefits: "",
                      target_audience: "",
                      status: "Upcoming"
                    });
                  }}
                >
                  Create Another Event
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-12">
      <div className="max-w-4xl mx-auto px-6">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-[#2D5016] mb-4">
            Organize an Event
          </h1>
          <p className="text-lg text-gray-600">
            Share your herbal medicine knowledge with the community. Create workshops, webinars, or gatherings.
          </p>
        </div>

        <Alert className="mb-8 bg-blue-50 border-blue-200">
          <Info className="h-4 w-4 text-blue-600" />
          <AlertDescription className="text-blue-900">
            <strong>Promote Herbal Medicine!</strong> Events help build community, share knowledge, and grow the herbal medicine movement.
          </AlertDescription>
        </Alert>

        <Card>
          <CardHeader>
            <CardTitle className="text-2xl text-[#2D5016]">Event Details</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Event Image */}
              <div>
                <Label>Event Image</Label>
                <div className="mt-2">
                  {uploadedImage ? (
                    <div className="relative">
                      <img src={uploadedImage} alt="Event" className="w-full h-48 object-cover rounded-lg" />
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        className="absolute top-2 right-2"
                        onClick={() => setUploadedImage(null)}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ) : (
                    <div className="border-2 border-dashed rounded-lg p-8 text-center">
                      <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                      <Input
                        type="file"
                        accept="image/*"
                        onChange={handleImageUpload}
                        disabled={uploadingImage}
                        className="max-w-xs mx-auto"
                      />
                      {uploadingImage && <p className="text-sm text-gray-500 mt-2">Uploading...</p>}
                    </div>
                  )}
                </div>
              </div>

              {/* Title */}
              <div>
                <Label htmlFor="title">Event Title *</Label>
                <Input
                  id="title"
                  required
                  value={formData.title}
                  onChange={(e) => setFormData({...formData, title: e.target.value})}
                  placeholder="e.g., Introduction to Herbal Medicine Workshop"
                  className="mt-2"
                />
              </div>

              {/* Description */}
              <div>
                <Label htmlFor="description">Event Description *</Label>
                <Textarea
                  id="description"
                  required
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                  placeholder="Provide a detailed description of your event"
                  rows={6}
                  className="mt-2"
                />
              </div>

              {/* Event Type */}
              <div>
                <Label htmlFor="event_type">Event Type *</Label>
                <select
                  id="event_type"
                  required
                  value={formData.event_type}
                  onChange={(e) => setFormData({...formData, event_type: e.target.value})}
                  className="mt-2 w-full border rounded-md p-2"
                >
                  <option value="Workshop">Workshop</option>
                  <option value="Webinar">Webinar</option>
                  <option value="Conference">Conference</option>
                  <option value="Community Gathering">Community Gathering</option>
                  <option value="Plant Walk">Plant Walk</option>
                  <option value="Wellness Fair">Wellness Fair</option>
                  <option value="Education Session">Education Session</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              {/* Date and Time */}
              <div className="grid md:grid-cols-3 gap-6">
                <div>
                  <Label htmlFor="date">Date *</Label>
                  <Input
                    id="date"
                    type="date"
                    required
                    value={formData.date}
                    onChange={(e) => setFormData({...formData, date: e.target.value})}
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label htmlFor="start_time">Start Time *</Label>
                  <Input
                    id="start_time"
                    type="time"
                    required
                    value={formData.start_time}
                    onChange={(e) => setFormData({...formData, start_time: e.target.value})}
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label htmlFor="end_time">End Time</Label>
                  <Input
                    id="end_time"
                    type="time"
                    value={formData.end_time}
                    onChange={(e) => setFormData({...formData, end_time: e.target.value})}
                    className="mt-2"
                  />
                </div>
              </div>

              {/* Location Type */}
              <div>
                <Label htmlFor="location_type">Location Type *</Label>
                <select
                  id="location_type"
                  required
                  value={formData.location_type}
                  onChange={(e) => setFormData({...formData, location_type: e.target.value})}
                  className="mt-2 w-full border rounded-md p-2"
                >
                  <option value="In-Person">In-Person</option>
                  <option value="Virtual">Virtual</option>
                  <option value="Hybrid">Hybrid (In-Person & Virtual)</option>
                </select>
              </div>

              {/* Location Details */}
              {formData.location_type !== "Virtual" && (
                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <Label htmlFor="city">City *</Label>
                    <Input
                      id="city"
                      required
                      value={formData.city}
                      onChange={(e) => setFormData({...formData, city: e.target.value})}
                      placeholder="City"
                      className="mt-2"
                    />
                  </div>
                  <div>
                    <Label htmlFor="country">Country *</Label>
                    <Input
                      id="country"
                      required
                      value={formData.country}
                      onChange={(e) => setFormData({...formData, country: e.target.value})}
                      placeholder="Country"
                      className="mt-2"
                    />
                  </div>
                </div>
              )}

              <div>
                <Label htmlFor="location_address">
                  {formData.location_type === "Virtual" ? "Virtual Meeting Link" : "Address"}
                </Label>
                <Input
                  id="location_address"
                  value={formData.location_address}
                  onChange={(e) => setFormData({...formData, location_address: e.target.value})}
                  placeholder={formData.location_type === "Virtual" ? "e.g., Zoom link" : "Street address"}
                  className="mt-2"
                />
              </div>

              {/* Organizer Info */}
              <div className="border-t pt-6">
                <h3 className="font-semibold text-lg text-[#2D5016] mb-4">Organizer Information</h3>
                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <Label htmlFor="organizer_name">Your Name *</Label>
                    <Input
                      id="organizer_name"
                      required
                      value={formData.organizer_name}
                      onChange={(e) => setFormData({...formData, organizer_name: e.target.value})}
                      className="mt-2"
                    />
                  </div>
                  <div>
                    <Label htmlFor="organizer_email">Email *</Label>
                    <Input
                      id="organizer_email"
                      type="email"
                      required
                      value={formData.organizer_email}
                      onChange={(e) => setFormData({...formData, organizer_email: e.target.value})}
                      className="mt-2"
                    />
                  </div>
                </div>
                <div className="mt-4">
                  <Label htmlFor="organizer_phone">Phone (Optional)</Label>
                  <Input
                    id="organizer_phone"
                    value={formData.organizer_phone}
                    onChange={(e) => setFormData({...formData, organizer_phone: e.target.value})}
                    placeholder="Contact number"
                    className="mt-2"
                  />
                </div>
              </div>

              {/* Registration & Pricing */}
              <div className="border-t pt-6">
                <h3 className="font-semibold text-lg text-[#2D5016] mb-4">Registration & Pricing</h3>
                
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="registration_required"
                      checked={formData.registration_required}
                      onChange={(e) => setFormData({...formData, registration_required: e.target.checked})}
                      className="w-4 h-4"
                    />
                    <Label htmlFor="registration_required">Registration Required</Label>
                  </div>

                  {formData.registration_required && (
                    <div>
                      <Label htmlFor="registration_link">Registration Link</Label>
                      <Input
                        id="registration_link"
                        value={formData.registration_link}
                        onChange={(e) => setFormData({...formData, registration_link: e.target.value})}
                        placeholder="https://..."
                        className="mt-2"
                      />
                    </div>
                  )}

                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="is_free"
                      checked={formData.is_free}
                      onChange={(e) => setFormData({...formData, is_free: e.target.checked})}
                      className="w-4 h-4"
                    />
                    <Label htmlFor="is_free">Free Event</Label>
                  </div>

                  {!formData.is_free && (
                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="price">Price *</Label>
                        <Input
                          id="price"
                          type="number"
                          step="0.01"
                          required={!formData.is_free}
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
                          placeholder="USD"
                          className="mt-2"
                        />
                      </div>
                    </div>
                  )}

                  <div>
                    <Label htmlFor="max_attendees">Maximum Attendees (Optional)</Label>
                    <Input
                      id="max_attendees"
                      type="number"
                      value={formData.max_attendees}
                      onChange={(e) => setFormData({...formData, max_attendees: e.target.value})}
                      placeholder="Leave empty for unlimited"
                      className="mt-2"
                    />
                  </div>
                </div>
              </div>

              {/* Additional Details */}
              <div className="border-t pt-6">
                <h3 className="font-semibold text-lg text-[#2D5016] mb-4">Additional Details</h3>
                
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="topics_covered">Topics/Herbs Covered</Label>
                    <Input
                      id="topics_covered"
                      value={formData.topics_covered}
                      onChange={(e) => setFormData({...formData, topics_covered: e.target.value})}
                      placeholder="Separate with commas: Chamomile, Echinacea, Herbal Teas"
                      className="mt-2"
                    />
                  </div>

                  <div>
                    <Label htmlFor="benefits">Benefits of Attending (One per line)</Label>
                    <Textarea
                      id="benefits"
                      value={formData.benefits}
                      onChange={(e) => setFormData({...formData, benefits: e.target.value})}
                      placeholder="Learn to identify medicinal plants&#10;Make your own herbal remedies&#10;Connect with local herbalists"
                      rows={4}
                      className="mt-2"
                    />
                  </div>

                  <div>
                    <Label htmlFor="target_audience">Target Audience</Label>
                    <Input
                      id="target_audience"
                      value={formData.target_audience}
                      onChange={(e) => setFormData({...formData, target_audience: e.target.value})}
                      placeholder="e.g., Beginners, Herbalists, Healthcare Practitioners"
                      className="mt-2"
                    />
                  </div>
                </div>
              </div>

              <Button 
                type="submit" 
                disabled={createEventMutation.isPending}
                className="w-full bg-[#4A7C2E] hover:bg-[#2D5016] text-lg py-6"
              >
                {createEventMutation.isPending ? "Creating Event..." : "Create Event"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}