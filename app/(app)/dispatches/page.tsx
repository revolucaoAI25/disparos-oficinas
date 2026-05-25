import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { PageHeader } from "@/components/layout/page-header"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Send, CheckCircle2, XCircle, Clock, Calendar, ArrowRight } from "lucide-react"
import Link from "next/link"
import { formatDateTime, getStatusColor, getStatusLabel } from "@/lib/utils"

export default async function DispatchesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: profile } = await supabase
    .from("profiles")
    .select("org_id")
    .eq("id", user.id)
    .single()

  const orgId = profile?.org_id
  const params = await searchParams
  const status = params?.status
  const page = parseInt(params?.page ?? "1")
  const pageSize = 25

  let query = supabase
    .from("dispatches")
    .select("*, leads(name, phone), cadences(name)", { count: "exact" })
    .eq("org_id", orgId ?? "")
    .order("created_at", { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1)

  if (status) {
    query = query.eq("status", status)
  }

  const { data: dispatches, count } = await query

  // Count by status
  const [{ count: sentCount }, { count: pendingCount }, { count: failedCount }, { count: scheduledCount }] =
    await Promise.all([
      supabase.from("dispatches").select("*", { count: "exact", head: true }).eq("org_id", orgId ?? "").eq("status", "sent"),
      supabase.from("dispatches").select("*", { count: "exact", head: true }).eq("org_id", orgId ?? "").eq("status", "pending"),
      supabase.from("dispatches").select("*", { count: "exact", head: true }).eq("org_id", orgId ?? "").eq("status", "failed"),
      supabase.from("dispatches").select("*", { count: "exact", head: true }).eq("org_id", orgId ?? "").eq("status", "scheduled"),
    ])

  const totalPages = Math.ceil((count ?? 0) / pageSize)

  return (
    <div>
      <PageHeader
        title="Disparos"
        description="Histórico completo de mensagens enviadas."
      >
        <Link href="/dispatches/new">
          <Button>
            <Send className="w-4 h-4" />
            Novo Disparo
          </Button>
        </Link>
      </PageHeader>

      {/* Status filters */}
      <div className="flex flex-wrap gap-2 mb-6">
        <Link href="/dispatches">
          <button className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border ${
            !status ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
          }`}>
            Todos
            <span className={`text-xs px-1.5 py-0.5 rounded-full ${!status ? "bg-white/20 text-white" : "bg-slate-100 text-slate-600"}`}>
              {count ?? 0}
            </span>
          </button>
        </Link>
        {[
          { value: "sent", label: "Enviados", count: sentCount, icon: CheckCircle2, color: "emerald" },
          { value: "pending", label: "Pendentes", count: pendingCount, icon: Clock, color: "amber" },
          { value: "scheduled", label: "Agendados", count: scheduledCount, icon: Calendar, color: "blue" },
          { value: "failed", label: "Falhou", count: failedCount, icon: XCircle, color: "red" },
        ].map(({ value, label, count: c, icon: Icon, color }) => (
          <Link key={value} href={`/dispatches?status=${value}`}>
            <button className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border ${
              status === value
                ? "bg-slate-900 text-white border-slate-900"
                : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
            }`}>
              <Icon className="w-3.5 h-3.5" />
              {label}
              <span className={`text-xs px-1.5 py-0.5 rounded-full ${status === value ? "bg-white/20 text-white" : "bg-slate-100 text-slate-600"}`}>
                {c ?? 0}
              </span>
            </button>
          </Link>
        ))}
      </div>

      <Card>
        <CardContent className="p-0">
          {!dispatches?.length ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400">
              <Send className="w-8 h-8 mb-2 opacity-40" />
              <p className="text-sm">Nenhum disparo encontrado</p>
              {!status && (
                <Link href="/dispatches/new" className="mt-3">
                  <Button size="sm" variant="outline">Fazer primeiro disparo</Button>
                </Link>
              )}
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50">
                      <th className="text-left px-6 py-3 font-medium text-slate-500">Lead</th>
                      <th className="text-left px-4 py-3 font-medium text-slate-500">Telefone</th>
                      <th className="text-left px-4 py-3 font-medium text-slate-500">Cadência</th>
                      <th className="text-left px-4 py-3 font-medium text-slate-500">Status</th>
                      <th className="text-left px-4 py-3 font-medium text-slate-500">Agendado</th>
                      <th className="text-left px-4 py-3 font-medium text-slate-500">Resposta</th>
                      <th className="px-4 py-3"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {dispatches.map((dispatch: any) => (
                      <tr key={dispatch.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-3">
                          <span className="font-medium text-slate-900">
                            {dispatch.leads?.name ?? "—"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-500">
                          {dispatch.leads?.phone ?? "—"}
                        </td>
                        <td className="px-4 py-3 text-slate-500">
                          {dispatch.cadences?.name ?? (
                            <span className="text-slate-300">Avulso</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(dispatch.status)}`}>
                            {getStatusLabel(dispatch.status)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-500">
                          {formatDateTime(dispatch.scheduled_at)}
                        </td>
                        <td className="px-4 py-3">
                          {dispatch.response_received ? (
                            <Badge variant="success" className="text-xs">✓ Respondeu</Badge>
                          ) : (
                            <span className="text-slate-300 text-xs">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <Link href={`/leads/${dispatch.lead_id}`}>
                            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1">
                              Ver lead
                              <ArrowRight className="w-3 h-3" />
                            </Button>
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100">
                  <p className="text-sm text-slate-500">
                    Mostrando {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, count ?? 0)} de {count} disparos
                  </p>
                  <div className="flex gap-2">
                    {page > 1 && (
                      <Link href={`/dispatches?${status ? `status=${status}&` : ""}page=${page - 1}`}>
                        <Button variant="outline" size="sm">Anterior</Button>
                      </Link>
                    )}
                    {page < totalPages && (
                      <Link href={`/dispatches?${status ? `status=${status}&` : ""}page=${page + 1}`}>
                        <Button variant="outline" size="sm">Próxima</Button>
                      </Link>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
