import React, { useState } from "react";
import { api } from "@/api/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Heart, Loader2, Check } from "lucide-react";

export default function WishlistButton({ entityType, entityId, entityName, entityImageUrl, entityMetadata, size = "default" }) {
  const [user, setUser] = useState(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const queryClient = useQueryClient();

  // Fetch current user
  React.useEffect(() => {
    const fetchUser = async () => {
      try {
        const currentUser = await api.auth.me();
        setUser(currentUser);
      } catch (error) {
        console.error("User not logged in");
      }
    };
    fetchUser();
  }, []);

  // Check if item is in wishlist
  const { data: wishlistItems, isLoading } = useQuery({
    queryKey: ['wishlist-item', entityType, entityId, user?.email],
    queryFn: async () => {
      if (!user?.email) return [];
      return await api.entities.Wishlist.filter({
        user_email: user.email,
        entity_type: entityType,
        entity_id: entityId
      });
    },
    enabled: !!user?.email,
    initialData: [],
  });

  const isInWishlist = wishlistItems.length > 0;
  const wishlistItem = wishlistItems[0];

  // Add to wishlist
  const addToWishlistMutation = useMutation({
    mutationFn: (data) => api.entities.Wishlist.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wishlist-item'] });
      queryClient.invalidateQueries({ queryKey: ['wishlist-all'] });
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 2000);
    },
  });

  // Remove from wishlist
  const removeFromWishlistMutation = useMutation({
    mutationFn: (id) => api.entities.Wishlist.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wishlist-item'] });
      queryClient.invalidateQueries({ queryKey: ['wishlist-all'] });
    },
  });

  const handleToggleWishlist = async () => {
    if (!user) {
      api.auth.redirectToLogin(window.location.href);
      return;
    }

    if (isInWishlist) {
      removeFromWishlistMutation.mutate(wishlistItem.id);
    } else {
      addToWishlistMutation.mutate({
        user_email: user.email,
        entity_type: entityType,
        entity_id: entityId,
        entity_name: entityName,
        entity_image_url: entityImageUrl,
        entity_metadata: entityMetadata || {}
      });
    }
  };

  const buttonSize = size === "sm" ? "sm" : size === "lg" ? "lg" : "default";
  const iconSize = size === "sm" ? "w-4 h-4" : size === "lg" ? "w-6 h-6" : "w-5 h-5";

  const isPending = addToWishlistMutation.isPending || removeFromWishlistMutation.isPending;

  return (
    <Button
      variant={isInWishlist ? "default" : "outline"}
      size={buttonSize}
      onClick={handleToggleWishlist}
      disabled={isLoading || isPending}
      className={isInWishlist ? "bg-red-500 hover:bg-red-600 text-white" : "border-red-500 text-red-500 hover:bg-red-50"}
    >
      {isPending ? (
        <>
          <Loader2 className={`${iconSize} animate-spin mr-2`} />
          {isInWishlist ? "Removing..." : "Saving..."}
        </>
      ) : showSuccess ? (
        <>
          <Check className={`${iconSize} mr-2`} />
          Added!
        </>
      ) : (
        <>
          <Heart className={`${iconSize} ${isInWishlist ? "fill-current" : ""} mr-2`} />
          {isInWishlist ? "Saved" : "Save"}
        </>
      )}
    </Button>
  );
}