import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { PageHeader } from "@/components/layout/page-header"
import { StatCard } from "@/components/layout/stat-card"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Users,
  Zap,
  Send,
  TrendingUp,
  Clock,
  CheckCircle2,
  XCircle,
  ArrowRight,
} from "lucide-react"
import Link from "next/link"
import { formatDateTime, getStatusColor, getStatusLabel } from "@/lib/utils"

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, org_id, full_name")
    .eq("id", user.id)
    .single()

  const orgId = profile?.org_id

  // Stats queries
  const [
    { count: totalLeads },
    { count: activeCadences },
    { count: pendingDispatches },
    { data: recentDispatches },
    { data: activeCadencesList },
  ] = await Promise.all([
    supabase.from("leads").select("*", { count: "exact", head: true })
      .eq("org_id", orgId ?? ""),
    supabase.from("cadences").select("*", { count: "exact", head: true })
      .eq("org_id", orgId ?? "").eq("status", "active"),
    supabase.from("dispatches").select("*", { count: "exact", head: true })
      .eq("org_id", orgId ?? "").in("status", ["pending", "scheduled"]),
    supabase.from("dispatches")
      .select("*, leads(name, phone)")
      .eq("org_id", orgId ?? "")
      .order("created_at", { ascending: false })
      .limit(8),
    supabase.from("cadences")
      .select("*, services(name)")
      .eq("org_id", orgId ?? "")
      .eq("status", "active")
      .limit(5),
  ])

  // Today's dispatches
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const { count: dispatchesToday } = await supabase
    .from("dispatches")
    .select("*", { count: "exact", head: true })
    .eq("org_id", orgId ?? "")
    .eq("status", "sent")
    .gte("sent_at", today.toISOString())

  // Response rate
  const { count: totalSent } = await supabase
    .from("dispatches")
    .select("*", { count: "exact", head: true })
    .eq("org_id", orgId ?? "")
    .eq("status", "sent")

  const { count: totalResponded } = await supabase
    .from("dispatches")
    .select("*", { count: "exact", head: true })
    .eq("org_id", orgId ?? "")
    .eq("response_received", true)

  const responseRate = totalSent && totalSent > 0
    ? Math.round(((totalResponded ?? 0) / totalSent) * 100)
    : 0

  const greeting = () => {
    const h = new Date().getHours()
    if (h < 12) return "Bom dia"
    if (h < 18) return "Boa tarde"
    return "Boa noite"
  }

  return (
    <div>
      <PageHeader
        title={`${greeting()}, ${profile?.full_name?.split(" ")[0] ?? "usuário"}! 👋`}
        description="Aqui está um resumo da sua plataforma hoje."
      >
        <Link href="/dispatches/new">
          <Button>
            <Send className="w-4 h-4" />
            Novo Disparo
          </Button>
        </Link>
      </PageHeader>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          title="Total de Leads"
          value={totalLeads?.toLocaleString("pt-BR") ?? "0"}
          description="na sua base"
          icon={Users}
          iconColor="text-blue-600"
        />
        <StatCard
          title="Cadências Ativas"
          value={activeCadences ?? 0}
          description="em execução"
          icon={Zap}
          iconColor="text-amber-600"
        />
        <StatCard
          title="Disparos Hoje"
          value={dispatchesToday ?? 0}
          description="mensagens enviadas"
          icon={Send}
          iconColor="text-emerald-600"
        />
        <StatCard
          title="Taxa de Resposta"
          value={`${responseRate}%`}
          description={`${totalResponded ?? 0} de ${totalSent ?? 0} responderam`}
          icon={TrendingUp}
          iconColor="text-purple-600"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Dispatches */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-4">
              <CardTitle className="text-base">Disparos Recentes</CardTitle>
              <Link href="/dispatches">
                <Button variant="ghost" size="sm" className="text-slate-500 gap-1">
                  Ver todos
                  <ArrowRight className="w-3.5 h-3.5" />
                </Button>
              </Link>
            </CardHeader>
            <CardContent className="p-0">
              {!recentDispatches?.length ? (
                <div className="px-6 py-12 text-center text-slate-400">
                  <Send className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  <p className="text-sm">Nenhum disparo ainda</p>
                  <Link href="/dispatches/new" className="mt-3 inline-block">
                    <Button size="sm" variant="outline">Fazer primeiro disparo</Button>
                  </Link>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {recentDispatches.map((dispatch: any) => (
                    <div key={dispatch.id} className="px-6 py-3 flex items-center justify-between hover:bg-slate-50 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                          dispatch.status === "sent" ? "bg-emerald-100" :
                          dispatch.status === "failed" ? "bg-red-100" :
                          "bg-amber-100"
                        }`}>
                          {dispatch.status === "sent" ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          ) : dispatch.status === "failed" ? (
                            <XCircle className="w-4 h-4 text-red-500" />
                          ) : (
                            <Clock className="w-4 h-4 text-amber-600" />
                          )}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-slate-900">
                            {dispatch.leads?.name ?? dispatch.leads?.phone ?? "Lead"}
                          </p>
                          <p className="text-xs text-slate-400">
                            {formatDateTime(dispatch.sent_at ?? dispatch.scheduled_at)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {dispatch.response_received && (
                          <Badge variant="success" className="text-xs">Respondeu</Badge>
                        )}
                        <Badge
                          className={`text-xs ${getStatusColor(dispatch.status)}`}
                          variant="outline"
                        >
                          {getStatusLabel(dispatch.status)}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Active Cadences */}
        <div>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-4">
              <CardTitle className="text-base">Cadências Ativas</CardTitle>
              <Link href="/cadences">
                <Button variant="ghost" size="sm" className="text-slate-500 gap-1">
                  Ver todas
                  <ArrowRight className="w-3.5 h-3.5" />
                </Button>
              </Link>
            </CardHeader>
            <CardContent className="p-0">
              {!activeCadencesList?.length ? (
                <div className="px-6 py-12 text-center text-slate-400">
                  <Zap className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  <p className="text-sm">Nenhuma cadência ativa</p>
                  <Link href="/cadences/new" className="mt-3 inline-block">
                    <Button size="sm" variant="outline">Criar cadência</Button>
                  </Link>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {activeCadencesList.map((cadence: any) => (
                    <Link key={cadence.id} href={`/cadences/${cadence.id}`}>
                      <div className="px-6 py-3 hover:bg-slate-50 transition-colors cursor-pointer">
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-sm font-medium text-slate-900 truncate">
                            {cadence.name}
                          </p>
                          <Badge variant="success" className="text-xs ml-2 shrink-0">Ativo</Badge>
                        </div>
                        <p className="text-xs text-slate-400">
                          {cadence.services?.name ?? "Sem serviço vinculado"} •{" "}
                          {cadence.schedule_type === "recurring" ? "Recorrente" : "Data específica"}
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quick actions */}
          <Card className="mt-4">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Ações Rápidas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Link href="/leads" className="block">
                <Button variant="outline" className="w-full justify-start gap-2 text-sm">
                  <Users className="w-4 h-4" />
                  Importar leads
                </Button>
              </Link>
              <Link href="/cadences/new" className="block">
                <Button variant="outline" className="w-full justify-start gap-2 text-sm">
                  <Zap className="w-4 h-4" />
                  Nova cadência
                </Button>
              </Link>
              <Link href="/dispatches/new" className="block">
                <Button variant="outline" className="w-full justify-start gap-2 text-sm">
                  <Send className="w-4 h-4" />
                  Disparo avulso
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
