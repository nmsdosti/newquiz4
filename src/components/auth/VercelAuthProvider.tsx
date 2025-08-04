import { createContext, useContext, useEffect, useState } from "react";
import { User } from "@supabase/supabase-js";
import { supabase } from "../../../supabase/supabase";
import { LoadingScreen } from "@/components/ui/loading-spinner";

type AuthContextType = {
  user: User | null;
  loading: boolean;
  isApproved: boolean;
  isAdmin: boolean;
  signIn: (email: string, password: string) => Promise<any>;
  signUp: (email: string, password: string, fullName: string) => Promise<any>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [initialized, setInitialized] = useState(false);
  const [isApproved, setIsApproved] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    // Check if Supabase client is available
    if (!supabase) {
      console.error("Supabase client is not initialized!");
      setLoading(false);
      return;
    }

    const initializeAuth = async () => {
      try {
        // Check active sessions and sets the user
        const { data } = await supabase.auth.getSession();
        setUser(data.session?.user ?? null);
        if (data.session?.user) {
          await checkUserApprovalStatus(data.session.user.id);
        }

        // Listen for changes on auth state (signed in, signed out, etc.)
        const {
          data: { subscription },
        } = supabase.auth.onAuthStateChange(async (_event, session) => {
          setUser(session?.user ?? null);
          if (session?.user) {
            await checkUserApprovalStatus(session.user.id);
          } else {
            setIsApproved(false);
            setIsAdmin(false);
          }
        });

        return () => subscription.unsubscribe();
      } catch (error) {
        console.error("Error initializing auth:", error);
      } finally {
        setLoading(false);
        setInitialized(true);
      }
    };

    initializeAuth();
  }, []);

  const checkUserApprovalStatus = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from("users")
        .select("is_approved, is_admin")
        .eq("id", userId)
        .single();

      if (error) {
        console.error("Error checking approval status:", error);
        setIsApproved(false);
        setIsAdmin(false);
      } else {
        setIsApproved(data?.is_approved || false);
        setIsAdmin(data?.is_admin || false);
      }
    } catch (error) {
      console.error("Exception checking approval status:", error);
      setIsApproved(false);
      setIsAdmin(false);
    }
  };

  const signUp = async (email: string, password: string, fullName: string) => {
    try {
      console.log("Starting signup process for:", email);

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
          },
          emailRedirectTo: window.location.origin + "/login",
        },
      });

      if (error) {
        console.error("Signup error:", error);
        throw error;
      }

      console.log(
        "Signup successful, user data:",
        data.user ? "User created" : "No user data",
      );

      // Create a user record in the public.users table
      if (data.user) {
        try {
          const { error: profileError } = await supabase.from("users").upsert(
            {
              id: data.user.id,
              email: email,
              full_name: fullName,
              token_identifier: data.user.id,
              is_approved: false,
              is_admin: false,
            },
            { onConflict: "id" },
          );

          if (profileError) {
            console.error("Error creating user profile:", profileError);
          } else {
            console.log("User profile created successfully");
          }
        } catch (profileError) {
          console.error("Exception creating user profile:", profileError);
          // Don't throw here, as the auth signup was successful
        }
      }

      return data;
    } catch (error) {
      console.error("Error during signup:", error);
      throw error;
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      console.log("Starting signin process for:", email);

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        console.error("Signin error:", error);
        throw error;
      }

      if (data.session?.user) {
        // Check if user is approved
        const { data: userData, error: userError } = await supabase
          .from("users")
          .select("is_approved, is_admin")
          .eq("id", data.session.user.id)
          .single();

        if (userError) {
          console.error("Error checking user approval:", userError);
          throw new Error("Error checking account status");
        }

        if (!userData?.is_approved) {
          // Sign out the user since they're not approved
          await supabase.auth.signOut();
          throw new Error("Account pending approval");
        }

        setIsApproved(userData.is_approved);
        setIsAdmin(userData.is_admin || false);
      }

      console.log(
        "Signin successful",
        data.session ? "Session created" : "No session data",
      );
      return data;
    } catch (error) {
      console.error("Error during signin:", error);
      throw error;
    }
  };

  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error("Signout error:", error);
        throw error;
      }
    } catch (error) {
      console.error("Error during signout:", error);
      throw error;
    }
  };

  if (!initialized && loading) {
    return <LoadingScreen text="Initializing authentication..." />;
  }

  return (
    <AuthContext.Provider
      value={{ user, loading, isApproved, isAdmin, signIn, signUp, signOut }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
