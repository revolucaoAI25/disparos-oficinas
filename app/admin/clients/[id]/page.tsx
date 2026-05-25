import { createClient } from "@/lib/supabase/server"
import { redirect, notFound } from "next/navigation"
import { PageHeader } from "@/components/layout/page-header"
import { StatCard } from "@/components/layout/stat-card"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Users, Send, Zap, Building2, ArrowLeft, ExternalLink } from "lucide-react"
import Link from "next/link"
import { formatDate, formatDateTime, getStatusColor, getStatusLabel } from "@/lib/utils"

export default async function AdminClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { id } = await params

  const { data: org } = await supabase
    .from("organizations")
    .select("*")
    .eq("id", id)
    .single()

  if (!org) notFound()

  const [
    { count: leadCount },
    { count: dispatchCount },
    { count: activeCadences },
    { data: recentDispatches },
    { data: profiles },
    { data: cadences },
  ] = await Promise.all([
    supabase.from("leads").select("*", { count: "exact", head: true }).eq("org_id", id),
    supabase.from("dispatches").select("*", { count: "exact", head: true }).eq("org_id", id),
    supabase.from("cadences").select("*", { count: "exact", head: true }).eq("org_id", id).eq("status", "active"),
    supabase.from("dispatches")
      .select("*, leads(name, phone)")
      .eq("org_id", id)
      .order("created_at", { ascending: false })
      .limit(10),
    supabase.from("profiles")
      .select("id, full_name, role, created_at")
      .eq("org_id", id),
    supabase.from("cadences")
      .select("*, services(name)")
      .eq("org_id", id)
      .order("created_at", { ascending: false })
      .limit(5),
  ])

  return (
    <div>
      <div className="mb-6">
        <Link href="/admin/clients">
          <Button variant="ghost" size="sm" className="gap-1 text-slate-500 -ml-2">
            <ArrowLeft className="w-4 h-4" />
            Voltar para clientes
          </Button>
        </Link>
      </div>

      <PageHeader
        title={org.name}
        description={`Organização criada em ${formatDate(org.created_at)}`}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard title="Leads" value={leadCount?.toLocaleString("pt-BR") ?? 0} icon={Users} iconColor="text-blue-600" />
        <StatCard title="Disparos" value={dispatchCount?.toLocaleString("pt-BR") ?? 0} icon={Send} iconColor="text-emerald-600" />
        <StatCard title="Cadências Ativas" value={activeCadences ?? 0} icon={Zap} iconColor="text-amber-600" />
        <StatCard title="Usuários" value={profiles?.length ?? 0} icon={Building2} iconColor="text-purple-600" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Users */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-base">Usuários da Organização</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {!profiles?.length ? (
              <p className="px-6 py-8 text-sm text-slate-400 text-center">Nenhum usuário vinculado</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {profiles.map((p: any) => (
                  <div key={p.id} className="px-6 py-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-slate-900">{p.full_name ?? "Sem nome"}</p>
                      <p className="text-xs text-slate-400">Desde {formatDate(p.created_at)}</p>
                    </div>
                    <Badge variant={p.role === "admin" ? "default" : "secondary"} className="text-xs">
                      {p.role === "admin" ? "Admin" : "Cliente"}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Cadences */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-base">Cadências</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {!cadences?.length ? (
              <p className="px-6 py-8 text-sm text-slate-400 text-center">Nenhuma cadência criada</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {cadences.map((c: any) => (
                  <div key={c.id} className="px-6 py-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-slate-900">{c.name}</p>
                      <p className="text-xs text-slate-400">{c.services?.name ?? "Sem serviço"}</p>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${getStatusColor(c.status)}`}>
                      {getStatusLabel(c.status)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Dispatches */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-base">Disparos Recentes</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {!recentDispatches?.length ? (
                <p className="px-6 py-8 text-sm text-slate-400 text-center">Nenhum disparo realizado</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50">
                      <th className="text-left px-6 py-3 font-medium text-slate-500">Lead</th>
                      <th className="text-left px-4 py-3 font-medium text-slate-500">Status</th>
                      <th className="text-left px-4 py-3 font-medium text-slate-500">Data</th>
                      <th className="text-left px-4 py-3 font-medium text-slate-500">Resposta</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {recentDispatches.map((d: any) => (
                      <tr key={d.id} className="hover:bg-slate-50">
                        <td className="px-6 py-3">
                          <span className="font-medium">{d.leads?.name ?? "—"}</span>
                          <span className="text-slate-400 ml-2 text-xs">{d.leads?.phone}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${getStatusColor(d.status)}`}>
                            {getStatusLabel(d.status)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-500">
                          {formatDateTime(d.sent_at ?? d.scheduled_at)}
                        </td>
                        <td className="px-4 py-3">
                          {d.response_received ? (
                            <Badge variant="success" className="text-xs">Respondeu</Badge>
                          ) : (
                            <span className="text-slate-300 text-xs">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
