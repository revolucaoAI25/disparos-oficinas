import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatPhone(phone: string): string {
  const cleaned = phone.replace(/\D/g, '')
  if (cleaned.length === 13) {
    return `+${cleaned.slice(0, 2)} (${cleaned.slice(2, 4)}) ${cleaned.slice(4, 9)}-${cleaned.slice(9)}`
  }
  if (cleaned.length === 11) {
    return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 7)}-${cleaned.slice(7)}`
  }
  return phone
}

export function formatDate(date: string | null | undefined): string {
  if (!date) return '—'
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(date))
}

export function formatDateTime(date: string | null | undefined): string {
  if (!date) return '—'
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date))
}

export function formatRelativeDate(date: string): string {
  const now = new Date()
  const d = new Date(date)
  const diff = now.getTime() - d.getTime()
  const seconds = Math.floor(diff / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (days > 30) return formatDate(date)
  if (days > 1) return `há ${days} dias`
  if (days === 1) return 'ontem'
  if (hours > 1) return `há ${hours} horas`
  if (hours === 1) return 'há 1 hora'
  if (minutes > 1) return `há ${minutes} minutos`
  return 'agora mesmo'
}

export function interpolateTemplate(
  template: Record<string, string>,
  data: Record<string, string>
): Record<string, string> {
  const result: Record<string, string> = {}
  for (const [key, value] of Object.entries(template)) {
    result[key] = value.replace(/\{\{(\w+)\}\}/g, (_, varName) => {
      return data[varName] ?? ''
    })
  }
  return result
}

export function buildWebhookPayload(
  template: Record<string, string>,
  lead: { name?: string | null; phone: string; custom_fields?: Record<string, string> }
): Record<string, string> {
  const data: Record<string, string> = {
    nome: lead.name ?? '',
    name: lead.name ?? '',
    telefone: lead.phone,
    phone: lead.phone,
    ...lead.custom_fields,
  }
  return interpolateTemplate(template, data)
}

export function getStatusColor(status: string): string {
  switch (status) {
    case 'active': return 'bg-emerald-100 text-emerald-700'
    case 'paused': return 'bg-amber-100 text-amber-700'
    case 'completed': return 'bg-slate-100 text-slate-600'
    case 'draft': return 'bg-blue-100 text-blue-700'
    case 'sent': return 'bg-emerald-100 text-emerald-700'
    case 'failed': return 'bg-red-100 text-red-700'
    case 'pending': return 'bg-amber-100 text-amber-700'
    case 'scheduled': return 'bg-blue-100 text-blue-700'
    default: return 'bg-slate-100 text-slate-600'
  }
}

export function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    active: 'Ativo',
    paused: 'Pausado',
    completed: 'Concluído',
    draft: 'Rascunho',
    sent: 'Enviado',
    failed: 'Falhou',
    pending: 'Pendente',
    scheduled: 'Agendado',
  }
  return labels[status] ?? status
}
