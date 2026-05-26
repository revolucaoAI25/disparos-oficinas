# ESPECIFICAÇÃO COMPLETA — MecânicaFlow
## Prompt para recriação por IA — Plataforma SaaS de Disparos para Oficinas Mecânicas

---

## CONTEXTO: O QUE É ESTE DOCUMENTO E POR QUE ELE EXISTE

Este documento é a especificação técnica completa de um SaaS chamado **MecânicaFlow**, desenvolvido como MVP por um empreendedor do setor automotivo brasileiro.

### A ideia de negócio

O dono deste SaaS presta serviços para oficinas mecânicas e identificou uma dor recorrente: oficinas perdem clientes por falta de acompanhamento pós-atendimento. Um cliente troca o óleo, sai da oficina e nunca mais recebe contato. Seis meses depois, troca o óleo em outro lugar.

A solução é simples: disparar mensagens para a base de clientes da oficina em momentos estratégicos — lembretes de revisão, promoções sazonais, reativação de clientes sumidos. O problema é que as oficinas não têm estrutura para fazer isso sozinhas.

Por isso ele criou o **MecânicaFlow**: uma plataforma onde ele cadastra cada oficina como cliente, faz o setup inicial, e a oficina passa a ter uma ferramenta para gerenciar seus contatos e disparar mensagens automaticamente via WhatsApp (usando uma plataforma de disparo externa conectada por webhook).

### Como o negócio funciona na prática

1. O dono do SaaS (administrador) vende o serviço para uma oficina
2. Ele acessa o painel de admin, cria a conta da oficina e entrega as credenciais de acesso
3. A oficina faz login, importa sua base de clientes (planilha Excel/CSV com nome e telefone)
4. Configura cadências automáticas — por exemplo: "todo cliente que veio fazer troca de óleo recebe uma mensagem de lembrete 6 meses depois"
5. O sistema dispara as mensagens automaticamente nos dias certos, via webhook para a plataforma de WhatsApp
6. A oficina acompanha quem recebeu, quem respondeu, quem voltou

### O que é um "webhook" neste contexto

A plataforma **não envia mensagens diretamente**. Ela funciona como um orquestrador: nos momentos certos, ela faz uma requisição HTTP (POST) para um endpoint externo — no caso atual, o **ChatFlux** — passando os dados do cliente (nome, telefone, campos extras). O ChatFlux então dispara a mensagem de WhatsApp de fato. Isso significa que a plataforma de disparo pode ser trocada a qualquer momento, bastando mudar a URL do webhook.

### O que foi construído (MVP)

Este é um MVP funcional completo, construído com tecnologias modernas e hospedado gratuitamente (Supabase + Vercel plano gratuito). Ele já está em funcionamento e foi testado com importação de planilhas reais. As funcionalidades incluem:

- **Painel Admin** para gerenciar múltiplos clientes (oficinas)
- **Importação de planilhas** com mapeamento de colunas e campos personalizados
- **Cadências automáticas** com agendamento recorrente ou data específica
- **Disparos avulsos** imediatos ou agendados
- **Perfil individual de cada lead** com histórico de disparos e marcação de respostas
- **Dashboard** com métricas de disparos e taxa de resposta
- **Gerenciamento de serviços** por oficina

### Para quem é este documento

Este documento foi criado para que **qualquer IA generativa** (Claude, Lovable, GPT-4, Cursor, etc.) consiga recriar esta plataforma do zero, com todas as funcionalidades, a mesma stack tecnológica e o mesmo comportamento, sem precisar tomar nenhuma decisão de arquitetura — tudo já está definido aqui.

Se você é uma IA lendo isto: siga as especificações à risca. Se você é um humano passando isto para uma IA: não precisa explicar nada além deste documento — ele contém tudo.

---

> **INSTRUÇÕES PARA A IA:** Leia este documento inteiro antes de escrever qualquer código. Siga cada especificação exatamente como descrita. Não omita nenhuma funcionalidade. Não use bibliotecas alternativas às listadas. Crie todos os arquivos na estrutura exata indicada.

---

## 1. VISÃO GERAL DO PRODUTO

**Nome:** MecânicaFlow  
**Tipo:** SaaS multi-tenant B2B  
**Propósito:** Plataforma para o dono do SaaS (administrador) oferecer a oficinas mecânicas (clientes) uma ferramenta para disparar mensagens via webhook para suas bases de contatos (leads), com cadências automatizadas e disparos avulsos.

### Fluxo principal:
1. Admin cria uma organização (oficina) e um usuário de acesso para o cliente
2. Cliente faz login e importa sua base de contatos via planilha (CSV/XLSX)
3. Cliente cria cadências (sequências de disparo automático) ou faz disparos avulsos
4. O sistema envia requisições HTTP POST (webhooks) para endpoints externos configurados pelo cliente
5. O cliente acompanha histórico de disparos e marca leads que responderam/compareceram

---

## 2. STACK TECNOLÓGICA — USE EXATAMENTE ESTAS VERSÕES E BIBLIOTECAS

```json
{
  "framework": "Next.js 16+ com App Router e TypeScript",
  "banco_de_dados": "Supabase (PostgreSQL + Auth + RLS)",
  "hospedagem": "Vercel",
  "ui": "Tailwind CSS v4 + componentes Radix UI (NÃO use shadcn CLI — instale manual)",
  "dependencias": {
    "@supabase/supabase-js": "latest",
    "@supabase/ssr": "latest",
    "lucide-react": "latest",
    "papaparse": "latest",
    "@types/papaparse": "latest",
    "xlsx": "latest",
    "class-variance-authority": "latest",
    "clsx": "latest",
    "tailwind-merge": "latest",
    "@radix-ui/react-dialog": "latest",
    "@radix-ui/react-dropdown-menu": "latest",
    "@radix-ui/react-select": "latest",
    "@radix-ui/react-tabs": "latest",
    "@radix-ui/react-label": "latest",
    "@radix-ui/react-checkbox": "latest",
    "@radix-ui/react-slot": "latest",
    "@radix-ui/react-avatar": "latest",
    "@radix-ui/react-separator": "latest",
    "@radix-ui/react-popover": "latest",
    "@radix-ui/react-switch": "latest",
    "date-fns": "latest",
    "react-hook-form": "latest",
    "@hookform/resolvers": "latest",
    "zod": "latest",
    "sonner": "latest"
  }
}
```

