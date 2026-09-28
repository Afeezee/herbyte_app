import React, { useState } from "react";
import { api } from "@/api/client";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar, Plus, Search, Filter, X } from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import EventCard from "../components/events/EventCard";

const EVENT_TYPES = ["All", "Workshop", "Webinar", "Conference", "Community Gathering", "Plant Walk", "Wellness Fair", "Education Session", "Other"];
const LOCATION_TYPES = ["All", "In-Person", "Virtual", "Hybrid"];
const STATUS_FILTERS = ["All", "Upcoming", "Ongoing", "Completed"];

export default function EventsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedType, setSelectedType] = useState("All");
  const [selectedLocation, setSelectedLocation] = useState("All");
  const [selectedStatus, setSelectedStatus] = useState("Upcoming");
  const [showFilters, setShowFilters] = useState(false);

  const { data: events, isLoading } = useQuery({
    queryKey: ['events'],
    queryFn: () => api.entities.Event.list('-date'),
    initialData: [],
  });

  const filteredEvents = events.filter(event => {
    const matchesSearch = !searchQuery || 
      event.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      event.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      event.city?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      event.topics_covered?.some(topic => topic.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesType = selectedType === "All" || event.event_type === selectedType;
    const matchesLocation = selectedLocation === "All" || event.location_type === selectedLocation;
    const matchesStatus = selectedStatus === "All" || event.status === selectedStatus;

    return matchesSearch && matchesType && matchesLocation && matchesStatus;
  });

  return (
    <div className="min-h-screen">
      {/* Header Section */}
      <section className="bg-gradient-to-br from-[#2D5016] to-[#4A7C2E] text-white py-16">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-4xl md:text-5xl font-bold mb-4">Herbal Medicine Events</h1>
              <p className="text-white/90 text-lg max-w-2xl">
                Connect, learn, and grow with the herbal medicine community. Discover workshops, webinars, and gatherings near you or online.
              </p>
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-6 mt-8">
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-6">
              <h3 className="font-semibold text-lg mb-2">🌿 Learn from Experts</h3>
              <p className="text-white/80 text-sm">Attend workshops and sessions led by experienced herbalists and practitioners</p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-6">
              <h3 className="font-semibold text-lg mb-2">🤝 Build Community</h3>
              <p className="text-white/80 text-sm">Connect with like-minded individuals passionate about herbal medicine</p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-6">
              <h3 className="font-semibold text-lg mb-2">📚 Expand Knowledge</h3>
              <p className="text-white/80 text-sm">Discover new herbs, remedies, and traditional healing practices</p>
            </div>
          </div>
        </div>
      </section>

      {/* Search & Filter Section */}
      <section className="bg-white border-b sticky top-0 z-40 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <Input
                type="text"
                placeholder="Search events by title, location, or topic..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-10 h-12 text-base"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>

            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => setShowFilters(!showFilters)}
                className="border-[#2D5016] text-[#2D5016] hover:bg-[#F5F1E8]"
              >
                <Filter className="w-4 h-4 mr-2" />
                {showFilters ? "Hide Filters" : "Show Filters"}
              </Button>

              <Link to={createPageUrl("OrganizeEvent")}>
                <Button className="bg-[#4A7C2E] hover:bg-[#2D5016]">
                  <Plus className="w-4 h-4 mr-2" />
                  Organize Event
                </Button>
              </Link>
            </div>
          </div>

          {/* Filter Options */}
          {showFilters && (
            <div className="grid md:grid-cols-3 gap-4 mt-6 p-6 bg-gray-50 rounded-lg">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Event Type</label>
                <Select value={selectedType} onValueChange={setSelectedType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {EVENT_TYPES.map(type => (
                      <SelectItem key={type} value={type}>{type}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Location Type</label>
                <Select value={selectedLocation} onValueChange={setSelectedLocation}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LOCATION_TYPES.map(location => (
                      <SelectItem key={location} value={location}>{location}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_FILTERS.map(status => (
                      <SelectItem key={status} value={status}>{status}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Results Section */}
      <section className="py-12">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex justify-between items-center mb-6">
            <p className="text-gray-600">
              {isLoading ? "Loading..." : `${filteredEvents.length} events found`}
            </p>
            
            {(searchQuery || selectedType !== "All" || selectedLocation !== "All" || selectedStatus !== "Upcoming") && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearchQuery("");
                  setSelectedType("All");
                  setSelectedLocation("All");
                  setSelectedStatus("Upcoming");
                }}
                className="text-[#2D5016]"
              >
                <X className="w-4 h-4 mr-2" />
                Clear Filters
              </Button>
            )}
          </div>

          {isLoading ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3, 4, 5, 6].map(i => (
                <div key={i} className="bg-gray-100 rounded-xl h-96 animate-pulse"></div>
              ))}
            </div>
          ) : filteredEvents.length > 0 ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredEvents.map(event => (
                <EventCard key={event.id} event={event} />
              ))}
            </div>
          ) : (
            <div className="text-center py-20 bg-gray-50 rounded-xl">
              <Calendar className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 mb-2">No events found</h3>
              <p className="text-gray-600 mb-6">Try adjusting your filters or search query</p>
              <div className="flex gap-3 justify-center">
                <Button
                  onClick={() => {
                    setSearchQuery("");
                    setSelectedType("All");
                    setSelectedLocation("All");
                    setSelectedStatus("All");
                  }}
                  variant="outline"
                >
                  Clear All Filters
                </Button>
                <Link to={createPageUrl("OrganizeEvent")}>
                  <Button className="bg-[#4A7C2E] hover:bg-[#2D5016]">
                    <Plus className="w-4 h-4 mr-2" />
                    Organize Event
                  </Button>
                </Link>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}