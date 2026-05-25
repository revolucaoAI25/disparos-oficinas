import { createClient } from "@/lib/supabase/server"
import { notFound, redirect } from "next/navigation"
import Link from "next/link"
import { PageHeader } from "@/components/layout/page-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { getStatusColor, getStatusLabel, formatDateTime } from "@/lib/utils"
import { Cadence, CadenceStatus, Dispatch } from "@/types"
import {
  Pencil,
  Trash2,
  Play,
  Pause,
  Zap,
  Calendar,
  RefreshCw,
  Users,
  Webhook,
  CheckCircle2,
  XCircle,
  Clock,
  Send,
  TrendingUp,
  ChevronLeft,
} from "lucide-react"
import { revalidatePath } from "next/cache"

// ─── Server Actions ────────────────────────────────────────────────────────────

async function toggleStatus(formData: FormData) {
  "use server"
  const id = formData.get("id") as string
  const currentStatus = formData.get("status") as CadenceStatus
  const newStatus: CadenceStatus = currentStatus === "active" ? "paused" : "active"

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return

  await supabase.from("cadences").update({ status: newStatus }).eq("id", id)
  revalidatePath(`/cadences/${id}`)
  revalidatePath("/cadences")
}

async function deleteCadenceAction(formData: FormData) {
  "use server"
  const id = formData.get("id") as string

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return

  await supabase.from("cadences").delete().eq("id", id)
  redirect("/cadences")
}