**IMPORTANTE sobre Tailwind v4:**
- NÃO crie `tailwind.config.js` — Tailwind v4 é configurado via CSS
- O `postcss.config.mjs` usa `@tailwindcss/postcss` como plugin
- O `globals.css` começa com `@import "tailwindcss";` e usa `@theme inline {}`
- Instale também `@tailwindcss/postcss` como devDependency

**IMPORTANTE sobre Next.js:**
- Use App Router (pasta `app/`)
- Use route groups: `(auth)` para login, `(app)` para área autenticada
- Middleware de autenticação na raiz do projeto
- Server Components para páginas que buscam dados, Client Components para interatividade

---

## 3. ESTRUTURA COMPLETA DE ARQUIVOS

```
disparos-oficinas/
├── app/
│   ├── layout.tsx                          # Root layout (sem fontes Google, lang="pt-BR")
│   ├── page.tsx                            # Redireciona para /dashboard
│   ├── globals.css                         # Tailwind v4 + variáveis CSS + cursor global
│   ├── (auth)/
│   │   ├── layout.tsx                      # Retorna children diretamente
│   │   └── login/
│   │       └── page.tsx                    # Página de login (client component)
│   ├── (app)/
│   │   ├── layout.tsx                      # Layout com sidebar (server component)
│   │   ├── dashboard/
│   │   │   └── page.tsx                    # Dashboard com stats (server component)
│   │   ├── leads/
│   │   │   ├── page.tsx                    # Lista + importação (client component)
│   │   │   └── [id]/
│   │   │       └── page.tsx                # Perfil do lead (client component)
│   │   ├── cadences/
│   │   │   ├── page.tsx                    # Lista de cadências (server component)
│   │   │   ├── new/
│   │   │   │   └── page.tsx                # Wizard 5 etapas (client component)
│   │   │   └── [id]/
│   │   │       └── page.tsx                # Detalhe da cadência (server component)
│   │   ├── dispatches/
│   │   │   ├── page.tsx                    # Histórico (server component)
│   │   │   └── new/
│   │   │       └── page.tsx                # Disparo avulso (client component)
│   │   ├── services/
│   │   │   └── page.tsx                    # Gerenciar serviços (client component)
│   │   └── settings/
│   │       └── page.tsx                    # Configurações (client component)
│   ├── admin/
│   │   ├── layout.tsx                      # Layout admin (server component, verifica role=admin)
│   │   ├── page.tsx                        # Painel admin com stats globais
│   │   └── clients/
│   │       ├── page.tsx                    # Lista de clientes (client component)
│   │       └── [id]/
│   │           └── page.tsx                # Detalhe do cliente (server component)
│   └── api/
│       ├── admin/
│       │   └── organizations/
│       │       └── route.ts                # GET lista, POST cria org+usuário
│       ├── leads/
│       │   ├── import/
│       │   │   └── route.ts                # POST importa planilha
│       │   └── [id]/
│       │       └── route.ts                # PATCH e DELETE lead
│       ├── cadences/
│       │   ├── route.ts                    # GET lista, POST cria
│       │   └── [id]/
│       │       └── route.ts                # GET, PATCH, DELETE
│       ├── dispatches/
│       │   ├── route.ts                    # POST cria disparos (avulso ou cadência)
│       │   └── [id]/
│       │       └── route.ts                # PATCH, DELETE
│       └── cron/
│           └── process-dispatches/
│               └── route.ts                # GET processa agendados (cron job)
├── components/
│   ├── providers.tsx                       # Wrapper do Sonner Toaster
│   ├── layout/
│   │   ├── sidebar.tsx                     # Sidebar colapsável (client component)
│   │   ├── page-header.tsx                 # Cabeçalho de página reutilizável
│   │   └── stat-card.tsx                   # Card de estatística
│   └── ui/
│       ├── button.tsx                      # Componente Button com CVA
│       ├── input.tsx                       # Input estilizado
│       ├── label.tsx                       # Label Radix
│       ├── card.tsx                        # Card + CardHeader + CardContent etc
│       ├── badge.tsx                       # Badge com variantes
│       ├── select.tsx                      # Select Radix completo
│       ├── dialog.tsx                      # Dialog Radix completo
│       ├── textarea.tsx                    # Textarea estilizada
│       ├── tabs.tsx                        # Tabs Radix
│       ├── separator.tsx                   # Separator Radix
│       ├── switch.tsx                      # Switch Radix
│       ├── avatar.tsx                      # Avatar Radix
│       ├── checkbox.tsx                    # Checkbox Radix
│       └── dropdown-menu.tsx               # DropdownMenu Radix completo
├── lib/
│   ├── utils.ts                            # cn(), formatPhone, formatDate, etc
│   ├── webhooks.ts                         # sendWebhook(), buildWebhookPayload()
│   └── supabase/
│       ├── client.ts                       # createBrowserClient
│       ├── server.ts                       # createServerClient com cookies
│       └── admin.ts                        # createClient com service_role
├── types/
│   └── index.ts                            # Todos os tipos TypeScript
├── supabase/
│   └── schema.sql                          # Schema completo do banco
├── middleware.ts                           # Proteção de rotas + refresh de sessão
├── vercel.json                             # Configuração do cron job
└── .env.local.example                      # Exemplo de variáveis de ambiente
```

---

## 4. SCHEMA DO BANCO DE DADOS (Supabase)

Execute este SQL completo no SQL Editor do Supabase:

