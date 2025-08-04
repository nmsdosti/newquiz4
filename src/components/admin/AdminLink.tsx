import { Link } from "react-router-dom";
import { useAuth } from "@/components/auth/VercelAuthProvider";
import { Settings } from "lucide-react";

export default function AdminLink() {
  const { isAdmin } = useAuth();

  if (!isAdmin) {
    return null;
  }

  return (
    <Link
      to="/admin"
      className="fixed bottom-4 right-4 bg-coral text-white p-3 rounded-full shadow-lg hover:bg-coral/90 transition-colors z-50"
      title="Admin Dashboard"
    >
      <Settings className="h-6 w-6" />
    </Link>
  );
}
