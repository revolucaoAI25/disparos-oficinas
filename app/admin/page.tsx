import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { PageHeader } from "@/components/layout/page-header"
import { StatCard } from "@/components/layout/stat-card"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Building2, Users, Send, Zap, ArrowRight } from "lucide-react"
import Link from "next/link"
import { formatDate } from "@/lib/utils"

export default async function AdminPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const [
    { count: orgCount },
    { count: userCount },
    { count: leadsCount },
    { count: dispatchCount },
    { data: orgs },
  ] = await Promise.all([
    supabase.from("organizations").select("*", { count: "exact", head: true }),
    supabase.from("profiles").select("*", { count: "exact", head: true }),
    supabase.from("leads").select("*", { count: "exact", head: true }),
    supabase.from("dispatches").select("*", { count: "exact", head: true }),
    supabase.from("organizations").select("*, profiles(count)").order("created_at", { ascending: false }).limit(10),
  ])

  return (
    <div>
      <PageHeader
        title="Painel Administrativo"
        description="Visão geral de todos os clientes e dados da plataforma."
      >
        <Link href="/admin/clients">
          <Button>
            <Building2 className="w-4 h-4" />
            Gerenciar Clientes
          </Button>
        </Link>
      </PageHeader>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard title="Organizações" value={orgCount ?? 0} icon={Building2} iconColor="text-blue-600" />
        <StatCard title="Usuários" value={userCount ?? 0} icon={Users} iconColor="text-emerald-600" />
        <StatCard title="Total de Leads" value={leadsCount?.toLocaleString("pt-BR") ?? 0} icon={Users} iconColor="text-purple-600" />
        <StatCard title="Total de Disparos" value={dispatchCount?.toLocaleString("pt-BR") ?? 0} icon={Send} iconColor="text-amber-600" />
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-4">
          <CardTitle className="text-base">Clientes Recentes</CardTitle>
          <Link href="/admin/clients">
            <Button variant="ghost" size="sm" className="gap-1 text-slate-500">
              Ver todos <ArrowRight className="w-3.5 h-3.5" />
            </Button>
          </Link>
        </CardHeader>
        <CardContent className="p-0">
          {!orgs?.length ? (
            <div className="px-6 py-10 text-center text-slate-400 text-sm">
              Nenhuma organização cadastrada ainda.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="text-left px-6 py-3 font-medium text-slate-500">Nome</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-500">Criado em</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {orgs.map((org: any) => (
                  <tr key={org.id} className="hover:bg-slate-50">
                    <td className="px-6 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 bg-slate-100 rounded-lg flex items-center justify-center">
                          <Building2 className="w-3.5 h-3.5 text-slate-500" />
                        </div>
                        <span className="font-medium text-slate-900">{org.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-500">{formatDate(org.created_at)}</td>
                    <td className="px-4 py-3">
                      <Link href={`/admin/clients/${org.id}`}>
                        <Button variant="ghost" size="sm" className="h-7 text-xs gap-1">
                          Detalhes <ArrowRight className="w-3 h-3" />
                        </Button>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