```sql
-- Habilita extensão UUID
create extension if not exists "uuid-ossp";

-- ═══════════════════════════════════════════
-- TABELAS PRINCIPAIS
-- ═══════════════════════════════════════════

-- Organizações (cada oficina cliente)
create table public.organizations (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  owner_id uuid references auth.users(id) on delete cascade,
  settings jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Perfis (extensão do auth.users)
create table public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  full_name text,
  role text not null default 'client' check (role in ('admin', 'client')),
  org_id uuid references public.organizations(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Tipos de serviço por organização
create table public.services (
  id uuid default uuid_generate_v4() primary key,
  org_id uuid references public.organizations(id) on delete cascade not null,
  name text not null,
  description text,
  default_webhook_url text,
  created_at timestamptz default now()
);

-- Contatos/leads importados
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

-- Cadências de disparo
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

-- Histórico de disparos individuais
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

-- Atividades e notas por lead
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

-- ═══════════════════════════════════════════
-- TRIGGERS: updated_at automático
-- ═══════════════════════════════════════════

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

-- ═══════════════════════════════════════════
-- TRIGGER: Criar profile após signup
-- ═══════════════════════════════════════════

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

-- ═══════════════════════════════════════════
-- ROW LEVEL SECURITY
-- ═══════════════════════════════════════════

alter table public.organizations enable row level security;
alter table public.profiles enable row level security;
alter table public.services enable row level security;
alter table public.leads enable row level security;
alter table public.cadences enable row level security;
alter table public.dispatches enable row level security;
alter table public.lead_activities enable row level security;

-- Funções helper
create or replace function public.get_user_org_id()
returns uuid as $$
  select org_id from public.profiles where id = auth.uid();
$$ language sql security definer stable;

create or replace function public.is_admin()
returns boolean as $$
  select role = 'admin' from public.profiles where id = auth.uid();
$$ language sql security definer stable;

-- Políticas de acesso
create policy "admin_all_organizations" on public.organizations for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "client_view_own_org" on public.organizations for select to authenticated
  using (id = public.get_user_org_id());

create policy "own_profile" on public.profiles for select to authenticated
  using (id = auth.uid());

create policy "update_own_profile" on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

create policy "admin_all_profiles" on public.profiles for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "org_services" on public.services for all to authenticated
  using (org_id = public.get_user_org_id() or public.is_admin())
  with check (org_id = public.get_user_org_id() or public.is_admin());

create policy "org_leads" on public.leads for all to authenticated
  using (org_id = public.get_user_org_id() or public.is_admin())
  with check (org_id = public.get_user_org_id() or public.is_admin());

create policy "org_cadences" on public.cadences for all to authenticated
  using (org_id = public.get_user_org_id() or public.is_admin())
  with check (org_id = public.get_user_org_id() or public.is_admin());

create policy "org_dispatches" on public.dispatches for all to authenticated
  using (org_id = public.get_user_org_id() or public.is_admin())
  with check (org_id = public.get_user_org_id() or public.is_admin());

create policy "org_lead_activities" on public.lead_activities for all to authenticated
  using (
    lead_id in (select id from public.leads where org_id = public.get_user_org_id())
    or public.is_admin()
  )
  with check (
    lead_id in (select id from public.leads where org_id = public.get_user_org_id())
    or public.is_admin()
  );
```

---

## 5. VARIÁVEIS DE AMBIENTE

### Arquivo `.env.local` (desenvolvimento local):
```
NEXT_PUBLIC_SUPABASE_URL=https://seu-projeto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua-anon-key
SUPABASE_SERVICE_ROLE_KEY=sua-service-role-key
CRON_SECRET=string-aleatoria-secreta
```

### No Vercel (produção):
Adicionar as mesmas 4 variáveis em Settings → Environment Variables.

---

## 6. CONFIGURAÇÃO DO VERCEL (vercel.json)

```json
{
  "crons": [
    {
      "path": "/api/cron/process-dispatches",
      "schedule": "0 8 * * *"
    }
  ]
}
```

**Nota:** O plano Hobby do Vercel só permite crons diários. O cron roda às 8h UTC todos os dias para processar disparos agendados. Disparos com status "pending" (imediatos) são processados na hora pelo próprio endpoint da API, sem depender do cron.

---

## 7. ESPECIFICAÇÃO DETALHADA DE CADA ARQUIVO

### 7.1 `app/globals.css`
```css
@import "tailwindcss";

:root {
  --background: #ffffff;
  --foreground: #0f172a;
}

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
}

body {
  background: var(--background);
  color: var(--foreground);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
  -webkit-font-smoothing: antialiased;
}

* { box-sizing: border-box; }

/* Cursor pointer global em todos os elementos interativos */
button, [role="button"], label[for], a { cursor: pointer; }
button:disabled { cursor: not-allowed; }

/* Scrollbar personalizada */
::-webkit-scrollbar { width: 6px; height: 6px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 3px; }
::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
```

### 7.2 `app/layout.tsx` (Root Layout)
- Sem fontes do Google (remova Geist)
- `lang="pt-BR"`
- Wrapa `children` com `<Providers>` (componente que adiciona o Sonner Toaster)
- Metadata: título "MecânicaFlow – Plataforma de Disparos para Oficinas"

### 7.3 `middleware.ts`
- Usa `createServerClient` do `@supabase/ssr`
- Rotas públicas: `/login`, `/api/cron/*`
- Se não autenticado → redireciona para `/login`
- Se autenticado e tenta acessar `/login` → redireciona para `/dashboard`
- Matcher: exclui `_next/static`, `_next/image`, `favicon.ico`, imagens

### 7.4 `lib/utils.ts` — Funções utilitárias:
```typescript
// Funções obrigatórias:
cn(...inputs: ClassValue[])           // tailwind-merge + clsx
formatPhone(phone: string)            // formata número BR: (11) 99999-9999
formatDate(date: string | null)       // dd/MM/yyyy ou "—"
formatDateTime(date: string | null)   // dd/MM/yyyy HH:mm ou "—"
formatRelativeDate(date: string)      // "há 2 dias", "ontem", "agora mesmo"
interpolateTemplate(template, data)   // substitui {{variavel}} nos valores
buildWebhookPayload(template, lead)   // monta payload com nome, telefone, custom_fields
getStatusColor(status: string)        // retorna classes CSS para o status
getStatusLabel(status: string)        // retorna label PT-BR para o status
```

**Status colors:**
- `active` → `bg-emerald-100 text-emerald-700`
- `paused` → `bg-amber-100 text-amber-700`
- `completed` → `bg-slate-100 text-slate-600`
- `draft` → `bg-blue-100 text-blue-700`
- `sent` → `bg-emerald-100 text-emerald-700`
- `failed` → `bg-red-100 text-red-700`
- `pending` → `bg-amber-100 text-amber-700`
- `scheduled` → `bg-blue-100 text-blue-700`

