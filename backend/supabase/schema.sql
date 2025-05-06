-- Create schema for public tables
CREATE SCHEMA IF NOT EXISTS public;

-- Enable Row Level Security
ALTER DATABASE postgres SET "app.settings.jwt_secret" TO 'your-jwt-secret';

-- Create tables

-- Users table (managed by Supabase Auth)
-- This references the auth.users table created by Supabase

-- Learning paths table
CREATE TABLE IF NOT EXISTS public.learning_paths (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  stages JSONB NOT NULL,
  is_public BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Chapter contents table
CREATE TABLE IF NOT EXISTS public.chapter_contents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  path_id UUID REFERENCES public.learning_paths(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content JSONB NOT NULL,
  order_index INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Exercises table
CREATE TABLE IF NOT EXISTS public.exercises (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  chapter_id UUID REFERENCES public.chapter_contents(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  type TEXT NOT NULL,
  options JSONB,
  answer TEXT NOT NULL,
  explanation TEXT,
  difficulty TEXT DEFAULT 'medium',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- User progress table
CREATE TABLE IF NOT EXISTS public.user_progress (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  path_id UUID REFERENCES public.learning_paths(id) ON DELETE CASCADE,
  chapter_id UUID REFERENCES public.chapter_contents(id) ON DELETE CASCADE,
  completed BOOLEAN DEFAULT false,
  score INTEGER,
  last_accessed TIMESTAMP WITH TIME ZONE DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(user_id, chapter_id)
);

-- Exercise results table
CREATE TABLE IF NOT EXISTS public.exercise_results (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  exercise_id UUID REFERENCES public.exercises(id) ON DELETE CASCADE,
  user_answer TEXT,
  is_correct BOOLEAN,
  attempt_count INTEGER DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_id, exercise_id)
);

-- AI interactions table
CREATE TABLE IF NOT EXISTS public.ai_interactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  chapter_id UUID REFERENCES public.chapter_contents(id),
  query TEXT NOT NULL,
  response TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- User profiles table (extends auth.users)
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  avatar_url TEXT,
  bio TEXT,
  preferences JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable Row Level Security on all tables
ALTER TABLE public.learning_paths ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chapter_contents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exercise_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- Create RLS policies

-- Learning paths policies
CREATE POLICY "Users can view their own learning paths"
  ON public.learning_paths
  FOR SELECT
  USING (auth.uid() = user_id OR is_public = true);

CREATE POLICY "Users can create their own learning paths"
  ON public.learning_paths
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own learning paths"
  ON public.learning_paths
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own learning paths"
  ON public.learning_paths
  FOR DELETE
  USING (auth.uid() = user_id);

-- Chapter contents policies
CREATE POLICY "Users can view chapter contents of their learning paths or public paths"
  ON public.chapter_contents
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.learning_paths
      WHERE id = chapter_contents.path_id
      AND (user_id = auth.uid() OR is_public = true)
    )
  );

CREATE POLICY "Users can create chapter contents for their learning paths"
  ON public.chapter_contents
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.learning_paths
      WHERE id = path_id AND user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update chapter contents of their learning paths"
  ON public.chapter_contents
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.learning_paths
      WHERE id = path_id AND user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete chapter contents of their learning paths"
  ON public.chapter_contents
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.learning_paths
      WHERE id = path_id AND user_id = auth.uid()
    )
  );

-- Exercises policies
CREATE POLICY "Users can view exercises of chapters they have access to"
  ON public.exercises
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.chapter_contents
      JOIN public.learning_paths ON chapter_contents.path_id = learning_paths.id
      WHERE chapter_contents.id = exercises.chapter_id
      AND (learning_paths.user_id = auth.uid() OR learning_paths.is_public = true)
    )
  );

-- User progress policies
CREATE POLICY "Users can view their own progress"
  ON public.user_progress
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own progress"
  ON public.user_progress
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own progress"
  ON public.user_progress
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Exercise results policies
CREATE POLICY "Users can view their own exercise results"
  ON public.exercise_results
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own exercise results"
  ON public.exercise_results
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own exercise results"
  ON public.exercise_results
  FOR UPDATE
  USING (auth.uid() = user_id);

-- AI interactions policies
CREATE POLICY "Users can view their own AI interactions"
  ON public.ai_interactions
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own AI interactions"
  ON public.ai_interactions
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- User profiles policies
CREATE POLICY "Users can view any profile"
  ON public.user_profiles
  FOR SELECT
  USING (true);

CREATE POLICY "Users can update their own profile"
  ON public.user_profiles
  FOR UPDATE
  USING (auth.uid() = id);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS learning_paths_user_id_idx ON public.learning_paths(user_id);
CREATE INDEX IF NOT EXISTS chapter_contents_path_id_idx ON public.chapter_contents(path_id);
CREATE INDEX IF NOT EXISTS exercises_chapter_id_idx ON public.exercises(chapter_id);
CREATE INDEX IF NOT EXISTS user_progress_user_id_idx ON public.user_progress(user_id);
CREATE INDEX IF NOT EXISTS user_progress_path_id_idx ON public.user_progress(path_id);
CREATE INDEX IF NOT EXISTS exercise_results_user_id_idx ON public.exercise_results(user_id);
CREATE INDEX IF NOT EXISTS exercise_results_exercise_id_idx ON public.exercise_results(exercise_id);
CREATE INDEX IF NOT EXISTS ai_interactions_user_id_idx ON public.ai_interactions(user_id);

-- Create functions and triggers

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for learning_paths
CREATE TRIGGER update_learning_paths_updated_at
BEFORE UPDATE ON public.learning_paths
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Trigger for chapter_contents
CREATE TRIGGER update_chapter_contents_updated_at
BEFORE UPDATE ON public.chapter_contents
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Trigger for user_profiles
CREATE TRIGGER update_user_profiles_updated_at
BEFORE UPDATE ON public.user_profiles
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Function to create user profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (id, display_name)
  VALUES (NEW.id, NEW.email);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger after user signup
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user();
