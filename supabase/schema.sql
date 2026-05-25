-- ========================================
-- MecânicaFlow - Schema Supabase
-- ========================================

-- Enable necessary extensions
create extension if not exists "uuid-ossp";

-- ========================================
-- ORGANIZATIONS (Oficinas clientes)
-- ========================================
create table public.organizations (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  owner_id uuid references auth.users(id) on delete cascade,
  settings jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ========================================
-- PROFILES (Extensão do auth.users)
-- ========================================
create table public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  full_name text,
  role text not null default 'client' check (role in ('admin', 'client')),
  org_id uuid references public.organizations(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ========================================
-- SERVICES (Tipos de serviço)
-- ========================================
create table public.services (
  id uuid default uuid_generate_v4() primary key,
  org_id uuid references public.organizations(id) on delete cascade not null,
  name text not null,
  description text,
  default_webhook_url text,
  created_at timestamptz default now()
);

-- ========================================
-- LEADS (Contatos importados)
-- ========================================
create table public.leads (
  id uuid default uuid_generate_v4() primary key,
  org_id uuid references public.organizations(id) on delete cascade not null,
  name text,
  phone text not null,
  email text,
  custom_fields jsonb default '{}'::jsonb,
  tags text[] default '{}',
  last_service_date date,
  last_contact_date timestamptz,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index leads_org_id_idx on public.leads(org_id);
create index leads_phone_idx on public.leads(phone);

-- ========================================
-- CADENCES (Sequências de disparo)
-- ========================================
create table public.cadences (
  id uuid default uuid_generate_v4() primary key,
  org_id uuid references public.organizations(id) on delete cascade not null,
  name text not null,
  service_id uuid references public.services(id) on delete set null,
  webhook_url text not null,
  webhook_body_template jsonb not null default '{}'::jsonb,
  status text not null default 'draft' check (status in ('draft', 'active', 'paused', 'completed')),
  schedule_type text not null default 'once' check (schedule_type in ('once', 'recurring')),
  schedule_config jsonb default '{}'::jsonb,
  target_filter jsonb default '{}'::jsonb,
  target_lead_ids uuid[],
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index cadences_org_id_idx on public.cadences(org_id);
create index cadences_status_idx on public.cadences(status);

-- ========================================
-- DISPATCHES (Histórico de envios)
-- ========================================
create table public.dispatches (
  id uuid default uuid_generate_v4() primary key,
  org_id uuid references public.organizations(id) on delete cascade not null,
  cadence_id uuid references public.cadences(id) on delete set null,
  lead_id uuid references public.leads(id) on delete cascade not null,
  webhook_url text not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending', 'scheduled', 'sent', 'failed')),
  scheduled_at timestamptz not null default now(),
  sent_at timestamptz,
  response_received boolean default false,
  notes text,
  created_at timestamptz default now()
);

create index dispatches_org_id_idx on public.dispatches(org_id);
create index dispatches_lead_id_idx on public.dispatches(lead_id);
create index dispatches_cadence_id_idx on public.dispatches(cadence_id);
create index dispatches_status_idx on public.dispatches(status);
create index dispatches_scheduled_at_idx on public.dispatches(scheduled_at);

-- ========================================
-- LEAD ACTIVITIES (Histórico de atividades)
-- ========================================
create table public.lead_activities (
  id uuid default uuid_generate_v4() primary key,
  lead_id uuid references public.leads(id) on delete cascade not null,
  dispatch_id uuid references public.dispatches(id) on delete set null,
  type text not null check (type in ('response', 'visit', 'note', 'dispatch')),
  description text,
  created_at timestamptz default now(),
  created_by uuid references auth.users(id) on delete set null
);

create index lead_activities_lead_id_idx on public.lead_activities(lead_id);

-- ========================================
-- TRIGGERS: updated_at automático
-- ========================================
create or replace function public.update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger organizations_updated_at
  before update on public.organizations
  for each row execute function public.update_updated_at();

create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.update_updated_at();

create trigger leads_updated_at
  before update on public.leads
  for each row execute function public.update_updated_at();

create trigger cadences_updated_at
  before update on public.cadences
  for each row execute function public.update_updated_at();

-- ========================================
-- TRIGGER: Criar profile após signup
-- ========================================
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    new.raw_user_meta_data->>'full_name',
    coalesce(new.raw_user_meta_data->>'role', 'client')
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ========================================
-- ROW LEVEL SECURITY (RLS)
-- ========================================

alter table public.organizations enable row level security;
alter table public.profiles enable row level security;
alter table public.services enable row level security;
alter table public.leads enable row level security;
alter table public.cadences enable row level security;
alter table public.dispatches enable row level security;
alter table public.lead_activities enable row level security;

-- Helper function: get current user's org_id
create or replace function public.get_user_org_id()
returns uuid as $$
  select org_id from public.profiles where id = auth.uid();
$$ language sql security definer stable;

-- Helper function: is current user admin?
create or replace function public.is_admin()
returns boolean as $$
  select role = 'admin' from public.profiles where id = auth.uid();
$$ language sql security definer stable;

-- Organizations policies
create policy "Admins can do everything on organizations"
  on public.organizations for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "Clients can view their own organization"
  on public.organizations for select
  to authenticated
  using (id = public.get_user_org_id());

-- Profiles policies
create policy "Users can view their own profile"
  on public.profiles for select
  to authenticated
  using (id = auth.uid());

create policy "Users can update their own profile"
  on public.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

create policy "Admins can view all profiles"
  on public.profiles for select
  to authenticated
  using (public.is_admin());

create policy "Admins can update all profiles"
  on public.profiles for update
  to authenticated
  using (public.is_admin());

create policy "Admins can insert profiles"
  on public.profiles for insert
  to authenticated
  with check (public.is_admin());

-- Services policies
create policy "Users can manage services in their org"
  on public.services for all
  to authenticated
  using (org_id = public.get_user_org_id() or public.is_admin())
  with check (org_id = public.get_user_org_id() or public.is_admin());

-- Leads policies
create policy "Users can manage leads in their org"
  on public.leads for all
  to authenticated
  using (org_id = public.get_user_org_id() or public.is_admin())
  with check (org_id = public.get_user_org_id() or public.is_admin());

-- Cadences policies
create policy "Users can manage cadences in their org"
  on public.cadences for all
  to authenticated
  using (org_id = public.get_user_org_id() or public.is_admin())
  with check (org_id = public.get_user_org_id() or public.is_admin());

-- Dispatches policies
create policy "Users can manage dispatches in their org"
  on public.dispatches for all
  to authenticated
  using (org_id = public.get_user_org_id() or public.is_admin())
  with check (org_id = public.get_user_org_id() or public.is_admin());

-- Lead activities policies
create policy "Users can manage activities for their org leads"
  on public.lead_activities for all
  to authenticated
  using (
    lead_id in (
      select id from public.leads
      where org_id = public.get_user_org_id()
    ) or public.is_admin()
  )
  with check (
    lead_id in (
      select id from public.leads
      where org_id = public.get_user_org_id()
    ) or public.is_admin()
  );

-- ========================================
-- FUNÇÃO: Processar disparos pendentes
-- (chamada pelo cron job)
-- ========================================
create or replace function public.process_pending_dispatches()
returns jsonb as $$
declare
  processed int := 0;
  dispatch_row record;
begin
  for dispatch_row in
    select * from public.dispatches
    where status = 'scheduled'
      and scheduled_at <= now()
    limit 100
  loop
    update public.dispatches
    set status = 'pending'
    where id = dispatch_row.id;
    processed := processed + 1;
  end loop;

  return jsonb_build_object('processed', processed);
end;
$$ language plpgsql security definer;