### 7.5 `lib/supabase/client.ts`
```typescript
import { createBrowserClient } from '@supabase/ssr'
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

### 7.6 `lib/supabase/server.ts`
```typescript
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
export async function createClient() {
  const cookieStore = await cookies()
  return createServerClient(URL, ANON_KEY, {
    cookies: {
      getAll() { return cookieStore.getAll() },
      setAll(cookiesToSet) { /* set em try/catch */ }
    }
  })
}
```

### 7.7 `lib/supabase/admin.ts`
```typescript
import { createClient } from '@supabase/supabase-js'
export function createAdminClient() {
  return createClient(URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
  })
}
```

---

## 8. ESPECIFICAÇÃO DE TODOS OS TIPOS (types/index.ts)

```typescript
type UserRole = 'admin' | 'client'
type CadenceStatus = 'draft' | 'active' | 'paused' | 'completed'
type ScheduleType = 'once' | 'recurring'
type DispatchStatus = 'pending' | 'scheduled' | 'sent' | 'failed'
type ActivityType = 'response' | 'visit' | 'note' | 'dispatch'

interface Profile { id, full_name, role: UserRole, org_id, created_at, updated_at }
interface Organization { id, name, owner_id, created_at, updated_at, settings }
interface Service { id, org_id, name, description, default_webhook_url, created_at }
interface Lead {
  id, org_id, name, phone, email
  custom_fields: Record<string, string>  // campos extras da planilha
  tags: string[]
  last_service_date: string | null
  last_contact_date: string | null
  notes, created_at, updated_at
}
interface ScheduleConfig {
  date?: string           // para schedule_type = 'once'
  time?: string
  interval_months?: number  // para schedule_type = 'recurring'
  start_date?: string
  end_date?: string | null
}
interface Cadence {
  id, org_id, name, service_id, webhook_url
  webhook_body_template: Record<string, string>  // ex: {"name": "{{nome}}", "phone": "{{telefone}}"}
  status: CadenceStatus
  schedule_type: ScheduleType
  schedule_config: ScheduleConfig
  target_filter: Record<string, unknown>  // filtros de leads
  target_lead_ids: string[] | null        // IDs manuais
  created_at, updated_at
  services?: Service  // join
}
interface Dispatch {
  id, org_id, cadence_id, lead_id, webhook_url
  payload: Record<string, unknown>  // payload real enviado (com variáveis substituídas)
  status: DispatchStatus
  scheduled_at, sent_at, response_received, notes, created_at
  leads?: Lead   // join
  cadences?: Cadence  // join
}
interface LeadActivity {
  id, lead_id, dispatch_id, type: ActivityType
  description, created_at, created_by
  dispatches?: Dispatch  // join
}
```

---

## 9. ESPECIFICAÇÃO DOS COMPONENTES UI

Todos os componentes ficam em `components/ui/`. São construídos manualmente com Radix UI primitives + CVA + Tailwind. Paleta de cores: `slate` para neutros, `emerald` para sucesso, `amber` para aviso, `red` para erro.

### Button (CVA com variantes):
- **Variantes:** `default` (slate-900 bg, white text), `destructive` (red-500), `outline` (border slate-200, white bg), `secondary` (slate-100), `ghost` (hover slate-100), `link`, `success` (emerald-600)
- **Tamanhos:** `default` (h-9), `sm` (h-8), `lg` (h-11), `icon` (h-9 w-9)
- **IMPORTANTE:** incluir `cursor-pointer` nas classes base e `disabled:cursor-not-allowed`

### Card: Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter
- Border `border-slate-200`, bg white, `rounded-xl`, `shadow-sm`

### Badge (CVA):
- **Variantes:** `default`, `secondary`, `destructive`, `outline`, `success` (emerald), `warning` (amber), `info` (blue)
- Shape: `rounded-full`

### Input:
- `h-9`, `rounded-lg`, `border-slate-200`
- Focus: `ring-2 ring-slate-900`

### Select, Dialog, Tabs, Separator, Switch, Avatar, Checkbox, DropdownMenu:
- Todos seguem o padrão Radix com estilização slate/white
- Animações: `data-[state=open]:animate-in`, `data-[state=closed]:animate-out`

---

## 10. ESPECIFICAÇÃO DO LAYOUT (Sidebar)

**Arquivo:** `components/layout/sidebar.tsx` — `"use client"`

### Comportamento:
- Sidebar vertical fixa à esquerda, altura 100vh
- **Colapsável:** botão com ChevronLeft/Right, largura alterna entre `w-64` (expandido) e `w-16` (colapsado)
- Quando colapsada: mostra só ícones, sem texto
- Logo: ícone Wrench em fundo slate-900, texto "MecânicaFlow" (oculto quando colapsado)

### Itens de navegação (sempre visíveis):
```
Dashboard  → /dashboard  (ícone: LayoutDashboard)
Leads      → /leads      (ícone: Users)
Cadências  → /cadences   (ícone: Zap)
Disparos   → /dispatches (ícone: Send)
Serviços   → /services   (ícone: Wrench)
Configurações → /settings (ícone: Settings)
```

### Itens admin (visíveis só se role === 'admin'):
```
Seção "ADMINISTRAÇÃO":
Admin   → /admin          (ícone: Shield)
Clientes → /admin/clients (ícone: Building2)
```

### Link ativo: `bg-slate-900 text-white`
### Link inativo: `text-slate-600 hover:bg-slate-100`

### Rodapé da sidebar:
- Avatar com iniciais do nome (bg-slate-900 text-white)
- Nome e nome da organização (ocultos quando colapsado)
- Botão "Sair" que chama `supabase.auth.signOut()` e redireciona para `/login`

---

## 11. ESPECIFICAÇÃO DE CADA PÁGINA

### 11.1 `/login` — Página de Login
**Tipo:** Client Component  
**Layout:** Centralizado, fundo `from-slate-50 to-slate-100` gradiente  
**Conteúdo:**
- Logo (ícone Wrench em bg-slate-900 rounded-2xl)
- Título "MecânicaFlow"
- Subtítulo "Plataforma de disparos para oficinas"
- Card com formulário: campo email, campo password (type=password)
- Mensagem de erro com ícone AlertCircle se credenciais inválidas
- Botão "Entrar" com loading spinner durante submit
- Texto abaixo: "Acesso restrito. Entre em contato com o administrador para criar uma conta."
- Sem link de cadastro — acesso só via admin
- `supabase.auth.signInWithPassword()` → sucesso redireciona para `/dashboard`

### 11.2 `/dashboard` — Dashboard Principal
**Tipo:** Server Component  
**Dados buscados via Supabase server client:**

**4 StatCards no topo:**
- Total de Leads (contagem na tabela leads do org)
- Cadências Ativas (cadences com status='active')
- Disparos Hoje (dispatches com status='sent' e sent_at >= hoje 00:00)
- Taxa de Resposta (% de dispatches com response_received=true sobre total sent)

**Coluna esquerda (2/3):** Card "Disparos Recentes"
- Lista os 8 últimos dispatches com: ícone de status (CheckCircle2/XCircle/Clock coloridos), nome do lead, data, badge "Respondeu" se response_received, badge de status
- Empty state com CTA "Fazer primeiro disparo"

**Coluna direita (1/3):**
- Card "Cadências Ativas": lista as 5 cadências ativas com nome, serviço e tipo de agendamento
- Card "Ações Rápidas": 3 botões outline: "Importar leads" → /leads, "Nova cadência" → /cadences/new, "Disparo avulso" → /dispatches/new

**Saudação:** "Bom dia/Boa tarde/Boa noite, {primeiro nome}! 👋" baseada na hora

### 11.3 `/leads` — Gerenciar Leads
**Tipo:** Client Component (por causa de busca, seleção e dialog de import)

**ATENÇÃO CRÍTICA:** Se `profile.org_id` for null (usuário admin sem org), chamar `setLoading(false)` imediatamente e mostrar empty state. NUNCA deixar loading eterno.

**Layout:**
- PageHeader "Leads" + botão "Importar Planilha" → abre dialog
- Barra de busca (busca por nome ou telefone, envia parâmetro `?q=` via router.push)
- Contador de leads total à direita da barra
- Tabela paginada (50 por página) com skeleton loading rows enquanto carrega

**Colunas da tabela:**
1. Checkbox (selecionar todos / individual)
2. NOME (com link para /leads/[id])
3. TELEFONE (formatado)
4. CAMPOS EXTRAS (custom_fields como badges pequenos variant="outline", máx 3 visíveis)
5. ÚLTIMA VISITA (last_service_date formatada)
6. CADASTRO (created_at formatado)
7. Botão ação: ícone ExternalLink → /leads/[id]

**Floating bar** (aparece quando há selecionados): mostra quantos selecionados + botão excluir em lote

**Empty state:** ícone Users grande, texto, botão "Importar Planilha"

**Paginação:** ChevronLeft/Right com contador "Página X de Y"

### 11.4 Dialog de Importação de Planilha
**4 etapas dentro do Dialog:**

**Etapa 1: Upload**
- Área de drag-and-drop com borda dashed
- Aceita `.csv`, `.xlsx`, `.xls`
- Ou clique para abrir file picker
- Ao selecionar arquivo: parse com papaparse (CSV) ou xlsx (Excel)
- Mostra nome do arquivo e contagem de linhas
- Avança automaticamente para Etapa 2

**Etapa 2: Mapeamento de colunas**
- Para cada coluna detectada na planilha: um Select com opções:
  - "— Ignorar —"
  - "Telefone (obrigatório)"
  - "Nome"
  - "Campo personalizado" (mantém o nome original da coluna)
- Preview das 3 primeiras linhas da planilha
- Mensagem de erro se não mapear o telefone
- Botões: "Trocar arquivo" | "Importar X leads"

**Etapa 3: Progresso**
- Spinner + barra de progresso
- Texto "Importando X leads..."

**Etapa 4: Sucesso**
- Ícone CheckCircle2 verde
- "Importação concluída!"
- Contadores: X importados, Y atualizados

**Lógica de envio para `/api/leads/import`:**
- Mapeia as colunas para phone, name, e custom_fields (campos não mapeados viram custom_fields)
- Envia `{ leads: [...], org_id }`

### 11.5 `/leads/[id]` — Perfil do Lead
**Tipo:** Client Component

**Layout two-column:**

**Coluna esquerda:**
- Header: nome (grande, editável inline), telefone formatado, tags como badges
- Botões: "Editar" (abre dialog), "Marcar como visitou" (insere LeadActivity tipo 'visit')
- Card "Informações": lista todos os campos do lead + custom_fields como pares chave:valor editáveis
- Editor de custom_fields: adicionar/remover/editar pares, salva via PATCH /api/leads/[id]

**Coluna direita:**
- Card "Timeline": lista lead_activities em ordem cronológica reversa
  - Ícone diferente por tipo: response (MessageCircle verde), visit (Car azul), note (FileText cinza), dispatch (Send roxo)
  - Data relativa ("há 2 dias")
- Botão "Adicionar nota" → abre Dialog simples com textarea, salva como LeadActivity tipo 'note'

**Seção inferior:**
- Tabela "Histórico de Disparos"
- Colunas: Data, Cadência (ou "Avulso"), Status, Webhook URL (mascarada), Resposta
- Para cada dispatch com status='sent' e response_received=false: botão "Marcar como respondeu"
  - Clicar: PATCH /api/dispatches/[id] com `{response_received: true}` + insere LeadActivity tipo 'response'

### 11.6 `/cadences` — Lista de Cadências
**Tipo:** Server Component

**Layout:**
- PageHeader + botão "Nova Cadência" → /cadences/new
- 4 chips de stats: Total, Ativas, Pausadas, Rascunhos
- Tabela com colunas: Nome, Serviço, Status (badge colorido), Agendamento (texto descritivo), Ações

**Ações por cadência:**
- Ativar/Pausar (toggle status via Server Action ou API)
- Editar → /cadences/[id]
- Excluir (com confirmação)

**Empty state** com CTA para criar primeira cadência

### 11.7 `/cadences/new` — Criar Cadência (Wizard 5 Etapas)
**Tipo:** Client Component

**Barra de progresso no topo:** 5 etapas com indicadores (done=verde, active=slate-900, upcoming=cinza)

**Etapa 1 — Informações Básicas:**
- Campo: Nome da cadência (obrigatório)
- Select: Serviço associado (lista services da org, ou "Sem serviço")
- Textarea: Descrição (opcional)

**Etapa 2 — Configurar Webhook:**
- Input: URL do Webhook (obrigatório, validar URL)
- Editor dinâmico de chave-valor para o corpo do JSON:
  - Cada linha: input "chave" + input "valor ou {{variável}}" + botão remover
  - Botão "Adicionar campo"
  - Valores suportam variáveis: `{{nome}}`, `{{telefone}}`, `{{qualquer_campo_custom}}`
- Painel "Variáveis disponíveis": chips mostrando {{nome}}, {{telefone}} + campos custom dos leads da org
- Preview ao vivo do JSON que será enviado (bloco código bg-slate-900 text-emerald-400)

**Etapa 3 — Agendamento:**
- Toggle: "Uma vez" | "Recorrente"
- Se "Uma vez": date picker + time picker
- Se "Recorrente": select de intervalo (1, 2, 3, 6, 12 meses) + data de início + data de fim (opcional)
- Descrição contextual do que acontecerá

**Etapa 4 — Selecionar Leads:**
- 3 opções (radio-style buttons):
  - "Todos os leads" (mostra contagem)
  - "Filtrar por campo": adicionar regras de filtro (campo + operador: contém/igual/maior/menor + valor)
  - "Selecionar manualmente": lista com search + checkboxes
- Mostra contagem de leads impactados

**Etapa 5 — Revisar:**
- Tabela de resumo: Nome, Serviço, Agendamento, Webhook URL, Campos configurados, Destinatários
- Preview do JSON final
- Aviso: "A cadência será criada com status Rascunho. Ative na página de detalhes."
- Botão "Criar Cadência"

**Validação por etapa** antes de avançar. Mensagem de erro inline.

**Submit:** POST para `/api/cadences` → redireciona para `/cadences/[id]` da cadência criada

### 11.8 `/cadences/[id]` — Detalhe da Cadência
**Tipo:** Server Component (com Server Actions para toggle/delete)

**Header:**
- Nome da cadência + badge de status
- Datas de criação/atualização
- Botões: Ativar/Pausar, Editar, Excluir, "Disparar Agora" (processa todos os leads imediatamente)

**Two columns:**
- Esquerda: Card configurações (webhook URL mascarada, tipo agendamento, descrição do schedule, campos do payload)
- Direita: 6 stat boxes (total disparos, enviados, falhou, pendentes, leads únicos, taxa de resposta)

**Tabela inferior:** 20 disparos mais recentes desta cadência

### 11.9 `/dispatches` — Histórico de Disparos
**Tipo:** Server Component

**Filtros por status** (botões pill no topo):
- Todos | Enviados | Pendentes | Agendados | Falhou
- Cada botão mostra contagem
- Filtro via URL `?status=` + `?page=`

**Tabela com colunas:** Lead (nome), Telefone, Cadência (ou "Avulso"), Status (badge), Agendado (data), Resposta (badge "✓ Respondeu"), Link para perfil do lead

**Paginação:** 25 por página

### 11.10 `/dispatches/new` — Disparo Avulso
**Tipo:** Client Component

**ATENÇÃO CRÍTICA:** Se `profile.org_id` for null, chamar `setLoading(false)` imediatamente. NUNCA deixar loading eterno.

**Seção 1 — Selecionar Leads:**
- Toggle visual: "Todos os leads" | "Selecionar manualmente"
- Se manual: search + lista com checkboxes (mostra 50, busca filtra)
- Contador de leads impactados

**Seção 2 — Configurar Webhook:**
- Select de serviço (pré-preenche webhook_url)
- Input URL do webhook
- Editor de chave-valor do payload (mesmo da criação de cadência)
- Painel de variáveis disponíveis
- Preview JSON ao vivo

**Seção 3 — Agendamento:**
- Toggle: "Agora" | "Agendar"
- Se "Agendar": datetime-local picker

**Botão submit:** "Criar X disparo(s)" — POST para `/api/dispatches`

**Lógica de disparo imediato:** O endpoint `/api/dispatches` envia os webhooks na hora para status 'pending' (agora). Para 'scheduled', apenas salva no banco para o cron processar.

### 11.11 `/services` — Gerenciar Serviços
**Tipo:** Client Component

**ATENÇÃO CRÍTICA:** Se `profile.org_id` for null, chamar `setLoading(false)`. NUNCA loading eterno.

**Layout two-column:**
- Esquerda: Lista de serviços cadastrados com botões editar/excluir
- Direita: Grid de "Serviços Padrão" para adicionar com 1 clique

**Serviços padrão disponíveis:**
- Troca de Óleo, Revisão Completa, Alinhamento e Balanceamento, Troca de Pastilhas de Freio, Diagnóstico Elétrico, Troca de Correia Dentada, Ar Condicionado, Suspensão

**Dialog de criação/edição:**
- Nome (obrigatório), Descrição (opcional), URL do Webhook padrão (opcional — pré-preenchida ao criar cadências com este serviço)

### 11.12 `/settings` — Configurações
**Tipo:** Client Component

**3 Cards:**
1. "Meu Perfil": editar full_name, e-mail (somente leitura)
2. "Organização": editar nome da org (só se org_id existir)
3. "Alterar Senha": nova senha + confirmar (via `supabase.auth.updateUser({password})`)

### 11.13 `/admin` — Painel Admin
**Tipo:** Server Component  
**Acesso:** Só usuários com `role = 'admin'` (verificado no layout)

**Layout admin:** Mesmo sidebar mas com itens de admin destacados

**Conteúdo:**
- 4 StatCards: Organizações, Usuários, Total de Leads, Total de Disparos (todos os dados do sistema)
- Tabela "Clientes Recentes" com link para detalhe

### 11.14 `/admin/clients` — Gerenciar Clientes
**Tipo:** Client Component

**Features:**
- Busca por nome/e-mail
- Tabela: Organização, E-mail, Leads, Disparos, Data criação, Link detalhes
- Botão "Novo Cliente" → Dialog de criação

**Dialog "Novo Cliente":**
- Campo: Nome da oficina
- Seção "Dados de acesso": Nome completo, E-mail, Senha inicial
- Submit → POST `/api/admin/organizations`
- Backend cria: organização + usuário Auth + profile + 4 serviços padrão

### 11.15 `/admin/clients/[id]` — Detalhe do Cliente
**Tipo:** Server Component

- 4 StatCards: Leads, Disparos, Cadências Ativas, Usuários
- Card de usuários da organização
- Card de cadências
- Tabela de 10 disparos recentes

---

## 12. ESPECIFICAÇÃO DAS API ROUTES

### `POST /api/leads/import`
**Lógica (SEM upsert com onConflict — fazer manualmente):**
1. Validar auth + org_id
2. Normalizar telefones (remover espaços, manter só dígitos, aceitar + no início)
3. Buscar telefones existentes desta org: `select id, phone from leads where org_id = X and phone IN (...)`
4. Separar em `toInsert` (novos) e `toUpdate` (existentes)
5. `insert` os novos em lotes de 100
6. `update` os existentes individualmente (nome e custom_fields)
7. Retornar `{ imported, skipped, updated }`

### `PATCH /api/leads/[id]`
Campos permitidos: `name`, `notes`, `tags`, `email`, `custom_fields`, `last_service_date`, `last_contact_date`

### `DELETE /api/leads/[id]`
Deleta o lead (atividades e disparos em cascata pelo banco)

### `POST /api/cadences`
1. Validar todos os campos obrigatórios
2. Inserir cadência com status 'draft'
3. Determinar leads alvo:
   - `target_lead_ids` fornecidos → usar esses
   - `target_filter` fornecido → query com filtros dinâmicos
   - Nenhum → todos os leads da org
4. Calcular `scheduled_at` baseado em `schedule_config`
5. Criar registros de `dispatches` para cada lead com payload pré-calculado (`buildWebhookPayload`)
6. Retornar cadência criada com ID

### `PATCH /api/cadences/[id]`
Atualiza campos da cadência (name, status, webhook_url, etc.)

### `DELETE /api/cadences/[id]`
Deleta cadência (dispatches ficam com cadence_id null)

### `POST /api/dispatches`
1. Validar auth + org_id
2. Buscar leads alvo (todos ou ids específicos)
3. Para cada lead: `buildWebhookPayload(template, lead)` → payload final
4. Criar registros de dispatches com status 'pending' (agora) ou 'scheduled'
5. Se 'pending': enviar webhooks imediatamente via `fetch(webhook_url, {method: POST, body: JSON.stringify(payload)})`
6. Atualizar status para 'sent' ou 'failed' baseado no response
7. Atualizar `last_contact_date` dos leads enviados

### `PATCH /api/dispatches/[id]`
Permite atualizar `response_received`, `notes`, `status`

### `GET /api/admin/organizations`
Verifica role=admin, retorna todas as orgs com stats (count de leads, dispatches, e-mail do owner)

### `POST /api/admin/organizations`
Verifica role=admin, cria:
1. Organização
2. Usuário Auth (`admin.auth.admin.createUser({email_confirm: true})`)
3. Profile com role='client' e org_id
4. 4 serviços padrão para a org
Rollback da org se criação do usuário falhar.

### `GET /api/cron/process-dispatches`
1. Verificar `Authorization: Bearer {CRON_SECRET}`
2. Buscar dispatches com status='scheduled' e scheduled_at <= now() (máx 100)
3. Buscar dispatches com status='pending' (máx 100)
4. Para cada um: enviar webhook, atualizar status para 'sent'/'failed', atualizar `last_contact_date`
5. Retornar `{ processed, failed, total }`

---

## 13. LÓGICA DO WEBHOOK

### Formato do template:
```json
{
  "name": "{{nome}}",
  "phone": "{{telefone}}",
  "campo_qualquer": "{{campo_custom}}"
}
```

### Variáveis disponíveis:
- `{{nome}}` ou `{{name}}` → lead.name
- `{{telefone}}` ou `{{phone}}` → lead.phone
- `{{chave}}` onde `chave` é qualquer chave em `lead.custom_fields`

### Função `buildWebhookPayload`:
```typescript
function buildWebhookPayload(template, lead) {
  const data = {
    nome: lead.name ?? '',
    name: lead.name ?? '',
    telefone: lead.phone,
    phone: lead.phone,
    ...lead.custom_fields
  }
  // Para cada value no template, substituir {{variavel}} pelo valor em data
  return interpolateTemplate(template, data)
}
```

### Envio:
```http
POST {webhook_url}
Content-Type: application/json

