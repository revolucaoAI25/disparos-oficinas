import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import Link from "next/link"
import { PageHeader } from "@/components/layout/page-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { getStatusColor, getStatusLabel, formatDateTime } from "@/lib/utils"
import { Cadence, CadenceStatus } from "@/types"
import {
  Zap,
  Plus,
  Pencil,
  Trash2,
  Play,
  Pause,
  ChevronRight,
  Calendar,
  RefreshCw,
  Users,
} from "lucide-react"
import { revalidatePath } from "next/cache"

// ─── Server Actions ────────────────────────────────────────────────────────────

async function toggleCadenceStatus(formData: FormData) {
  "use server"
  const id = formData.get("id") as string
  const currentStatus = formData.get("status") as CadenceStatus
  const newStatus: CadenceStatus = currentStatus === "active" ? "paused" : "active"

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  await supabase
    .from("cadences")
    .update({ status: newStatus })
    .eq("id", id)

  revalidatePath("/cadences")
}

async function deleteCadence(formData: FormData) {
  "use server"
  const id = formData.get("id") as string

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  await supabase.from("cadences").delete().eq("id", id)
  revalidatePath("/cadences")
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function CadencesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: profile } = await supabase
    .from("profiles")
    .select("org_id")
    .eq("id", user.id)
    .single()

  const orgId = profile?.org_id ?? ""

  const { data: cadences } = await supabase
    .from("cadences")
    .select("*, services(name)")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false })

  // Dispatch counts per cadence
  const cadenceIds = (cadences ?? []).map((c) => c.id)
  let dispatchCountMap: Record<string, number> = {}

  if (cadenceIds.length > 0) {
    const { data: dispatchCounts } = await supabase
      .from("dispatches")
      .select("cadence_id")
      .eq("org_id", orgId)
      .in("cadence_id", cadenceIds)

    dispatchCountMap = (dispatchCounts ?? []).reduce<Record<string, number>>(
      (acc, d) => {
        if (d.cadence_id) acc[d.cadence_id] = (acc[d.cadence_id] ?? 0) + 1
        return acc
      },
      {}
    )
  }

  const stats = {
    total: cadences?.length ?? 0,
    active: cadences?.filter((c) => c.status === "active").length ?? 0,
    paused: cadences?.filter((c) => c.status === "paused").length ?? 0,
    completed: cadences?.filter((c) => c.status === "completed").length ?? 0,
    draft: cadences?.filter((c) => c.status === "draft").length ?? 0,
  }

  return (
    <div>
      <PageHeader
        title="Cadências"
        description="Gerencie sequências automáticas de disparos para seus leads"
      >
        <Link href="/cadences/new">
          <Button>
            <Plus className="w-4 h-4" />
            Nova Cadência
          </Button>
        </Link>
      </PageHeader>

      {/* Stats chips */}
      <div className="flex flex-wrap gap-3 mb-6">
        <StatChip label="Total" value={stats.total} colorClass="bg-slate-100 text-slate-700" />
        <StatChip label="Ativas" value={stats.active} colorClass="bg-emerald-100 text-emerald-700" />
        <StatChip label="Pausadas" value={stats.paused} colorClass="bg-amber-100 text-amber-700" />
        <StatChip label="Concluídas" value={stats.completed} colorClass="bg-slate-100 text-slate-500" />
        {stats.draft > 0 && (
          <StatChip label="Rascunhos" value={stats.draft} colorClass="bg-blue-100 text-blue-700" />
        )}
      </div>

      {/* Empty state */}
      {!cadences?.length ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-20">
            <Zap className="w-12 h-12 text-slate-300 mb-4" />
            <h3 className="text-base font-semibold text-slate-700 mb-1">
              Nenhuma cadência criada
            </h3>
            <p className="text-sm text-slate-400 mb-6 text-center max-w-xs">
              Cadências são sequências de mensagens automáticas enviadas para seus leads via webhook.
            </p>
            <Link href="/cadences/new">
              <Button>
                <Plus className="w-4 h-4" />
                Criar primeira cadência
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="px-4 py-3 text-left font-semibold text-slate-600">Nome</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-600">Serviço</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-600">Status</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-600">Agendamento</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-600">Disparos</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-600">Criado em</th>
                  <th className="px-4 py-3 text-right font-semibold text-slate-600 w-40">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {cadences.map((cadence: Cadence & { services?: { name: string } | null }) => (
                  <tr key={cadence.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3">
                      <Link
                        href={`/cadences/${cadence.id}`}
                        className="font-medium text-slate-900 hover:text-slate-600 flex items-center gap-1 group"
                      >
                        {cadence.name}
                        <ChevronRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-xs">
                      {cadence.services?.name ?? (
                        <span className="text-slate-300 italic">Sem serviço</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Badge className={`text-xs ${getStatusColor(cadence.status)}`} variant="outline">
                        {getStatusLabel(cadence.status)}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1.5 text-xs text-slate-500">
                        {cadence.schedule_type === "recurring" ? (
                          <>
                            <RefreshCw className="w-3 h-3" />
                            Recorrente
                            {cadence.schedule_config?.interval_months && (
                              <span className="text-slate-400">
                                · a cada {cadence.schedule_config.interval_months} {cadence.schedule_config.interval_months === 1 ? "mês" : "meses"}
                              </span>
                            )}
                          </>
                        ) : (
                          <>
                            <Calendar className="w-3 h-3" />
                            Uma vez
                            {cadence.schedule_config?.date && (
                              <span className="text-slate-400">
                                · {formatDateTime(`${cadence.schedule_config.date}T${cadence.schedule_config.time ?? "00:00"}`)}
                              </span>
                            )}
                          </>
                        )}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                        <Users className="w-3 h-3" />
                        {dispatchCountMap[cadence.id] ?? 0}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-400">
                      {formatDateTime(cadence.created_at)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {/* Toggle active/paused */}
                        {(cadence.status === "active" || cadence.status === "paused") && (
                          <form action={toggleCadenceStatus}>
                            <input type="hidden" name="id" value={cadence.id} />
                            <input type="hidden" name="status" value={cadence.status} />
                            <Button
                              type="submit"
                              variant="ghost"
                              size="sm"
                              title={cadence.status === "active" ? "Pausar" : "Ativar"}
                              className="text-slate-400 hover:text-slate-700"
                            >
                              {cadence.status === "active" ? (
                                <Pause className="w-3.5 h-3.5" />
                              ) : (
                                <Play className="w-3.5 h-3.5" />
                              )}
                            </Button>
                          </form>
                        )}

                        <Link href={`/cadences/${cadence.id}/edit`}>
                          <Button
                            variant="ghost"
                            size="sm"
                            title="Editar"
                            className="text-slate-400 hover:text-slate-700"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                        </Link>

                        <form action={deleteCadence}>
                          <input type="hidden" name="id" value={cadence.id} />
                          <Button
                            type="submit"
                            variant="ghost"
                            size="sm"
                            title="Excluir"
                            className="text-slate-400 hover:text-red-500"
                            onClick={(e) => {
                              if (!confirm(`Excluir a cadência "${cadence.name}"? Esta ação não pode ser desfeita.`)) {
                                e.preventDefault()
                              }
                            }}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </form>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

function StatChip({
  label,
  value,
  colorClass,
}: {
  label: string
  value: number
  colorClass: string
}) {
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${colorClass}`}>
      {value} {label}
    </span>
  )
}
