"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { PageHeader } from "@/components/layout/page-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog"
import { Building2, Plus, ArrowRight, Loader2, Users, Search } from "lucide-react"
import Link from "next/link"
import { formatDate } from "@/lib/utils"
import { toast } from "sonner"

interface OrgWithStats {
  id: string
  name: string
  created_at: string
  owner_id: string
  lead_count?: number
  dispatch_count?: number
  owner_email?: string
}

export default function AdminClientsPage() {
  const [orgs, setOrgs] = useState<OrgWithStats[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [createOpen, setCreateOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  const [form, setForm] = useState({
    org_name: "",
    user_name: "",
    user_email: "",
    user_password: "",
  })

  useEffect(() => {
    loadOrgs()
  }, [])

  async function loadOrgs() {
    const res = await fetch("/api/admin/organizations")
    if (res.ok) {
      const data = await res.json()
      setOrgs(data)
    }
    setLoading(false)
  }

  async function handleCreate() {
    if (!form.org_name || !form.user_email || !form.user_password) {
      toast.error("Preencha todos os campos obrigatórios")
      return
    }
    setSaving(true)

    const res = await fetch("/api/admin/organizations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    })

    if (res.ok) {
      toast.success("Cliente criado com sucesso!")
      setCreateOpen(false)
      setForm({ org_name: "", user_name: "", user_email: "", user_password: "" })
      loadOrgs()
    } else {
      const err = await res.json()
      toast.error(err.error ?? "Erro ao criar cliente")
    }
    setSaving(false)
  }

  const filtered = orgs.filter(o =>
    o.name.toLowerCase().includes(search.toLowerCase()) ||
    o.owner_email?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div>
      <PageHeader
        title="Gerenciar Clientes"
        description="Crie e gerencie as organizações de cada cliente."
      >
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="w-4 h-4" />
          Novo Cliente
        </Button>
      </PageHeader>

      <div className="mb-4">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
          <Input
            placeholder="Buscar cliente..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
            </div>
          ) : !filtered.length ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400">
              <Building2 className="w-8 h-8 mb-2 opacity-40" />
              <p className="text-sm">
                {search ? "Nenhum cliente encontrado" : "Nenhum cliente cadastrado ainda"}
              </p>
              {!search && (
                <Button size="sm" className="mt-3" onClick={() => setCreateOpen(true)}>
                  Criar primeiro cliente
                </Button>
              )}
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="text-left px-6 py-3 font-medium text-slate-500">Organização</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-500">E-mail</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-500">Leads</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-500">Disparos</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-500">Criado em</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((org) => (
                  <tr key={org.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center">
                          <Building2 className="w-4 h-4 text-slate-500" />
                        </div>
                        <span className="font-medium text-slate-900">{org.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-500">{org.owner_email ?? "—"}</td>
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-1 text-slate-600">
                        <Users className="w-3.5 h-3.5" />
                        {org.lead_count?.toLocaleString("pt-BR") ?? 0}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{org.dispatch_count?.toLocaleString("pt-BR") ?? 0}</td>
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

      {/* Create Client Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Novo Cliente</DialogTitle>
            <DialogDescription>
              Crie uma organização e um usuário de acesso para o cliente.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Nome da oficina *</Label>
              <Input
                placeholder="ex: Oficina do João"
                value={form.org_name}
                onChange={e => setForm(f => ({ ...f, org_name: e.target.value }))}
              />
            </div>
            <div className="border-t border-slate-100 pt-4">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
                Dados de acesso do usuário
              </p>
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label>Nome completo</Label>
                  <Input
                    placeholder="Nome do responsável"
                    value={form.user_name}
                    onChange={e => setForm(f => ({ ...f, user_name: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>E-mail *</Label>
                  <Input
                    type="email"
                    placeholder="email@oficina.com"
                    value={form.user_email}
                    onChange={e => setForm(f => ({ ...f, user_email: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Senha inicial *</Label>
                  <Input
                    type="password"
                    placeholder="Mínimo 8 caracteres"
                    value={form.user_password}
                    onChange={e => setForm(f => ({ ...f, user_password: e.target.value }))}
                  />
                  <p className="text-xs text-slate-400">O cliente pode alterar depois em Configurações.</p>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              Criar cliente
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
