"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { PageHeader } from "@/components/layout/page-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Loader2,
  Send,
  Search,
  Plus,
  Trash2,
  Users,
  Zap,
  AlertCircle,
  CheckCircle2,
} from "lucide-react"
import { Lead, Service } from "@/types"
import { formatPhone } from "@/lib/utils"
import { toast } from "sonner"

type TargetMode = "all" | "manual"

interface TemplateRow {
  key: string
  value: string
}

export default function NewDispatchPage() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [orgId, setOrgId] = useState<string>("")

  // Data
  const [leads, setLeads] = useState<Lead[]>([])
  const [services, setServices] = useState<Service[]>([])
  const [filteredLeads, setFilteredLeads] = useState<Lead[]>([])
  const [searchLead, setSearchLead] = useState("")

  // Form
  const [targetMode, setTargetMode] = useState<TargetMode>("all")
  const [selectedLeadIds, setSelectedLeadIds] = useState<Set<string>>(new Set())
  const [webhookUrl, setWebhookUrl] = useState("")
  const [templateRows, setTemplateRows] = useState<TemplateRow[]>([
    { key: "name", value: "{{nome}}" },
    { key: "phone", value: "{{telefone}}" },
  ])
  const [scheduleType, setScheduleType] = useState<"now" | "later">("now")
  const [scheduledAt, setScheduledAt] = useState("")
  const [selectedService, setSelectedService] = useState<string>("")

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    if (searchLead) {
      setFilteredLeads(
        leads.filter(l =>
          l.name?.toLowerCase().includes(searchLead.toLowerCase()) ||
          l.phone.includes(searchLead)
        )
      )
    } else {
      setFilteredLeads(leads.slice(0, 50))
    }
  }, [searchLead, leads])

  async function loadData() {
    setLoading(true)
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

    const [{ data: leadsData }, { data: svcs }] = await Promise.all([
      supabase.from("leads").select("*").eq("org_id", profile.org_id).order("name"),
      supabase.from("services").select("*").eq("org_id", profile.org_id).order("name"),
    ])

    setLeads(leadsData ?? [])
    setFilteredLeads((leadsData ?? []).slice(0, 50))
    setServices(svcs ?? [])
    setLoading(false)
  }

  function handleServiceChange(svcId: string) {
    setSelectedService(svcId)
    const svc = services.find(s => s.id === svcId)
    if (svc?.default_webhook_url) {
      setWebhookUrl(svc.default_webhook_url)
    }
  }

  const targetLeads = targetMode === "all" ? leads : leads.filter(l => selectedLeadIds.has(l.id))
  const targetCount = targetLeads.length

  function toggleLead(id: string) {
    const next = new Set(selectedLeadIds)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelectedLeadIds(next)
  }

  function addTemplateRow() {
    setTemplateRows(rows => [...rows, { key: "", value: "" }])
  }

  function removeTemplateRow(index: number) {
    setTemplateRows(rows => rows.filter((_, i) => i !== index))
  }

  function updateTemplateRow(index: number, field: "key" | "value", val: string) {
    setTemplateRows(rows => rows.map((row, i) => i === index ? { ...row, [field]: val } : row))
  }

  const webhookBodyPreview = JSON.stringify(
    templateRows.reduce((acc, row) => {
      if (row.key) acc[row.key] = row.value
      return acc
    }, {} as Record<string, string>),
    null,
    2
  )

  async function handleSubmit() {
    if (!webhookUrl) {
      toast.error("Informe a URL do webhook")
      return
    }
    if (targetMode === "manual" && selectedLeadIds.size === 0) {
      toast.error("Selecione pelo menos um lead")
      return
    }

    setSubmitting(true)

    const template = templateRows.reduce((acc, row) => {
      if (row.key) acc[row.key] = row.value
      return acc
    }, {} as Record<string, string>)

    const body = {
      org_id: orgId,
      webhook_url: webhookUrl,
      webhook_body_template: template,
      target_lead_ids: targetMode === "manual" ? Array.from(selectedLeadIds) : null,
      schedule_type: scheduleType,
      scheduled_at: scheduleType === "later" ? scheduledAt : null,
      service_id: selectedService || null,
    }

    const res = await fetch("/api/dispatches", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      const err = await res.json()
      toast.error(err.error ?? "Erro ao criar disparos")
      setSubmitting(false)
      return
    }

    const data = await res.json()
    toast.success(`${data.created} disparos criados com sucesso!`)
    router.push("/dispatches")
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        title="Novo Disparo Avulso"
        description="Envie uma mensagem para um grupo de leads imediatamente ou agendada."
      />

      <div className="max-w-3xl space-y-6">
        {/* Step 1: Select leads */}
        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-slate-900 text-white rounded-full flex items-center justify-center text-xs font-bold">1</div>
              <CardTitle className="text-base">Selecionar Leads</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-3">
              <button
                onClick={() => setTargetMode("all")}
                className={`flex-1 p-3 rounded-lg border text-sm font-medium transition-colors ${
                  targetMode === "all"
                    ? "border-slate-900 bg-slate-50 text-slate-900"
                    : "border-slate-200 text-slate-500 hover:bg-slate-50"
                }`}
              >
                <Users className="w-4 h-4 mx-auto mb-1" />
                Todos os leads
                <p className="text-xs font-normal mt-0.5">{leads.length} leads</p>
              </button>
              <button
                onClick={() => setTargetMode("manual")}
                className={`flex-1 p-3 rounded-lg border text-sm font-medium transition-colors ${
                  targetMode === "manual"
                    ? "border-slate-900 bg-slate-50 text-slate-900"
                    : "border-slate-200 text-slate-500 hover:bg-slate-50"
                }`}
              >
                <CheckCircle2 className="w-4 h-4 mx-auto mb-1" />
                Selecionar manualmente
                <p className="text-xs font-normal mt-0.5">
                  {selectedLeadIds.size > 0 ? `${selectedLeadIds.size} selecionados` : "Nenhum selecionado"}
                </p>
              </button>
            </div>

            {targetMode === "manual" && (
              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <div className="p-3 border-b border-slate-100">
                  <div className="relative">
                    <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                    <input
                      value={searchLead}
                      onChange={e => setSearchLead(e.target.value)}
                      placeholder="Buscar por nome ou telefone..."
                      className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                    />
                  </div>
                </div>
                <div className="max-h-48 overflow-y-auto divide-y divide-slate-100">
                  {filteredLeads.map(lead => (
                    <label key={lead.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 cursor-pointer">
                      <Checkbox
                        checked={selectedLeadIds.has(lead.id)}
                        onCheckedChange={() => toggleLead(lead.id)}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-900 truncate">{lead.name ?? "Sem nome"}</p>
                        <p className="text-xs text-slate-400">{formatPhone(lead.phone)}</p>
                      </div>
                    </label>
                  ))}
                  {!filteredLeads.length && (
                    <p className="px-4 py-3 text-sm text-slate-400">Nenhum lead encontrado</p>
                  )}
                </div>
                {leads.length > 50 && !searchLead && (
                  <p className="px-4 py-2 text-xs text-slate-400 border-t border-slate-100 bg-slate-50">
                    Mostrando 50 de {leads.length} leads. Use a busca para encontrar outros.
                  </p>
                )}
              </div>
            )}

            {targetCount > 0 && (
              <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-100 rounded-lg text-sm text-blue-700">
                <Users className="w-4 h-4" />
                <strong>{targetCount}</strong> lead{targetCount > 1 ? "s" : ""} será{targetCount > 1 ? "ão" : ""} impactado{targetCount > 1 ? "s" : ""}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Step 2: Webhook */}
        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-slate-900 text-white rounded-full flex items-center justify-center text-xs font-bold">2</div>
              <CardTitle className="text-base">Configurar Webhook</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {services.length > 0 && (
              <div className="space-y-2">
                <Label>Serviço (opcional)</Label>
                <Select value={selectedService} onValueChange={handleServiceChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecionar serviço..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sem serviço</SelectItem>
                    {services.map(svc => (
                      <SelectItem key={svc.id} value={svc.id}>{svc.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label>URL do Webhook *</Label>
              <Input
                placeholder="https://alpha.chatflux.ai/api/v1/webhook/..."
                value={webhookUrl}
                onChange={e => setWebhookUrl(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Corpo do Webhook (JSON)</Label>
                <button
                  onClick={addTemplateRow}
                  className="text-xs text-slate-500 hover:text-slate-900 flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" />
                  Adicionar campo
                </button>
              </div>

              <div className="space-y-2">
                {templateRows.map((row, i) => (
                  <div key={i} className="flex gap-2">
                    <Input
                      placeholder="chave"
                      value={row.key}
                      onChange={e => updateTemplateRow(i, "key", e.target.value)}
                      className="w-1/3"
                    />
                    <Input
                      placeholder="valor ou {{variável}}"
                      value={row.value}
                      onChange={e => updateTemplateRow(i, "value", e.target.value)}
                      className="flex-1"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 text-red-400 hover:text-red-600 shrink-0"
                      onClick={() => removeTemplateRow(i)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                ))}
              </div>

              <div className="p-3 bg-slate-50 rounded-lg">
                <p className="text-xs font-medium text-slate-500 mb-1">Variáveis disponíveis:</p>
                <div className="flex flex-wrap gap-1.5">
                  {["{{nome}}", "{{telefone}}"].map(v => (
                    <code key={v} className="text-xs bg-white border border-slate-200 rounded px-1.5 py-0.5 text-slate-600">{v}</code>
                  ))}
                  {leads[0] && Object.keys(leads[0].custom_fields ?? {}).map(k => (
                    <code key={k} className="text-xs bg-white border border-slate-200 rounded px-1.5 py-0.5 text-slate-600">{`{{${k}}}`}</code>
                  ))}
                </div>
              </div>

              {webhookBodyPreview !== "{}" && (
                <div className="p-3 bg-slate-900 rounded-lg">
                  <p className="text-xs text-slate-400 mb-1">Preview do JSON:</p>
                  <pre className="text-xs text-emerald-400 overflow-x-auto">{webhookBodyPreview}</pre>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Step 3: Schedule */}
        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-slate-900 text-white rounded-full flex items-center justify-center text-xs font-bold">3</div>
              <CardTitle className="text-base">Agendamento</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-3">
              <button
                onClick={() => setScheduleType("now")}
                className={`flex-1 p-3 rounded-lg border text-sm font-medium transition-colors ${
                  scheduleType === "now"
                    ? "border-slate-900 bg-slate-50 text-slate-900"
                    : "border-slate-200 text-slate-500 hover:bg-slate-50"
                }`}
              >
                <Zap className="w-4 h-4 mx-auto mb-1" />
                Agora
                <p className="text-xs font-normal mt-0.5">Enviar imediatamente</p>
              </button>
              <button
                onClick={() => setScheduleType("later")}
                className={`flex-1 p-3 rounded-lg border text-sm font-medium transition-colors ${
                  scheduleType === "later"
                    ? "border-slate-900 bg-slate-50 text-slate-900"
                    : "border-slate-200 text-slate-500 hover:bg-slate-50"
                }`}
              >
                <Send className="w-4 h-4 mx-auto mb-1" />
                Agendar
                <p className="text-xs font-normal mt-0.5">Para uma data/hora</p>
              </button>
            </div>

            {scheduleType === "later" && (
              <div className="space-y-2">
                <Label>Data e hora do envio</Label>
                <Input
                  type="datetime-local"
                  value={scheduledAt}
                  onChange={e => setScheduledAt(e.target.value)}
                  min={new Date().toISOString().slice(0, 16)}
                />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Submit */}
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={() => router.back()}>
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={submitting || targetCount === 0 || !webhookUrl}
          >
            {submitting ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Criando disparos...</>
            ) : (
              <><Send className="w-4 h-4" /> Criar {targetCount} disparo{targetCount !== 1 ? "s" : ""}</>
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
