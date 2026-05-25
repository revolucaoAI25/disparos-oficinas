"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { PageHeader } from "@/components/layout/page-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Wrench, Plus, Pencil, Trash2, Link2, Loader2 } from "lucide-react"
import { Service } from "@/types"
import { toast } from "sonner"

const DEFAULT_SERVICES = [
  "Troca de Óleo",
  "Revisão Completa",
  "Alinhamento e Balanceamento",
  "Troca de Pastilhas de Freio",
  "Diagnóstico Elétrico",
  "Troca de Correia Dentada",
  "Ar Condicionado",
  "Suspensão",
]

export default function ServicesPage() {
  const [services, setServices] = useState<Service[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editService, setEditService] = useState<Service | null>(null)
  const [saving, setSaving] = useState(false)
  const [orgId, setOrgId] = useState<string>("")

  const [form, setForm] = useState({
    name: "",
    description: "",
    default_webhook_url: "",
  })

  useEffect(() => {
    loadServices()
  }, [])

  async function loadServices() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: profile } = await supabase
      .from("profiles")
      .select("org_id")
      .eq("id", user.id)
      .single()

    if (!profile?.org_id) {
      setLoading(false)
      return
    }
    setOrgId(profile.org_id)

    const { data } = await supabase
      .from("services")
      .select("*")
      .eq("org_id", profile.org_id)
      .order("name")

    setServices(data ?? [])
    setLoading(false)
  }

  function openCreate() {
    setEditService(null)
    setForm({ name: "", description: "", default_webhook_url: "" })
    setDialogOpen(true)
  }

  function openEdit(service: Service) {
    setEditService(service)
    setForm({
      name: service.name,
      description: service.description ?? "",
      default_webhook_url: service.default_webhook_url ?? "",
    })
    setDialogOpen(true)
  }

  async function handleSave() {
    if (!form.name.trim()) return
    setSaving(true)

    const supabase = createClient()

    if (editService) {
      const { error } = await supabase
        .from("services")
        .update({
          name: form.name.trim(),
          description: form.description || null,
          default_webhook_url: form.default_webhook_url || null,
        })
        .eq("id", editService.id)

      if (error) {
        toast.error("Erro ao salvar serviço")
      } else {
        toast.success("Serviço atualizado!")
        setDialogOpen(false)
        loadServices()
      }
    } else {
      const { error } = await supabase.from("services").insert({
        org_id: orgId,
        name: form.name.trim(),
        description: form.description || null,
        default_webhook_url: form.default_webhook_url || null,
      })

      if (error) {
        toast.error("Erro ao criar serviço")
      } else {
        toast.success("Serviço criado!")
        setDialogOpen(false)
        loadServices()
      }
    }

    setSaving(false)
  }

  async function handleDelete(id: string) {
    if (!confirm("Tem certeza? Este serviço pode estar vinculado a cadências.")) return
    const supabase = createClient()
    await supabase.from("services").delete().eq("id", id)
    toast.success("Serviço removido")
    loadServices()
  }

  async function addDefaultService(name: string) {
    if (services.find(s => s.name === name)) {
      toast.error("Serviço já existe")
      return
    }
    const supabase = createClient()
    await supabase.from("services").insert({ org_id: orgId, name })
    toast.success(`"${name}" adicionado!`)
    loadServices()
  }

  return (
    <div>
      <PageHeader
        title="Serviços"
        description="Gerencie os tipos de serviço da sua oficina para vincular às cadências."
      >
        <Button onClick={openCreate}>
          <Plus className="w-4 h-4" />
          Novo Serviço
        </Button>
      </PageHeader>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Services list */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-base">
                Seus Serviços
                <Badge variant="secondary" className="ml-2">{services.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
                </div>
              ) : !services.length ? (
                <div className="px-6 py-12 text-center text-slate-400">
                  <Wrench className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  <p className="text-sm mb-3">Nenhum serviço cadastrado</p>
                  <Button size="sm" onClick={openCreate}>Criar primeiro serviço</Button>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {services.map((service) => (
                    <div key={service.id} className="px-6 py-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-slate-100 rounded-lg flex items-center justify-center">
                          <Wrench className="w-4 h-4 text-slate-600" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-slate-900">{service.name}</p>
                          {service.description && (
                            <p className="text-xs text-slate-400">{service.description}</p>
                          )}
                          {service.default_webhook_url && (
                            <div className="flex items-center gap-1 mt-0.5">
                              <Link2 className="w-3 h-3 text-slate-400" />
                              <p className="text-xs text-slate-400 truncate max-w-xs">
                                {service.default_webhook_url}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => openEdit(service)}
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50"
                          onClick={() => handleDelete(service.id)}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Default services */}
        <div>
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-base">Serviços Padrão</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-slate-500 mb-3">
                Clique para adicionar rapidamente serviços comuns de oficina:
              </p>
              <div className="flex flex-wrap gap-2">
                {DEFAULT_SERVICES.map((name) => {
                  const exists = services.some(s => s.name === name)
                  return (
                    <button
                      key={name}
                      onClick={() => !exists && addDefaultService(name)}
                      disabled={exists}
                      className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                        exists
                          ? "border-slate-200 bg-slate-100 text-slate-400 cursor-default"
                          : "border-slate-300 hover:bg-slate-900 hover:text-white hover:border-slate-900 cursor-pointer"
                      }`}
                    >
                      {exists ? "✓ " : "+ "}
                      {name}
                    </button>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editService ? "Editar Serviço" : "Novo Serviço"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="svc-name">Nome do serviço *</Label>
              <Input
                id="svc-name"
                placeholder="ex: Troca de Óleo"
                value={form.name}
                onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="svc-desc">Descrição (opcional)</Label>
              <Textarea
                id="svc-desc"
                placeholder="Descreva brevemente o serviço..."
                rows={2}
                value={form.description}
                onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="svc-webhook">URL do Webhook padrão (opcional)</Label>
              <Input
                id="svc-webhook"
                placeholder="https://alpha.chatflux.ai/api/v1/webhook/..."
                value={form.default_webhook_url}
                onChange={(e) => setForm(f => ({ ...f, default_webhook_url: e.target.value }))}
              />
              <p className="text-xs text-slate-400">
                Este webhook será pré-preenchido ao criar cadências com este serviço.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving || !form.name.trim()}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {editService ? "Salvar alterações" : "Criar serviço"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
