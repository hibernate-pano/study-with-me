-- 创建图表表
CREATE TABLE IF NOT EXISTS public.chapter_diagrams (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  chapter_id UUID REFERENCES public.chapter_contents(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  diagram_type TEXT NOT NULL,
  mermaid_code TEXT NOT NULL,
  diagram_url TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 启用行级安全策略
ALTER TABLE public.chapter_diagrams ENABLE ROW LEVEL SECURITY;

-- 创建安全策略
CREATE POLICY "Users can view diagrams of chapters they have access to"
  ON public.chapter_diagrams
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.chapter_contents
      JOIN public.learning_paths ON chapter_contents.path_id = learning_paths.id
      WHERE chapter_contents.id = chapter_diagrams.chapter_id
      AND (learning_paths.user_id = auth.uid() OR learning_paths.is_public = true)
    )
  );

CREATE POLICY "Users can create diagrams for chapters they have access to"
  ON public.chapter_diagrams
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.chapter_contents
      JOIN public.learning_paths ON chapter_contents.path_id = learning_paths.id
      WHERE chapter_contents.id = chapter_diagrams.chapter_id
      AND learning_paths.user_id = auth.uid()
    )
  );

-- 创建索引
CREATE INDEX IF NOT EXISTS chapter_diagrams_chapter_id_idx ON public.chapter_diagrams(chapter_id);
