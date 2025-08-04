import { useState, useEffect } from "react";
import { supabase } from "../../../supabase/supabase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { CheckCircle, XCircle, Clock, Users } from "lucide-react";
import { useAuth } from "@/components/auth/VercelAuthProvider";
import { Navigate } from "react-router-dom";
import { Link, useNavigate } from "react-router-dom";
import UserMenu from "@/components/ui/user-menu";
import Logo from "@/components/ui/logo";

interface PendingUser {
  id: string;
  email: string;
  full_name: string;
  created_at: string;
  is_approved: boolean;
}

export default function AdminApproval() {
  const [pendingUsers, setPendingUsers] = useState<PendingUser[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const { user, isAdmin, loading: authLoading } = useAuth();

  useEffect(() => {
    if (!authLoading && user && isAdmin) {
      fetchPendingUsers();
    }
  }, [user, isAdmin, authLoading]);

  const fetchPendingUsers = async () => {
    try {
      const { data, error } = await supabase
        .from("users")
        .select("id, email, full_name, created_at, is_approved")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching users:", error);
        toast({
          title: "Error",
          description: "Failed to fetch users",
          variant: "destructive",
        });
      } else {
        setPendingUsers(data || []);
      }
    } catch (error) {
      console.error("Exception fetching users:", error);
    } finally {
      setLoading(false);
    }
  };

  const updateUserApproval = async (userId: string, approved: boolean) => {
    try {
      const { error } = await supabase
        .from("users")
        .update({ is_approved: approved })
        .eq("id", userId);

      if (error) {
        console.error("Error updating user approval:", error);
        toast({
          title: "Error",
          description: "Failed to update user approval",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Success",
          description: `User ${approved ? "approved" : "rejected"} successfully`,
        });
        fetchPendingUsers(); // Refresh the list
      }
    } catch (error) {
      console.error("Exception updating user approval:", error);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-600 via-blue-600 to-teal-500 flex items-center justify-center">
        <div className="text-white text-lg">Loading...</div>
      </div>
    );
  }

  if (!user || !isAdmin) {
    return <Navigate to="/" />;
  }

  const pendingCount = pendingUsers.filter((user) => !user.is_approved).length;
  const approvedCount = pendingUsers.filter((user) => user.is_approved).length;

  return (
    <div className="min-h-screen bg-[#FF6952] to-teal-500 p-4">
      <div className="w-full bg-white flex justify-between items-center px-6 py-4 shadow-md fixed top-0 left-0 right-0 z-50">
        <Logo className="bg-white/20 backdrop-blur-md p-1 rounded ml-0 sm:ml-16" />
        <UserMenu />
      </div>
      <div className="max-w-6xl mt-24 mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">
            Admin Dashboard
          </h1>
          <p className="text-white/80">Manage user approvals and access</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card className="bg-white/90 backdrop-blur-md border-0">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-navy/70">
                    Total Users
                  </p>
                  <p className="text-3xl font-bold text-navy">
                    {pendingUsers.length}
                  </p>
                </div>
                <Users className="h-8 w-8 text-skyblue" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/90 backdrop-blur-md border-0">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-navy/70">
                    Pending Approval
                  </p>
                  <p className="text-3xl font-bold text-coral">
                    {pendingCount}
                  </p>
                </div>
                <Clock className="h-8 w-8 text-coral" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/90 backdrop-blur-md border-0">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-navy/70">
                    Approved Users
                  </p>
                  <p className="text-3xl font-bold text-green-600">
                    {approvedCount}
                  </p>
                </div>
                <CheckCircle className="h-8 w-8 text-green-600" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Users List */}
        <Card className="bg-white/90 backdrop-blur-md border-0">
          <CardHeader>
            <CardTitle className="text-navy">User Management</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">
                <div className="text-navy/70">Loading users...</div>
              </div>
            ) : pendingUsers.length === 0 ? (
              <div className="text-center py-8">
                <div className="text-navy/70">No users found</div>
              </div>
            ) : (
              <div className="space-y-4">
                {pendingUsers.map((user) => (
                  <div
                    key={user.id}
                    className="flex items-center justify-between p-4 bg-white/50 rounded-lg border border-skyblue/20"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <div>
                          <h3 className="font-semibold text-navy">
                            {user.full_name}
                          </h3>
                          <p className="text-sm text-navy/70">{user.email}</p>
                          <p className="text-xs text-navy/50">
                            Joined:{" "}
                            {new Date(user.created_at).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="ml-4">
                          {user.is_approved ? (
                            <div className="flex items-center gap-1 text-green-600">
                              <CheckCircle className="h-4 w-4" />
                              <span className="text-sm font-medium">
                                Approved
                              </span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1 text-coral">
                              <Clock className="h-4 w-4" />
                              <span className="text-sm font-medium">
                                Pending
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {!user.is_approved ? (
                        <>
                          <Button
                            size="sm"
                            variant="default"
                            onClick={() => updateUserApproval(user.id, true)}
                            className="bg-green-600 hover:bg-green-700 text-white"
                          >
                            <CheckCircle className="h-4 w-4 mr-1" />
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => updateUserApproval(user.id, false)}
                          >
                            <XCircle className="h-4 w-4 mr-1" />
                            Reject
                          </Button>
                        </>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => updateUserApproval(user.id, false)}
                          className="border-coral text-coral hover:bg-coral hover:text-white"
                        >
                          <XCircle className="h-4 w-4 mr-1" />
                          Revoke Access
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