async function fireNowAction(formData: FormData) {
  "use server"
  const cadenceId = formData.get("cadence_id") as string

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return

  // Mark all pending/scheduled dispatches for this cadence as ready to send now
  await supabase
    .from("dispatches")
    .update({ scheduled_at: new Date().toISOString(), status: "pending" })
    .eq("cadence_id", cadenceId)
    .in("status", ["scheduled", "pending"])

  revalidatePath(`/cadences/${cadenceId}`)
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function CadenceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: profile } = await supabase
    .from("profiles")
    .select("org_id")
    .eq("id", user.id)
    .single()

  const orgId = profile?.org_id ?? ""

  // Fetch cadence with service
  const { data: cadence } = await supabase
    .from("cadences")
    .select("*, services(name, description)")
    .eq("id", id)
    .eq("org_id", orgId)
    .single()

  if (!cadence) notFound()

  // Fetch dispatch stats
  const { data: allDispatches } = await supabase
    .from("dispatches")
    .select("id, status, sent_at, response_received, scheduled_at, leads(name, phone)")
    .eq("cadence_id", id)
    .order("scheduled_at", { ascending: false })

  type DispatchRow = {
    id: string
    status: string
    sent_at: string | null
    response_received: boolean
    scheduled_at: string
    lead_id?: string
    leads?: { name: string | null; phone: string } | null
  }

  const dispatches = (allDispatches ?? []) as unknown as DispatchRow[]

  const totalDispatches = dispatches.length
  const sentDispatches = dispatches.filter((d) => d.status === "sent").length
  const failedDispatches = dispatches.filter((d) => d.status === "failed").length
  const pendingDispatches = dispatches.filter(
    (d) => d.status === "pending" || d.status === "scheduled"
  ).length
  const responseCount = dispatches.filter((d) => d.response_received).length
  const responseRate =
    sentDispatches > 0 ? Math.round((responseCount / sentDispatches) * 100) : 0

  // Recent 20 dispatches for history table
  const recentDispatches = dispatches.slice(0, 20)

  // Count leads (unique lead_ids)
  const uniqueLeadIds = new Set(dispatches.map((d) => d.lead_id)).size

  // Schedule description
  const scheduleDescription = (() => {
    if (cadence.schedule_type === "once") {
      const { date, time } = cadence.schedule_config
      if (date && time) {
        return formatDateTime(`${date}T${time}`)
      }
      return date ? formatDateTime(date) : "—"
    }
    const { interval_months, start_date, end_date } = cadence.schedule_config
    const parts = [
      `A cada ${interval_months} ${interval_months === 1 ? "mês" : "meses"}`,
      start_date ? `início: ${formatDateTime(start_date)}` : null,
      end_date ? `término: ${formatDateTime(end_date)}` : null,
    ].filter(Boolean)
    return parts.join(" · ")
  })()

  // Masked webhook URL
  const maskedWebhookUrl = (() => {
    try {
      const url = new URL(cadence.webhook_url)
      return `${url.protocol}//${url.host}/***`
    } catch {
      return cadence.webhook_url.slice(0, 30) + "..."
    }
  })()

  return (
    <div>
      <div className="mb-2">
        <Link
          href="/cadences"
          className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900 transition-colors"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
          Cadências
        </Link>
      </div>

      <PageHeader
        title={cadence.name}
        description={
          cadence.services
            ? `Serviço: ${(cadence.services as { name: string }).name}`
            : undefined
        }
      >
        <div className="flex items-center gap-2">
          {/* Fire now */}
          {cadence.status === "active" && pendingDispatches > 0 && (
            <form action={fireNowAction}>
              <input type="hidden" name="cadence_id" value={cadence.id} />
              <Button type="submit" variant="outline" size="sm">
                <Zap className="w-3.5 h-3.5" />
                Disparar Agora
                {pendingDispatches > 0 && (
                  <span className="ml-1 bg-amber-100 text-amber-700 rounded-full px-1.5 text-xs font-semibold">
                    {pendingDispatches}
                  </span>
                )}
              </Button>
            </form>
          )}

          {/* Edit */}
          <Link href={`/cadences/${id}/edit`}>
            <Button variant="outline" size="sm">
              <Pencil className="w-3.5 h-3.5" />
              Editar
            </Button>
          </Link>

          {/* Toggle status */}
          {(cadence.status === "active" || cadence.status === "paused") && (
            <form action={toggleStatus}>
              <input type="hidden" name="id" value={cadence.id} />
              <input type="hidden" name="status" value={cadence.status} />
              <Button
                type="submit"
                variant={cadence.status === "active" ? "outline" : "success"}
                size="sm"
              >
                {cadence.status === "active" ? (
                  <>
                    <Pause className="w-3.5 h-3.5" />
                    Pausar
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5" />
                    Ativar
                  </>
                )}
              </Button>
            </form>
          )}

          {/* Delete */}
          <form action={deleteCadenceAction}>
            <input type="hidden" name="id" value={cadence.id} />
            <Button
              type="submit"
              variant="outline"
              size="sm"
              className="text-red-500 border-red-200 hover:bg-red-50"
              onClick={(e) => {
                if (
                  !confirm(
                    `Excluir a cadência "${cadence.name}"? Esta ação é irreversível.`
                  )
                ) {
                  e.preventDefault()
                }
              }}
            >
              <Trash2 className="w-3.5 h-3.5" />
              Excluir
            </Button>
          </form>
        </div>
      </PageHeader>

      {/* Status badge */}
      <div className="flex items-center gap-3 -mt-4 mb-6">
        <Badge
          className={`${getStatusColor(cadence.status)} border-0 text-xs`}
          variant="outline"
        >
          {getStatusLabel(cadence.status)}
        </Badge>
        <span className="text-xs text-slate-400">
          Criada em {formatDateTime(cadence.created_at)}
        </span>
        {cadence.updated_at !== cadence.created_at && (
          <span className="text-xs text-slate-400">
            · Atualizada em {formatDateTime(cadence.updated_at)}
          </span>
        )}
      </div>

      {/* Two columns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Left: Settings summary */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Configurações</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 space-y-4">
            <DetailRow
              icon={<Webhook className="w-4 h-4 text-slate-400" />}
              label="Webhook URL"
              value={
                <code className="text-xs font-mono text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                  {maskedWebhookUrl}
                </code>
              }
            />

            <DetailRow
              icon={
                cadence.schedule_type === "recurring" ? (
                  <RefreshCw className="w-4 h-4 text-slate-400" />
                ) : (
                  <Calendar className="w-4 h-4 text-slate-400" />
                )
              }
              label="Agendamento"
              value={
                <span className="text-sm text-slate-700">
                  <span className="mr-2 text-xs text-slate-500">
                    {cadence.schedule_type === "recurring" ? "Recorrente" : "Uma vez"}
                  </span>
                  {scheduleDescription}
                </span>
              }
            />

            <DetailRow
              icon={<Users className="w-4 h-4 text-slate-400" />}
              label="Leads alvo"
              value={
                <span className="text-sm text-slate-700">
                  {cadence.target_lead_ids?.length ? (
                    <>
                      {cadence.target_lead_ids.length} leads selecionados manualmente
                    </>
                  ) : Object.keys(cadence.target_filter ?? {}).length > 0 ? (
                    "Filtro personalizado"
                  ) : (
                    "Todos os leads da organização"
                  )}
                </span>
              }
            />

            {Object.keys(cadence.webhook_body_template ?? {}).length > 0 && (
              <>
                <Separator />
                <div>
                  <p className="text-xs font-medium text-slate-500 mb-2">
                    Campos do payload ({Object.keys(cadence.webhook_body_template).length})
                  </p>
                  <div className="space-y-1">
                    {Object.entries(cadence.webhook_body_template).map(([k, v]) => (
                      <div key={k} className="flex items-center gap-2 text-xs font-mono">
                        <span className="text-slate-400 w-24 truncate">{k}</span>
                        <span className="text-slate-300">→</span>
                        <span className="text-slate-600 truncate">{v as string}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Right: Stats */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Estatísticas</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="grid grid-cols-2 gap-3">
              <StatBox
                icon={<Send className="w-4 h-4 text-slate-500" />}
                value={totalDispatches}
                label="Total de disparos"
                colorClass="bg-slate-50"
              />
              <StatBox
                icon={<CheckCircle2 className="w-4 h-4 text-emerald-500" />}
                value={sentDispatches}
                label="Enviados"
                colorClass="bg-emerald-50"
              />
              <StatBox
                icon={<XCircle className="w-4 h-4 text-red-500" />}
                value={failedDispatches}
                label="Falhas"
                colorClass="bg-red-50"
              />
              <StatBox
                icon={<Clock className="w-4 h-4 text-amber-500" />}
                value={pendingDispatches}
                label="Pendentes"
                colorClass="bg-amber-50"
              />
              <StatBox
                icon={<Users className="w-4 h-4 text-blue-500" />}
                value={uniqueLeadIds}
                label="Leads únicos"
                colorClass="bg-blue-50"
              />
              <StatBox
                icon={<TrendingUp className="w-4 h-4 text-violet-500" />}
                value={`${responseRate}%`}
                label="Taxa de resposta"
                colorClass="bg-violet-50"
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Dispatch history */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">Histórico de Disparos</CardTitle>
            <span className="text-xs text-slate-400">
              {recentDispatches.length < totalDispatches
                ? `Últimos ${recentDispatches.length} de ${totalDispatches}`
                : `${totalDispatches} disparo${totalDispatches !== 1 ? "s" : ""}`}
            </span>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {recentDispatches.length === 0 ? (
            <div className="py-12 text-center">
              <Send className="w-10 h-10 mx-auto mb-3 text-slate-200" />
              <p className="text-sm text-slate-400">Nenhum disparo registrado ainda.</p>
              {cadence.status === "draft" && (
                <p className="text-xs text-slate-400 mt-1">
                  Ative a cadência para iniciar os disparos.
                </p>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50 text-left">
                    <th className="px-3 py-2 font-semibold text-slate-600 text-xs">Lead</th>
                    <th className="px-3 py-2 font-semibold text-slate-600 text-xs">Telefone</th>
                    <th className="px-3 py-2 font-semibold text-slate-600 text-xs">Status</th>
                    <th className="px-3 py-2 font-semibold text-slate-600 text-xs">Agendado</th>
                    <th className="px-3 py-2 font-semibold text-slate-600 text-xs">Enviado</th>
                    <th className="px-3 py-2 font-semibold text-slate-600 text-xs">Resposta</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {recentDispatches.map((dispatch) => (
                    <tr key={dispatch.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-3 py-2.5 font-medium text-slate-800 text-xs">
                        {dispatch.leads?.name ?? (
                          <span className="text-slate-400 italic">Sem nome</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 font-mono text-xs text-slate-500">
                        {dispatch.leads?.phone ?? "—"}
                      </td>
                      <td className="px-3 py-2.5">
                        <Badge
                          className={`${getStatusColor(dispatch.status)} border-0 text-xs`}
                          variant="outline"
                        >
                          {getStatusLabel(dispatch.status)}
                        </Badge>
                      </td>
                      <td className="px-3 py-2.5 text-xs text-slate-500">
                        {formatDateTime(dispatch.scheduled_at)}
                      </td>
                      <td className="px-3 py-2.5 text-xs text-slate-500">
                        {dispatch.sent_at ? formatDateTime(dispatch.sent_at) : "—"}
                      </td>
                      <td className="px-3 py-2.5">
                        {dispatch.response_received ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                        ) : (
                          <span className="text-slate-300 text-xs">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function DetailRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: React.ReactNode
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 shrink-0">{icon}</div>
      <div className="min-w-0">
        <p className="text-xs text-slate-400 mb-0.5">{label}</p>
        <div>{value}</div>
      </div>
    </div>
  )
}

function StatBox({
  icon,
  value,
  label,
  colorClass,
}: {
  icon: React.ReactNode
  value: number | string
  label: string
  colorClass: string
}) {
  return (
    <div className={`rounded-lg p-3 ${colorClass}`}>
      <div className="flex items-center gap-2 mb-1">{icon}</div>
      <p className="text-xl font-bold text-slate-900">{value}</p>
      <p className="text-xs text-slate-500">{label}</p>
    </div>
  )
}
