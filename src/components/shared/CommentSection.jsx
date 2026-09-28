import React, { useState } from "react";
import { api } from "@/api/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { MessageCircle, Send, Trash2, User, Reply, ChevronDown, ChevronUp } from "lucide-react";
import { format } from "date-fns";

export default function CommentSection({ entityType, entityId, entityName }) {
  const [user, setUser] = useState(null);
  const [newComment, setNewComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [replyingTo, setReplyingTo] = useState(null);
  const [replyContent, setReplyContent] = useState("");
  const [expandedComments, setExpandedComments] = useState(new Set());
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

  // Fetch comments
  const { data: allComments, isLoading } = useQuery({
    queryKey: ['comments', entityType, entityId],
    queryFn: async () => {
      const comments = await api.entities.Comment.filter({
        entity_type: entityType,
        entity_id: entityId
      }, '-created_date');
      return comments;
    },
    initialData: [],
  });

  // Separate parent comments and replies
  const parentComments = allComments.filter(c => !c.parent_comment_id);
  const repliesMap = {};
  allComments.forEach(comment => {
    if (comment.parent_comment_id) {
      if (!repliesMap[comment.parent_comment_id]) {
        repliesMap[comment.parent_comment_id] = [];
      }
      repliesMap[comment.parent_comment_id].push(comment);
    }
  });

  // Create comment mutation
  const createCommentMutation = useMutation({
    mutationFn: (commentData) => api.entities.Comment.create(commentData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comments', entityType, entityId] });
      setNewComment("");
      setReplyingTo(null);
      setReplyContent("");
      setIsSubmitting(false);
    },
    onError: () => {
      setIsSubmitting(false);
      alert("Failed to post comment. Please try again.");
    }
  });

  // Delete comment mutation
  const deleteCommentMutation = useMutation({
    mutationFn: (commentId) => api.entities.Comment.delete(commentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comments', entityType, entityId] });
    },
  });

  const handleSubmitComment = async () => {
    if (!user) {
      api.auth.redirectToLogin(window.location.href);
      return;
    }

    if (!newComment.trim()) {
      alert("Please enter a comment");
      return;
    }

    setIsSubmitting(true);
    createCommentMutation.mutate({
      content: newComment,
      author_email: user.email,
      author_name: user.full_name || user.email,
      entity_type: entityType,
      entity_id: entityId,
      entity_name: entityName
    });
  };

  const handleSubmitReply = async (parentCommentId) => {
    if (!user) {
      api.auth.redirectToLogin(window.location.href);
      return;
    }

    if (!replyContent.trim()) {
      alert("Please enter a reply");
      return;
    }

    setIsSubmitting(true);
    createCommentMutation.mutate({
      content: replyContent,
      author_email: user.email,
      author_name: user.full_name || user.email,
      entity_type: entityType,
      entity_id: entityId,
      entity_name: entityName,
      parent_comment_id: parentCommentId
    });
  };

  const handleDeleteComment = (commentId) => {
    if (window.confirm("Are you sure you want to delete this comment?")) {
      deleteCommentMutation.mutate(commentId);
    }
  };

  const toggleReplies = (commentId) => {
    const newExpanded = new Set(expandedComments);
    if (newExpanded.has(commentId)) {
      newExpanded.delete(commentId);
    } else {
      newExpanded.add(commentId);
    }
    setExpandedComments(newExpanded);
  };

  const isAdmin = user?.role === "admin";

  return (
    <Card className="mt-8">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-[#2D5016]">
          <MessageCircle className="w-5 h-5" />
          Comments ({allComments.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Add Comment Form */}
        <div className="space-y-3">
          <Textarea
            placeholder={user ? "Share your thoughts, experiences, or questions..." : "Sign in to leave a comment"}
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            disabled={!user || isSubmitting}
            rows={3}
            className="resize-none"
          />
          {user ? (
            <div className="flex justify-end">
              <Button
                onClick={handleSubmitComment}
                disabled={!newComment.trim() || isSubmitting}
                className="bg-[#4A7C2E] hover:bg-[#2D5016]"
              >
                <Send className="w-4 h-4 mr-2" />
                {isSubmitting ? "Posting..." : "Post Comment"}
              </Button>
            </div>
          ) : (
            <Alert className="bg-blue-50 border-blue-200">
              <AlertDescription className="text-blue-900">
                <Button 
                  onClick={() => api.auth.redirectToLogin(window.location.href)}
                  variant="link"
                  className="text-blue-600 hover:text-blue-800 p-0 h-auto font-medium"
                >
                  Sign in
                </Button>
                {" "}to join the conversation and share your insights
              </AlertDescription>
            </Alert>
          )}
        </div>

        {/* Comments List */}
        <div className="space-y-4">
          {isLoading ? (
            <p className="text-gray-500 text-center py-8">Loading comments...</p>
          ) : parentComments.length > 0 ? (
            parentComments.map((comment) => (
              <div key={comment.id} className="space-y-3">
                <div className="border rounded-lg p-4 bg-gray-50 hover:bg-gray-100 transition-colors">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 flex-1">
                      <div className="w-10 h-10 bg-[#4A7C2E]/10 rounded-full flex items-center justify-center flex-shrink-0">
                        <User className="w-5 h-5 text-[#2D5016]" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-semibold text-[#2D5016]">
                            {comment.author_name}
                          </span>
                          <span className="text-xs text-gray-500">
                            {format(new Date(comment.created_date), 'MMM d, yyyy')}
                          </span>
                        </div>
                        <p className="text-gray-700 leading-relaxed whitespace-pre-line">
                          {comment.content}
                        </p>
                        
                        {/* Reply and View Replies Buttons */}
                        <div className="flex items-center gap-4 mt-3">
                          {user && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setReplyingTo(replyingTo === comment.id ? null : comment.id)}
                              className="text-[#4A7C2E] hover:text-[#2D5016] hover:bg-[#4A7C2E]/10 h-8 px-3"
                            >
                              <Reply className="w-3 h-3 mr-1" />
                              Reply
                            </Button>
                          )}
                          
                          {repliesMap[comment.id] && repliesMap[comment.id].length > 0 && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => toggleReplies(comment.id)}
                              className="text-gray-600 hover:text-gray-900 h-8 px-3"
                            >
                              {expandedComments.has(comment.id) ? (
                                <>
                                  <ChevronUp className="w-3 h-3 mr-1" />
                                  Hide {repliesMap[comment.id].length} {repliesMap[comment.id].length === 1 ? 'reply' : 'replies'}
                                </>
                              ) : (
                                <>
                                  <ChevronDown className="w-3 h-3 mr-1" />
                                  View {repliesMap[comment.id].length} {repliesMap[comment.id].length === 1 ? 'reply' : 'replies'}
                                </>
                              )}
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    {(user?.email === comment.author_email || isAdmin) && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteComment(comment.id)}
                        className="text-red-500 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>

                {/* Reply Form */}
                {replyingTo === comment.id && user && (
                  <div className="ml-14 space-y-2">
                    <Textarea
                      placeholder="Write your reply..."
                      value={replyContent}
                      onChange={(e) => setReplyContent(e.target.value)}
                      disabled={isSubmitting}
                      rows={2}
                      className="resize-none"
                    />
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setReplyingTo(null);
                          setReplyContent("");
                        }}
                      >
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => handleSubmitReply(comment.id)}
                        disabled={!replyContent.trim() || isSubmitting}
                        className="bg-[#4A7C2E] hover:bg-[#2D5016]"
                      >
                        <Send className="w-3 h-3 mr-1" />
                        Reply
                      </Button>
                    </div>
                  </div>
                )}

                {/* Replies */}
                {expandedComments.has(comment.id) && repliesMap[comment.id] && (
                  <div className="ml-14 space-y-3">
                    {repliesMap[comment.id].map((reply) => (
                      <div key={reply.id} className="border rounded-lg p-3 bg-white">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-start gap-3 flex-1">
                            <div className="w-8 h-8 bg-[#4A7C2E]/10 rounded-full flex items-center justify-center flex-shrink-0">
                              <User className="w-4 h-4 text-[#2D5016]" />
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-semibold text-[#2D5016] text-sm">
                                  {reply.author_name}
                                </span>
                                <span className="text-xs text-gray-500">
                                  {format(new Date(reply.created_date), 'MMM d, yyyy')}
                                </span>
                              </div>
                              <p className="text-gray-700 text-sm leading-relaxed whitespace-pre-line">
                                {reply.content}
                              </p>
                            </div>
                          </div>
                          
                          {(user?.email === reply.author_email || isAdmin) && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteComment(reply.id)}
                              className="text-red-500 hover:text-red-700 hover:bg-red-50 h-7 w-7 p-0"
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))
          ) : (
            <p className="text-gray-500 text-center py-8">
              No comments yet. Be the first to share your thoughts!
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}