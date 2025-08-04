import { supabase } from "../../supabase/supabase";

// Function to keep the Supabase database active
export const keepDatabaseActive = () => {
  // Set an interval to ping the database every 6 days (in milliseconds)
  // This is less than the 7-day inactivity limit
  const SIX_DAYS_MS = 6 * 24 * 60 * 60 * 1000;

  const pingDatabase = async () => {
    try {
      // Simple query to keep the connection alive
      const { count } = await supabase
        .from("quizzes")
        .select("*", { count: "exact", head: true });

      console.log(`Database ping successful: ${new Date().toISOString()}`);
    } catch (error) {
      console.error("Error pinging database:", error);
    }
  };

  // Initial ping
  pingDatabase();

  // Set up recurring ping
  const intervalId = setInterval(pingDatabase, SIX_DAYS_MS);

  // Return a cleanup function to clear the interval if needed
  return () => clearInterval(intervalId);
};
