import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Link } from "react-router-dom";
import {
  Mail,
  Phone,
  Calendar,
  User,
  MessageSquare,
  ArrowLeft,
  Filter,
} from "lucide-react";
import UserMenu from "@/components/ui/user-menu";
import { supabase } from "../../../supabase/supabase";
import { LoadingSpinner } from "@/components/ui/loading-spinner";

interface Message {
  id: string;
  name: string;
  email: string;
  phone: string;
  plan: string;
  message: string;
  created_at: string;
  is_read: boolean;
  status: string;
}

export default function Messages() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");

  useEffect(() => {
    fetchMessages();
  }, []);

  const fetchMessages = async () => {
    try {
      const { data, error } = await supabase
        .from("contact_messages")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching messages:", error);
      } else {
        setMessages(data || []);
      }
    } catch (error) {
      console.error("Exception fetching messages:", error);
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (messageId: string) => {
    try {
      const { error } = await supabase
        .from("contact_messages")
        .update({ is_read: true })
        .eq("id", messageId);

      if (error) {
        console.error("Error marking message as read:", error);
      } else {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === messageId ? { ...msg, is_read: true } : msg,
          ),
        );
      }
    } catch (error) {
      console.error("Exception marking message as read:", error);
    }
  };

  const updateMessageStatus = async (messageId: string, status: string) => {
    try {
      const { error } = await supabase
        .from("contact_messages")
        .update({ status })
        .eq("id", messageId);

      if (error) {
        console.error("Error updating message status:", error);
      } else {
        setMessages((prev) =>
          prev.map((msg) => (msg.id === messageId ? { ...msg, status } : msg)),
        );
        if (selectedMessage && selectedMessage.id === messageId) {
          setSelectedMessage({ ...selectedMessage, status });
        }
      }
    } catch (error) {
      console.error("Exception updating message status:", error);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const unreadCount = messages.filter((msg) => !msg.is_read).length;

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case "won":
        return "bg-green-500 text-white";
      case "loss":
        return "bg-red-500 text-white";
      case "under_process":
        return "bg-yellow-500 text-white";
      default:
        return "bg-gray-500 text-white";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "won":
        return "Won";
      case "loss":
        return "Loss";
      case "under_process":
        return "Under Process";
      default:
        return "Pending";
    }
  };

  const filteredMessages = messages.filter((msg) => {
    if (statusFilter === "all") return true;
    return msg.status === statusFilter;
  });

  const statusCounts = {
    all: messages.length,
    pending: messages.filter((msg) => msg.status === "pending" || !msg.status)
      .length,
    won: messages.filter((msg) => msg.status === "won").length,
    loss: messages.filter((msg) => msg.status === "loss").length,
    under_process: messages.filter((msg) => msg.status === "under_process")
      .length,
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-600 via-blue-600 to-teal-500 flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-600 via-blue-600 to-teal-500">
      {/* Header */}
      <div className="w-full bg-white flex justify-between items-center px-6 py-4 shadow-md">
        <Link to="/">
          <img
            src="https://i.postimg.cc/pXxdtDJz/quiz-online-logo.png"
            alt="Newquiz.online Logo"
            className="h-12 w-auto ml-16"
          />
        </Link>
        <UserMenu />
      </div>

      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center gap-4 mb-8">
          <Link to="/">
            <Button
              variant="outline"
              className="bg-white/20 border-white/30 text-white hover:bg-white/30"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Home
            </Button>
          </Link>
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-white mb-2">
              Contact Messages
            </h1>
            <p className="text-white/80">
              {filteredMessages.length} of {messages.length} messages
              {unreadCount > 0 && (
                <Badge className="ml-2 bg-red-500 text-white">
                  {unreadCount} unread
                </Badge>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-white" />
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-48 bg-white/20 border-white/30 text-white">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  All Messages ({statusCounts.all})
                </SelectItem>
                <SelectItem value="pending">
                  Pending ({statusCounts.pending})
                </SelectItem>
                <SelectItem value="won">Won ({statusCounts.won})</SelectItem>
                <SelectItem value="loss">Loss ({statusCounts.loss})</SelectItem>
                <SelectItem value="under_process">
                  Under Process ({statusCounts.under_process})
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {filteredMessages.length === 0 ? (
          <Card className="bg-white/95 backdrop-blur-md border-white/30">
            <CardContent className="p-8 text-center">
              <MessageSquare className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-600 mb-2">
                {messages.length === 0
                  ? "No Messages Yet"
                  : "No Messages Match Filter"}
              </h3>
              <p className="text-gray-500">
                {messages.length === 0
                  ? "Contact form submissions will appear here."
                  : "Try changing the filter to see more messages."}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {filteredMessages.map((message) => (
              <Card
                key={message.id}
                className={`bg-white/95 backdrop-blur-md border-white/30 cursor-pointer transition-all hover:shadow-lg ${
                  !message.is_read ? "ring-2 ring-blue-400" : ""
                }`}
                onClick={() => {
                  setSelectedMessage(message);
                  if (!message.is_read) {
                    markAsRead(message.id);
                  }
                }}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-lg text-navy flex items-center gap-2">
                      <User className="w-5 h-5" />
                      {message.name}
                      {!message.is_read && (
                        <Badge className="bg-blue-500 text-white text-xs">
                          New
                        </Badge>
                      )}
                    </CardTitle>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Calendar className="w-4 h-4" />
                    {formatDate(message.created_at)}
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="w-4 h-4 text-blue-600" />
                    <span className="truncate">{message.email}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="w-4 h-4 text-green-600" />
                    <span>{message.phone}</span>
                  </div>
                  <div className="mb-2 flex gap-2 flex-wrap">
                    <Badge variant="outline" className="text-xs">
                      {message.plan || "General Inquiry"}
                    </Badge>
                    <Badge
                      className={`text-xs ${getStatusBadgeColor(message.status || "pending")}`}
                    >
                      {getStatusLabel(message.status || "pending")}
                    </Badge>
                  </div>
                  <div className="mb-2">
                    <Select
                      value={message.status || "pending"}
                      onValueChange={(value) =>
                        updateMessageStatus(message.id, value)
                      }
                    >
                      <SelectTrigger
                        className="w-full h-8 text-xs"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="won">Won</SelectItem>
                        <SelectItem value="loss">Loss</SelectItem>
                        <SelectItem value="under_process">
                          Under Process
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {message.message && (
                    <div className="text-sm text-gray-700">
                      <p className="line-clamp-3">{message.message}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Message Detail Modal */}
      {selectedMessage && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <Card className="bg-white max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <div className="flex items-start justify-between">
                <CardTitle className="text-xl text-navy">
                  Message Details
                </CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedMessage(null)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  ✕
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-600">
                    Name
                  </label>
                  <p className="text-navy font-medium">
                    {selectedMessage.name}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600">
                    Email
                  </label>
                  <p className="text-navy">{selectedMessage.email}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600">
                    Phone
                  </label>
                  <p className="text-navy">{selectedMessage.phone}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600">
                    Plan
                  </label>
                  <Badge variant="outline">
                    {selectedMessage.plan || "General Inquiry"}
                  </Badge>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600">
                    Status
                  </label>
                  <div className="mt-1">
                    <Select
                      value={selectedMessage.status || "pending"}
                      onValueChange={(value) =>
                        updateMessageStatus(selectedMessage.id, value)
                      }
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="won">Won</SelectItem>
                        <SelectItem value="loss">Loss</SelectItem>
                        <SelectItem value="under_process">
                          Under Process
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-600">
                  Date
                </label>
                <p className="text-navy">
                  {formatDate(selectedMessage.created_at)}
                </p>
              </div>
              {selectedMessage.message && (
                <div>
                  <label className="text-sm font-medium text-gray-600">
                    Message
                  </label>
                  <div className="bg-gray-50 p-4 rounded-lg mt-2">
                    <p className="text-navy whitespace-pre-wrap">
                      {selectedMessage.message}
                    </p>
                  </div>
                </div>
              )}
              <div className="flex gap-2 pt-4">
                <Button
                  onClick={() =>
                    (window.location.href = `mailto:${selectedMessage.email}`)
                  }
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  <Mail className="w-4 h-4 mr-2" />
                  Reply via Email
                </Button>
                <Button
                  onClick={() =>
                    (window.location.href = `tel:${selectedMessage.phone}`)
                  }
                  variant="outline"
                >
                  <Phone className="w-4 h-4 mr-2" />
                  Call
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