{payload_com_variaveis_substituidas}
```

---

## 14. DESIGN SYSTEM

**Paleta:**
- Primário: `slate-900` (#0f172a) — botões, links ativos, textos principais
- Secundário: `slate-100/200` — fundos, bordas
- Sucesso: `emerald-600` — enviado, ativo
- Aviso: `amber-600` — pausado, pendente
- Erro: `red-500` — falhou, excluir
- Info: `blue-600` — agendado

**Tipografia:**
- Fonte: system-ui stack (sem Google Fonts)
- Hierarquia: títulos de página `text-2xl font-bold`, títulos de card `text-base font-semibold`, corpo `text-sm`

**Componentes visuais:**
- Cards: `rounded-xl border border-slate-200 bg-white shadow-sm`
- Inputs: `rounded-lg border-slate-200 h-9 focus:ring-2 focus:ring-slate-900`
- Botão primário: `bg-slate-900 text-white hover:bg-slate-800 rounded-lg`
- Tabelas: `divide-y divide-slate-100`, header `bg-slate-50`
- Empty states: ícone centralizado com opacidade 40%, texto, botão CTA

---

## 15. CONFIGURAÇÃO SUPABASE — PASSO A PASSO

### Passo 1: Criar projeto
1. Acessar supabase.com → New Project
2. Região: South America (São Paulo)
3. Aguardar inicialização (~2 minutos)

### Passo 2: Executar schema
1. SQL Editor → New Query
2. Colar todo o conteúdo de `supabase/schema.sql`
3. Executar (Run) — deve retornar "Success. No rows returned"

### Passo 3: Configurar autenticação
1. Authentication → Providers → Email
2. **Desabilitar "Confirm email"** (admin cria usuários manualmente, sem e-mail de confirmação)
3. Salvar

### Passo 4: Copiar credenciais
1. Project Settings → API
2. Copiar: Project URL, anon key, service_role key

### Passo 5: Criar usuário administrador
1. Authentication → Users → Add user → Create new user
2. Preencher e-mail e senha do dono do SaaS
3. Copiar o User UID gerado
4. SQL Editor → executar:
```sql
UPDATE public.profiles 
SET role = 'admin' 
WHERE id = 'COLE-O-UID-AQUI';
```

---

## 16. CONFIGURAÇÃO VERCEL — PASSO A PASSO

### Passo 1: Conectar repositório
1. vercel.com → New Project
2. Importar repositório do GitHub/GitLab
3. Framework Preset: Next.js (detectado automaticamente)

### Passo 2: Variáveis de ambiente
Em Settings → Environment Variables, adicionar:
```
NEXT_PUBLIC_SUPABASE_URL      = (Project URL do Supabase)
NEXT_PUBLIC_SUPABASE_ANON_KEY = (anon key do Supabase)
SUPABASE_SERVICE_ROLE_KEY     = (service_role key do Supabase)
CRON_SECRET                   = (qualquer string aleatória, ex: abc123xyz789)
```
Marcar todas para: Production + Preview + Development

### Passo 3: Deploy
1. Clicar em Deploy
2. Aguardar build (1-3 minutos)
3. Acessar URL gerada pelo Vercel

### Passo 4: Verificar cron job
1. No painel Vercel → projeto → Settings → Crons
2. O cron `0 8 * * *` deve aparecer automaticamente (lido do `vercel.json`)
3. O endpoint `/api/cron/process-dispatches` será chamado com o header `Authorization: Bearer {CRON_SECRET}`

### Passo 5: Testar
1. Acessar a URL do Vercel
2. Fazer login com as credenciais do admin criado no Supabase
3. Ir em Admin → Clientes → Criar primeiro cliente
4. Abrir nova aba anônima, logar com o usuário do cliente
5. Importar uma planilha de teste, criar uma cadência, fazer um disparo

---

## 17. COMPORTAMENTOS CRÍTICOS A IMPLEMENTAR (NÃO ESQUECER)

1. **Loading infinito em pages client:** Sempre que `profile.org_id` for null, chamar `setLoading(false)` e retornar — NUNCA deixar a página carregando eternamente. Isso acontece porque o admin não tem org_id.

2. **Cursor pointer:** Adicionar `cursor: pointer` globalmente para `button`, `a`, `[role="button"]`, `label[for]`. Sem isso os botões parecem não-clicáveis.

3. **Import de planilha sem constraint UNIQUE:** A importação NÃO usa `upsert` com `onConflict`. Em vez disso: busca telefones existentes → insert novos → update existentes manualmente.

4. **Webhook payload pré-calculado:** O payload final (com variáveis substituídas) é calculado na hora da criação do dispatch e salvo na coluna `payload`. O cron usa o `payload` salvo, não recalcula.

5. **Admin sem org:** O usuário admin não tem `org_id`. Ele só usa `/admin` e `/admin/clients`. Se acessar `/leads`, `/dispatches`, etc., deve ver estado vazio (não travado).

6. **Disparo imediato vs agendado:**
   - Status 'pending' = enviar AGORA (processado dentro da API route `/api/dispatches`)
   - Status 'scheduled' = enviar na data futura (processado pelo cron job)

7. **Autenticação do cron:** O endpoint `/api/cron/process-dispatches` verifica `Authorization: Bearer {CRON_SECRET}`. Sem esse header, retorna 401. O Vercel envia esse header automaticamente se configurado — ou use serviço externo como cron-job.org com o header manual.

---

## 18. FLUXO DE USO ESPERADO

```
1. Dono do SaaS (admin) faz login
2. Admin → Criar cliente (preenche nome da oficina + e-mail + senha)
3. Sistema cria org + usuário automaticamente com 4 serviços padrão
4. Cliente faz login com suas credenciais
5. Leads → Importar Planilha (CSV/XLSX com nome e telefone)
6. Sistema mapeia colunas, importa leads, salva custom_fields extras
7. Serviços → adicionar serviços específicos da oficina (opcional)
8. Cadências → Nova Cadência (wizard 5 etapas):
   a. Nome + serviço
   b. URL do webhook + corpo JSON com variáveis
   c. Agendamento (recorrente a cada 6 meses, por exemplo)
   d. Todos os leads ou filtrados
   e. Revisar → Criar (status: Rascunho)
