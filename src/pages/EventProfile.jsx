import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Calendar, MapPin, Clock, Users, ExternalLink, ArrowLeft, 
  Video, DollarSign, User, Edit, Trash2, Shield, Mail, Phone, CheckCircle
} from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { format } from "date-fns";
import CommentSection from "../components/shared/CommentSection";
import WishlistButton from "../components/shared/WishlistButton";
import ShareButtons from "../components/shared/ShareButtons";

export default function EventProfile() {
  const urlParams = new URLSearchParams(window.location.search);
  const eventId = urlParams.get('id');
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

  const { data: event, isLoading } = useQuery({
    queryKey: ['event', eventId],
    queryFn: async () => {
      const events = await api.entities.Event.filter({ id: eventId });
      return events[0];
    },
    enabled: !!eventId,
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.entities.Event.delete(eventId),
    onSuccess: () => {
      alert("Event deleted successfully!");
      window.location.href = createPageUrl("Events");
    },
  });

  const handleDelete = () => {
    if (window.confirm(`Are you sure you want to delete "${event.title}"? This action cannot be undone.`)) {
      deleteMutation.mutate();
    }
  };

  const isAdmin = user?.role === "admin";
  const isOrganizer = user?.email === event?.created_by;

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Calendar className="w-12 h-12 text-[#4A7C2E] animate-pulse mx-auto mb-4" />
          <p className="text-gray-600">Loading event information...</p>
        </div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Event not found</h2>
          <Link to={createPageUrl("Events")}>
            <Button>Back to Events</Button>
          </Link>
        </div>
      </div>
    );
  }

  const eventDate = new Date(event.date);
  const isPast = eventDate < new Date();

  return (
    <div className="min-h-screen pb-12">
      <section className="bg-gradient-to-br from-[#2D5016] to-[#4A7C2E] text-white py-8">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex items-center justify-between">
            <Link to={createPageUrl("Events")} className="inline-flex items-center gap-2 text-white/80 hover:text-white mb-6">
              <ArrowLeft className="w-4 h-4" />
              Back to Events
            </Link>

            {(isAdmin || isOrganizer) && (
              <div className="flex gap-2 mb-6">
                <Button
                  variant="outline"
                  size="sm"
                  className="bg-white/10 border-white/30 text-white hover:bg-white/20"
                  onClick={() => alert("Edit functionality - coming soon")}
                >
                  <Edit className="w-4 h-4 mr-2" />
                  Edit Event
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
        {(isAdmin || isOrganizer) && (
          <Alert className="mb-4 bg-blue-50 border-blue-200">
            <Shield className="h-4 w-4 text-blue-600" />
            <AlertDescription className="text-blue-900">
              <strong>{isOrganizer ? "Organizer Mode" : "Admin Mode"}:</strong> You can edit or delete this event.
            </AlertDescription>
          </Alert>
        )}

        <div className="grid lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <Card className="overflow-hidden shadow-xl">
              <div className="relative h-80 bg-gray-100">
                {event.image_url ? (
                  <img 
                    src={event.image_url} 
                    alt={event.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#4A7C2E]/20 to-[#2D5016]/20">
                    <Calendar className="w-32 h-32 text-[#2D5016]/40" />
                  </div>
                )}
                <div className="absolute top-4 left-4 flex flex-wrap gap-2">
                  <Badge className={
                    event.status === "Upcoming" ? "bg-green-500 text-white text-sm px-3 py-1" :
                    event.status === "Ongoing" ? "bg-blue-500 text-white text-sm px-3 py-1" :
                    event.status === "Completed" ? "bg-gray-500 text-white text-sm px-3 py-1" :
                    "bg-red-500 text-white text-sm px-3 py-1"
                  }>
                    {event.status}
                  </Badge>
                  {event.is_free && (
                    <Badge className="bg-yellow-500 text-white text-sm px-3 py-1">Free</Badge>
                  )}
                </div>
              </div>

              <CardContent className="p-8">
                <div className="mb-6">
                  <Badge variant="outline" className="bg-[#4A7C2E]/10 text-[#2D5016] border-[#4A7C2E]/30 mb-4">
                    {event.event_type}
                  </Badge>
                  <h1 className="text-3xl md:text-4xl font-bold text-[#2D5016] mb-4">
                    {event.title}
                  </h1>
                </div>

                <div className="prose max-w-none mb-8">
                  <p className="text-gray-700 leading-relaxed whitespace-pre-line">
                    {event.description}
                  </p>
                </div>

                {event.benefits && event.benefits.length > 0 && (
                  <div className="mb-8">
                    <h2 className="text-2xl font-bold text-[#2D5016] mb-4">Why Attend?</h2>
                    <div className="space-y-3">
                      {event.benefits.map((benefit, index) => (
                        <div key={index} className="flex items-start gap-3 p-4 bg-green-50 rounded-lg">
                          <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                          <p className="text-gray-700">{benefit}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {event.topics_covered && event.topics_covered.length > 0 && (
                  <div className="mb-8">
                    <h2 className="text-2xl font-bold text-[#2D5016] mb-4">Topics Covered</h2>
                    <div className="flex flex-wrap gap-2">
                      {event.topics_covered.map((topic, index) => (
                        <Badge key={index} variant="outline" className="bg-white">
                          {topic}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {event.target_audience && (
                  <div className="mb-8">
                    <h2 className="text-2xl font-bold text-[#2D5016] mb-4">Who Should Attend</h2>
                    <p className="text-gray-700 leading-relaxed">
                      {event.target_audience}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card className="shadow-xl sticky top-6">
              <CardHeader>
                <CardTitle className="text-[#2D5016]">Event Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                  <Calendar className="w-5 h-5 text-[#4A7C2E] mt-0.5" />
                  <div>
                    <p className="font-semibold text-gray-900">Date</p>
                    <p className="text-gray-600">{format(eventDate, 'EEEE, MMMM d, yyyy')}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                  <Clock className="w-5 h-5 text-[#4A7C2E] mt-0.5" />
                  <div>
                    <p className="font-semibold text-gray-900">Time</p>
                    <p className="text-gray-600">
                      {event.start_time}{event.end_time && ` - ${event.end_time}`}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                  {event.location_type === "Virtual" ? (
                    <Video className="w-5 h-5 text-purple-600 mt-0.5" />
                  ) : (
                    <MapPin className="w-5 h-5 text-[#4A7C2E] mt-0.5" />
                  )}
                  <div className="flex-1">
                    <p className="font-semibold text-gray-900">Location</p>
                    <p className="text-gray-600">
                      {event.location_type === "Virtual" ? "Online Event" : 
                       event.location_type === "Hybrid" ? "Hybrid (In-Person & Virtual)" :
                       "In-Person Event"}
                    </p>
                    {event.location_address && (
                      <p className="text-sm text-gray-500 mt-1 break-words">
                        {event.location_address}
                      </p>
                    )}
                    {event.city && event.country && (
                      <p className="text-sm text-gray-500">
                        {event.city}, {event.country}
                      </p>
                    )}
                  </div>
                </div>

                {!event.is_free && (
                  <div className="flex items-start gap-3 p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                    <DollarSign className="w-5 h-5 text-yellow-700 mt-0.5" />
                    <div>
                      <p className="font-semibold text-gray-900">Price</p>
                      <p className="text-2xl font-bold text-[#2D5016]">
                        {event.currency} {event.price}
                      </p>
                    </div>
                  </div>
                )}

                {event.max_attendees && (
                  <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                    <Users className="w-5 h-5 text-[#4A7C2E] mt-0.5" />
                    <div>
                      <p className="font-semibold text-gray-900">Capacity</p>
                      <p className="text-gray-600">Limited to {event.max_attendees} attendees</p>
                    </div>
                  </div>
                )}

                <div className="pt-4 border-t space-y-3">
                  {event.registration_required && event.registration_link ? (
                    <a 
                      href={event.registration_link}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Button className="w-full bg-[#4A7C2E] hover:bg-[#2D5016] text-lg py-6">
                        <ExternalLink className="w-5 h-5 mr-2" />
                        Register Now
                      </Button>
                    </a>
                  ) : (
                    <p className="text-sm text-gray-500 text-center">
                      Contact organizer for registration details
                    </p>
                  )}

                  <WishlistButton
                    entityType="Event"
                    entityId={eventId}
                    entityName={event.title}
                    entityImageUrl={event.image_url}
                    entityMetadata={{
                      date: event.date,
                      location_type: event.location_type,
                      event_type: event.event_type,
                      is_free: event.is_free
                    }}
                    size="lg"
                  />

                  <ShareButtons
                    title={event.title}
                    description={event.description}
                    imageUrl={event.image_url}
                    entityType="event"
                  />
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-xl">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-[#2D5016]">
                  <User className="w-5 h-5" />
                  Organizer
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="font-semibold text-lg text-[#2D5016]">
                  {event.organizer_name}
                </p>

                <div className="space-y-2">
                  <a 
                    href={`mailto:${event.organizer_email}`}
                    className="flex items-center gap-2 text-sm text-gray-600 hover:text-[#4A7C2E] transition-colors"
                  >
                    <Mail className="w-4 h-4" />
                    {event.organizer_email}
                  </a>

                  {event.organizer_phone && (
                    <a 
                      href={`tel:${event.organizer_phone}`}
                      className="flex items-center gap-2 text-sm text-gray-600 hover:text-[#4A7C2E] transition-colors"
                    >
                      <Phone className="w-4 h-4" />
                      {event.organizer_phone}
                    </a>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        <CommentSection 
          entityType="Event"
          entityId={eventId}
          entityName={event.title}
        />
      </div>
    </div>
  );
}