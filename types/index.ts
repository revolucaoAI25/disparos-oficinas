export type UserRole = 'admin' | 'client'

export interface Profile {
  id: string
  full_name: string | null
  role: UserRole
  org_id: string | null
  created_at: string
  updated_at: string
}

export interface Organization {
  id: string
  name: string
  owner_id: string
  created_at: string
  updated_at: string
  settings: Record<string, unknown>
}

export interface Service {
  id: string
  org_id: string
  name: string
  description: string | null
  default_webhook_url: string | null
  created_at: string
}

export interface Lead {
  id: string
  org_id: string
  name: string | null
  phone: string
  email: string | null
  custom_fields: Record<string, string>
  tags: string[]
  last_service_date: string | null
  last_contact_date: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export type CadenceStatus = 'draft' | 'active' | 'paused' | 'completed'
export type ScheduleType = 'once' | 'recurring'

export interface ScheduleConfig {
  date?: string
  time?: string
  interval_months?: number
  start_date?: string
  end_date?: string | null
}

export interface Cadence {
  id: string
  org_id: string
  name: string
  service_id: string | null
  webhook_url: string
  webhook_body_template: Record<string, string>
  status: CadenceStatus
  schedule_type: ScheduleType
  schedule_config: ScheduleConfig
  target_filter: Record<string, unknown>
  target_lead_ids: string[] | null
  created_at: string
  updated_at: string
  services?: Service
  _count?: {
    dispatches: number
    leads: number
  }
}

export type DispatchStatus = 'pending' | 'scheduled' | 'sent' | 'failed'

export interface Dispatch {
  id: string
  org_id: string
  cadence_id: string | null
  lead_id: string
  webhook_url: string
  payload: Record<string, unknown>
  status: DispatchStatus
  scheduled_at: string
  sent_at: string | null
  response_received: boolean
  notes: string | null
  created_at: string
  leads?: Lead
  cadences?: Cadence
}

export type ActivityType = 'response' | 'visit' | 'note' | 'dispatch'

export interface LeadActivity {
  id: string
  lead_id: string
  dispatch_id: string | null
  type: ActivityType
  description: string | null
  created_at: string
  created_by: string | null
  dispatches?: Dispatch
}

export interface DashboardStats {
  total_leads: number
  active_cadences: number
  dispatches_today: number
  dispatches_week: number
  response_rate: number
  pending_dispatches: number
}
