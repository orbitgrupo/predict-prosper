create table public.support_conversations (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  status text not null default 'open' check (status in ('open','closed')),
  closed_at timestamptz,
  closed_by uuid,
  updated_at timestamptz not null default now()
);
grant select, insert, update on public.support_conversations to authenticated;
grant all on public.support_conversations to service_role;
alter table public.support_conversations enable row level security;
create policy "Users view own conversation" on public.support_conversations for select to authenticated using (auth.uid() = user_id or public.has_role(auth.uid(),'admin'));
create policy "Users reopen own conversation" on public.support_conversations for insert to authenticated with check ((auth.uid() = user_id and status='open') or public.has_role(auth.uid(),'admin'));
create policy "Users reopen own, admins manage" on public.support_conversations for update to authenticated using (auth.uid() = user_id or public.has_role(auth.uid(),'admin')) with check ((auth.uid() = user_id and status='open') or public.has_role(auth.uid(),'admin'));
alter publication supabase_realtime add table public.support_conversations;