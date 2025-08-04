-- Add game_mode column to game_sessions table
ALTER TABLE game_sessions ADD COLUMN IF NOT EXISTS game_mode TEXT DEFAULT 'live';

-- Create poll_sessions table
CREATE TABLE IF NOT EXISTS poll_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  quiz_id UUID NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  host_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  game_pin TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'waiting',
  current_question_index INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create poll_players table
CREATE TABLE IF NOT EXISTS poll_players (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES poll_sessions(id) ON DELETE CASCADE,
  player_name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create poll_answers table
CREATE TABLE IF NOT EXISTS poll_answers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES poll_sessions(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES poll_players(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  question_index INTEGER NOT NULL,
  option_id UUID NOT NULL REFERENCES options(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create anytime_quiz_sessions table
CREATE TABLE IF NOT EXISTS anytime_quiz_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  quiz_id UUID NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  host_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  game_pin TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create anytime_quiz_players table
CREATE TABLE IF NOT EXISTS anytime_quiz_players (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES anytime_quiz_sessions(id) ON DELETE CASCADE,
  player_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  ip_address TEXT NOT NULL,
  score INTEGER NOT NULL DEFAULT 0,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create anytime_quiz_answers table
CREATE TABLE IF NOT EXISTS anytime_quiz_answers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES anytime_quiz_sessions(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES anytime_quiz_players(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  question_index INTEGER NOT NULL,
  option_id UUID NOT NULL REFERENCES options(id) ON DELETE CASCADE,
  is_correct BOOLEAN NOT NULL DEFAULT false,
  time_taken INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable realtime for all new tables
alter publication supabase_realtime add table anytime_quiz_sessions;
alter publication supabase_realtime add table anytime_quiz_players;
alter publication supabase_realtime add table anytime_quiz_answers;
alter publication supabase_realtime add table anytime_quiz_sessions;
alter publication supabase_realtime add table anytime_quiz_players;
alter publication supabase_realtime add table anytime_quiz_answers;

-- Add unique constraint to prevent duplicate participation in anytime quiz
ALTER TABLE anytime_quiz_players ADD CONSTRAINT unique_anytime_quiz_participation 
  UNIQUE (session_id, ip_address);
