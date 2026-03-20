
CREATE POLICY "Users can update own comments within 5 minutes" ON public.market_comments
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id AND created_at > now() - interval '5 minutes')
  WITH CHECK (auth.uid() = user_id AND created_at > now() - interval '5 minutes');