9. Na página da cadência → clicar "Ativar"
10. Sistema começa a criar dispatches agendados
11. Cron job (8h diariamente) processa e envia webhooks
12. Webhook externo (chatflux, etc.) recebe e dispara a mensagem via WhatsApp
13. Lead responde → cliente vai em Leads → perfil do lead → "Marcar como respondeu"
14. Cliente acompanha taxa de resposta no Dashboard
```

---

## 19. EXEMPLO DE WEBHOOK (formato real usado)

```http
POST https://alpha.chatflux.ai/api/v1/webhook/8Ol8imJXDX2WBzGc
Content-Type: application/json

{
  "name": "João Silva",
  "phone": "5511999887766",
  "date": "08:00"
}
```

O template configurado pelo cliente seria:
```json
{
  "name": "{{nome}}",
  "phone": "{{telefone}}",
  "date": "08:00"
}
```

Os campos `{{nome}}` e `{{telefone}}` são substituídos pelos dados do lead. Campos estáticos como `"date": "08:00"` permanecem iguais para todos os leads.

---

**FIM DA ESPECIFICAÇÃO**

Seguindo todas as instruções acima, o resultado será uma plataforma SaaS completa, funcional, multi-tenant, com autenticação, segurança RLS no banco, interface clean em português, importação de planilhas, cadências automatizadas, disparos via webhook, histórico completo e painel de administração.
