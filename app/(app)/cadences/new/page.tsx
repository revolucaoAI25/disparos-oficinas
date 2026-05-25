"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { PageHeader } from "@/components/layout/page-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Separator } from "@/components/ui/separator"
import { Service, Lead, ScheduleType } from "@/types"
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash2,
  Info,
  Check,
  Loader2,
  Search,
  Users,
  Calendar,
  RefreshCw,
  Webhook,
  Eye,
} from "lucide-react"

// ─── Types ─────────────────────────────────────────────────────────────────────

interface WebhookRow {
  id: string
  key: string
  value: string
}

type TargetMode = "all" | "filter" | "manual"

interface FilterRule {
  id: string
  field: string
  operator: string
  value: string
}

interface FormState {
  // Step 1
  name: string
  serviceId: string
  description: string
  // Step 2
  webhookUrl: string
  webhookRows: WebhookRow[]
  // Step 3
  scheduleType: ScheduleType
  scheduleDate: string
  scheduleTime: string
  intervalMonths: number
  startDate: string
  endDate: string
  // Step 4
  targetMode: TargetMode
  filterRules: FilterRule[]
  selectedLeadIds: Set<string>
}

const STEPS = [
  { label: "Básico", icon: "1" },
  { label: "Webhook", icon: "2" },
  { label: "Agendamento", icon: "3" },
  { label: "Leads", icon: "4" },
  { label: "Revisão", icon: "5" },
]

const LEAD_FILTER_FIELDS = [
  { value: "name", label: "Nome" },
  { value: "phone", label: "Telefone" },
  { value: "tags", label: "Tags" },
  { value: "last_service_date", label: "Última visita" },
  { value: "last_contact_date", label: "Último contato" },
]

const FILTER_OPERATORS = [
  { value: "eq", label: "é igual a" },
  { value: "neq", label: "não é igual a" },
  { value: "ilike", label: "contém" },
  { value: "gt", label: "maior que" },
  { value: "lt", label: "menor que" },
]

const AVAILABLE_VARIABLES = [
  { name: "{{nome}}", desc: "Nome do lead" },
  { name: "{{telefone}}", desc: "Telefone do lead" },
  { name: "{{custom_field}}", desc: "Qualquer campo personalizado" },
]

const INTERVAL_OPTIONS = [
  { value: 1, label: "1 mês" },
  { value: 2, label: "2 meses" },
  { value: 3, label: "3 meses" },
  { value: 6, label: "6 meses" },
  { value: 12, label: "12 meses (anual)" },
]

function uid() {
  return Math.random().toString(36).slice(2, 10)
}

// ─── Step Components ────────────────────────────────────────────────────────────

function Step1({
  form,
  services,
  onChange,
}: {
  form: FormState
  services: Service[]
  onChange: (patch: Partial<FormState>) => void
}) {
  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="name">
          Nome da cadência <span className="text-red-500">*</span>
        </Label>
        <Input
          id="name"
          placeholder="Ex: Revisão 6 meses"
          value={form.name}
          onChange={(e) => onChange({ name: e.target.value })}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="service">Serviço associado</Label>
        <Select
          value={form.serviceId}
          onValueChange={(v) => onChange({ serviceId: v })}
        >
          <SelectTrigger id="service">
            <SelectValue placeholder="Sem serviço" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Sem serviço</SelectItem>
            {services.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-slate-500">
          Associe esta cadência a um serviço para organização.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Descrição (opcional)</Label>
        <Textarea
          id="description"
          placeholder="Descreva o objetivo desta cadência..."
          rows={3}
          value={form.description}
          onChange={(e) => onChange({ description: e.target.value })}
        />
      </div>
    </div>
  )
}

function Step2({
  form,
  onChange,
}: {
  form: FormState
  onChange: (patch: Partial<FormState>) => void
}) {
  const addRow = () => {
    onChange({
      webhookRows: [...form.webhookRows, { id: uid(), key: "", value: "" }],
    })
  }

  const removeRow = (id: string) => {
    onChange({ webhookRows: form.webhookRows.filter((r) => r.id !== id) })
  }

  const updateRow = (id: string, patch: Partial<WebhookRow>) => {
    onChange({
      webhookRows: form.webhookRows.map((r) =>
        r.id === id ? { ...r, ...patch } : r
      ),
    })
  }

  const previewPayload = () => {
    const obj: Record<string, string> = {}
    for (const row of form.webhookRows) {
      if (row.key.trim()) obj[row.key.trim()] = row.value
    }
    return JSON.stringify(obj, null, 2)
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="webhook-url">
          URL do Webhook <span className="text-red-500">*</span>
        </Label>
        <Input
          id="webhook-url"
          placeholder="https://..."
          value={form.webhookUrl}
          onChange={(e) => onChange({ webhookUrl: e.target.value })}
        />
      </div>

      <Separator />

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label>Corpo do Webhook (JSON)</Label>
          <Button type="button" variant="outline" size="sm" onClick={addRow}>
            <Plus className="w-3.5 h-3.5" />
            Adicionar campo
          </Button>
        </div>

        {form.webhookRows.length === 0 ? (
          <p className="text-sm text-slate-400 italic py-2">
            Nenhum campo adicionado. Clique em &quot;Adicionar campo&quot; para começar.
          </p>
        ) : (
          <div className="space-y-2">
            <div className="grid grid-cols-[1fr_1fr_auto] gap-2 text-xs font-medium text-slate-500 px-1">
              <span>Chave</span>
              <span>Valor</span>
              <span />
            </div>
            {form.webhookRows.map((row) => (
              <div key={row.id} className="grid grid-cols-[1fr_1fr_auto] gap-2 items-center">
                <Input
                  placeholder="chave"
                  value={row.key}
                  onChange={(e) => updateRow(row.id, { key: e.target.value })}
                  className="font-mono text-xs"
                />
                <Input
                  placeholder="valor ou {{variavel}}"
                  value={row.value}
                  onChange={(e) => updateRow(row.id, { value: e.target.value })}
                  className="font-mono text-xs"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removeRow(row.id)}
                  className="text-slate-400 hover:text-red-500 shrink-0"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Variables helper */}
      <div className="rounded-lg border border-blue-100 bg-blue-50 p-3 space-y-2">
        <p className="text-xs font-semibold text-blue-700 flex items-center gap-1">
          <Info className="w-3.5 h-3.5" />
          Variáveis disponíveis
        </p>
        <div className="flex flex-wrap gap-2">
          {AVAILABLE_VARIABLES.map((v) => (
            <span
              key={v.name}
              className="inline-flex items-center gap-1 text-xs bg-white border border-blue-200 rounded px-2 py-0.5"
            >
              <code className="text-blue-700 font-mono">{v.name}</code>
              <span className="text-slate-500">— {v.desc}</span>
            </span>
          ))}
        </div>
      </div>

      {/* Live JSON preview */}
      {form.webhookRows.some((r) => r.key.trim()) && (
        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-slate-500 flex items-center gap-1">
            <Eye className="w-3.5 h-3.5" />
            Pré-visualização do JSON enviado
          </p>
          <pre className="text-xs bg-slate-900 text-emerald-300 rounded-lg p-4 overflow-x-auto leading-relaxed">
            {previewPayload()}
          </pre>
        </div>
      )}
    </div>
  )
}

function Step3({
  form,
  onChange,
}: {
  form: FormState
  onChange: (patch: Partial<FormState>) => void
}) {
  const today = new Date().toISOString().split("T")[0]

  return (
    <div className="space-y-6">
      {/* Schedule type */}
      <div className="space-y-2">
        <Label>Tipo de agendamento</Label>
        <div className="grid grid-cols-2 gap-3">
          {(["once", "recurring"] as ScheduleType[]).map((type) => {
            const isSelected = form.scheduleType === type
            return (
              <button
                key={type}
                type="button"
                onClick={() => onChange({ scheduleType: type })}
                className={`flex items-center gap-3 p-4 rounded-lg border-2 text-left transition-colors ${
                  isSelected
                    ? "border-slate-900 bg-slate-50"
                    : "border-slate-200 hover:border-slate-300"
                }`}
              >
                {type === "once" ? (
                  <Calendar className="w-5 h-5 text-slate-600 shrink-0" />
                ) : (
                  <RefreshCw className="w-5 h-5 text-slate-600 shrink-0" />
                )}
                <div>
                  <p className="text-sm font-medium text-slate-900">
                    {type === "once" ? "Uma vez" : "Recorrente"}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {type === "once"
                      ? "Disparo em data e hora específicas"
                      : "Repete em intervalos regulares"}
                  </p>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      <Separator />

      {form.scheduleType === "once" ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="schedule-date">
                Data <span className="text-red-500">*</span>
              </Label>
              <Input
                id="schedule-date"
                type="date"
                min={today}
                value={form.scheduleDate}
                onChange={(e) => onChange({ scheduleDate: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="schedule-time">
                Horário <span className="text-red-500">*</span>
              </Label>
              <Input
                id="schedule-time"
                type="time"
                value={form.scheduleTime}
                onChange={(e) => onChange({ scheduleTime: e.target.value })}
              />
            </div>
          </div>
          {form.scheduleDate && form.scheduleTime && (
            <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 text-sm text-slate-600">
              Os disparos serão enviados em{" "}
              <strong>
                {new Date(`${form.scheduleDate}T${form.scheduleTime}`).toLocaleString(
                  "pt-BR",
                  { dateStyle: "full", timeStyle: "short" }
                )}
              </strong>
              .
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="interval">
              Intervalo de repetição <span className="text-red-500">*</span>
            </Label>
            <Select
              value={String(form.intervalMonths)}
              onValueChange={(v) => onChange({ intervalMonths: Number(v) })}
            >
              <SelectTrigger id="interval">
                <SelectValue placeholder="Selecione o intervalo" />
              </SelectTrigger>
              <SelectContent>
                {INTERVAL_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={String(o.value)}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="start-date">
                Data de início <span className="text-red-500">*</span>
              </Label>
              <Input
                id="start-date"
                type="date"
                min={today}
                value={form.startDate}
                onChange={(e) => onChange({ startDate: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="end-date">Data de término (opcional)</Label>
              <Input
                id="end-date"
                type="date"
                min={form.startDate || today}
                value={form.endDate}
                onChange={(e) => onChange({ endDate: e.target.value })}
              />
            </div>
          </div>

          {form.startDate && form.intervalMonths > 0 && (
            <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 text-sm text-slate-600">
              O primeiro disparo ocorre em{" "}
              <strong>
                {new Date(form.startDate).toLocaleDateString("pt-BR", {
                  dateStyle: "long",
                })}
              </strong>
              {" "}e se repete a cada <strong>{form.intervalMonths} {form.intervalMonths === 1 ? "mês" : "meses"}</strong>
              {form.endDate
                ? ` até ${new Date(form.endDate).toLocaleDateString("pt-BR", { dateStyle: "long" })}.`
                : " sem data de término."}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function Step4({
  form,
  leads,
  leadsLoading,
  leadSearch,
  setLeadSearch,
  onChange,
}: {
  form: FormState
  leads: Lead[]
  leadsLoading: boolean
  leadSearch: string
  setLeadSearch: (v: string) => void
  onChange: (patch: Partial<FormState>) => void
}) {
  const addFilterRule = () => {
    onChange({
      filterRules: [
        ...form.filterRules,
        { id: uid(), field: "name", operator: "ilike", value: "" },
      ],
    })
  }

  const removeFilterRule = (id: string) => {
    onChange({ filterRules: form.filterRules.filter((r) => r.id !== id) })
  }

  const updateFilterRule = (id: string, patch: Partial<FilterRule>) => {
    onChange({
      filterRules: form.filterRules.map((r) =>
        r.id === id ? { ...r, ...patch } : r
      ),
    })
  }

  const toggleLead = (id: string) => {
    const next = new Set(form.selectedLeadIds)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    onChange({ selectedLeadIds: next })
  }

  const filteredLeads = leads.filter((l) => {
    if (!leadSearch.trim()) return true
    const q = leadSearch.toLowerCase()
    return (
      l.name?.toLowerCase().includes(q) ||
      l.phone.includes(q)
    )
  })

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <Label>Destinatários</Label>
        <div className="space-y-2">
          {(
            [
              { value: "all", label: "Todos os leads da organização", desc: `${leads.length} leads` },
              { value: "filter", label: "Filtrar por campo", desc: "Definir regras de filtro" },
              { value: "manual", label: "Selecionar manualmente", desc: "Escolher leads individualmente" },
            ] as { value: TargetMode; label: string; desc: string }[]
          ).map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange({ targetMode: opt.value })}
              className={`w-full flex items-center justify-between p-3 rounded-lg border-2 text-left transition-colors ${
                form.targetMode === opt.value
                  ? "border-slate-900 bg-slate-50"
                  : "border-slate-200 hover:border-slate-300"
              }`}
            >
              <div>
                <p className="text-sm font-medium text-slate-900">{opt.label}</p>
                <p className="text-xs text-slate-500">{opt.desc}</p>
              </div>
              {form.targetMode === opt.value && (
                <Check className="w-4 h-4 text-slate-900 shrink-0" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Filter builder */}
      {form.targetMode === "filter" && (
        <div className="space-y-3">
          <Separator />
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-slate-700">Regras de filtro</p>
            <Button type="button" variant="outline" size="sm" onClick={addFilterRule}>
              <Plus className="w-3.5 h-3.5" />
              Adicionar regra
            </Button>
          </div>
          {form.filterRules.length === 0 ? (
            <p className="text-sm text-slate-400 italic">Nenhuma regra adicionada.</p>
          ) : (
            <div className="space-y-2">
              {form.filterRules.map((rule) => (
                <div key={rule.id} className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 items-center">
                  <Select
                    value={rule.field}
                    onValueChange={(v) => updateFilterRule(rule.id, { field: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {LEAD_FILTER_FIELDS.map((f) => (
                        <SelectItem key={f.value} value={f.value}>
                          {f.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select
                    value={rule.operator}
                    onValueChange={(v) => updateFilterRule(rule.id, { operator: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {FILTER_OPERATORS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    placeholder="valor"
                    value={rule.value}
                    onChange={(e) => updateFilterRule(rule.id, { value: e.target.value })}
                    className="text-sm"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeFilterRule(rule.id)}
                    className="text-slate-400 hover:text-red-500 shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Manual lead selector */}
      {form.targetMode === "manual" && (
        <div className="space-y-3">
          <Separator />
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="Buscar leads por nome ou telefone..."
              className="pl-9"
              value={leadSearch}
              onChange={(e) => setLeadSearch(e.target.value)}
            />
          </div>

          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>
              {leadsLoading ? (
                <span className="flex items-center gap-1">
                  <Loader2 className="w-3 h-3 animate-spin" /> Carregando...
                </span>
              ) : (
                `${filteredLeads.length} leads exibidos`
              )}
            </span>
            <span className="font-medium text-slate-700">
              {form.selectedLeadIds.size} selecionado{form.selectedLeadIds.size !== 1 ? "s" : ""}
            </span>
          </div>

          <div className="border border-slate-200 rounded-lg overflow-hidden max-h-64 overflow-y-auto">
            {filteredLeads.length === 0 ? (
              <div className="py-10 text-center text-sm text-slate-400">
                <Users className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                Nenhum lead encontrado.
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {filteredLeads.map((lead) => (
                  <label
                    key={lead.id}
                    className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-slate-50 transition-colors"
                  >
                    <Checkbox
                      checked={form.selectedLeadIds.has(lead.id)}
                      onCheckedChange={() => toggleLead(lead.id)}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate">
                        {lead.name ?? <span className="text-slate-400 italic">Sem nome</span>}
                      </p>
                      <p className="text-xs text-slate-500 font-mono">{lead.phone}</p>
                    </div>
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Count summary */}
      {form.targetMode !== "all" && (
        <div className="rounded-lg bg-emerald-50 border border-emerald-100 p-3 text-sm text-emerald-700">
          {form.targetMode === "manual" ? (
            <>
              <strong>{form.selectedLeadIds.size}</strong> lead{form.selectedLeadIds.size !== 1 ? "s" : ""} selecionado{form.selectedLeadIds.size !== 1 ? "s" : ""}.
            </>
          ) : (
            <>
              <strong>{form.filterRules.length}</strong> regra{form.filterRules.length !== 1 ? "s" : ""} de filtro definida{form.filterRules.length !== 1 ? "s" : ""}.
              {" "}Os leads correspondentes serão calculados ao criar.
            </>
          )}
        </div>
      )}
    </div>
  )
}

function Step5({
  form,
  services,
  leads,
}: {
  form: FormState
  services: Service[]
  leads: Lead[]
}) {
  const service = services.find((s) => s.id === form.serviceId)

  const webhookPayloadPreview = (() => {
    const obj: Record<string, string> = {}
    for (const row of form.webhookRows) {
      if (row.key.trim()) obj[row.key.trim()] = row.value
    }
    return JSON.stringify(obj, null, 2)
  })()

  const scheduleDescription = (() => {
    if (form.scheduleType === "once") {
      if (form.scheduleDate && form.scheduleTime) {
        return `Uma vez em ${new Date(`${form.scheduleDate}T${form.scheduleTime}`).toLocaleString("pt-BR", {
          dateStyle: "long",
          timeStyle: "short",
        })}`
      }
      return "Data não definida"
    }
    const intervalLabel = INTERVAL_OPTIONS.find((o) => o.value === form.intervalMonths)?.label ?? `${form.intervalMonths} meses`
    const startLabel = form.startDate
      ? new Date(form.startDate).toLocaleDateString("pt-BR", { dateStyle: "long" })
      : "não definido"
    return `Recorrente a cada ${intervalLabel}, a partir de ${startLabel}`
  })()

  const targetDescription = (() => {
    if (form.targetMode === "all") return `Todos os leads (${leads.length})`
    if (form.targetMode === "manual") return `${form.selectedLeadIds.size} lead${form.selectedLeadIds.size !== 1 ? "s" : ""} selecionado${form.selectedLeadIds.size !== 1 ? "s" : ""} manualmente`
    return `Filtro com ${form.filterRules.length} regra${form.filterRules.length !== 1 ? "s" : ""}`
  })()

  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-slate-200 divide-y divide-slate-100">
        <SummaryRow label="Nome" value={form.name} />
        <SummaryRow label="Serviço" value={service?.name ?? "Sem serviço"} />
        {form.description && <SummaryRow label="Descrição" value={form.description} />}
        <SummaryRow label="Webhook URL" value={form.webhookUrl} mono />
        <SummaryRow label="Campos do webhook" value={`${form.webhookRows.filter((r) => r.key.trim()).length} campo${form.webhookRows.filter((r) => r.key.trim()).length !== 1 ? "s" : ""} configurado${form.webhookRows.filter((r) => r.key.trim()).length !== 1 ? "s" : ""}`} />
        <SummaryRow label="Agendamento" value={scheduleDescription} />
        <SummaryRow label="Destinatários" value={targetDescription} />
      </div>

      {form.webhookRows.some((r) => r.key.trim()) && (
        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-slate-500">Payload JSON</p>
          <pre className="text-xs bg-slate-900 text-emerald-300 rounded-lg p-4 overflow-x-auto leading-relaxed">
            {webhookPayloadPreview}
          </pre>
        </div>
      )}

      <div className="rounded-lg bg-amber-50 border border-amber-100 p-3 text-sm text-amber-700">
        <strong>Atenção:</strong> A cadência será criada com status <strong>Rascunho</strong>.
        Ative-a na página de detalhes para iniciar os disparos.
      </div>
    </div>
  )
}

function SummaryRow({
  label,
  value,
  mono,
}: {
  label: string
  value: string
  mono?: boolean
}) {
  return (
    <div className="flex items-start gap-4 px-4 py-3">
      <span className="text-xs text-slate-500 w-36 shrink-0 pt-0.5">{label}</span>
      <span className={`text-sm text-slate-900 flex-1 ${mono ? "font-mono text-xs" : ""}`}>
        {value || <span className="text-slate-400 italic">—</span>}
      </span>
    </div>
  )
}

// ─── Step Indicator ─────────────────────────────────────────────────────────────

function StepIndicator({
  steps,
  current,
}: {
  steps: typeof STEPS
  current: number
}) {
  return (
    <div className="flex items-center gap-1 mb-8">
      {steps.map((step, i) => {
        const state = i < current ? "done" : i === current ? "active" : "upcoming"
        return (
          <div key={i} className="flex items-center gap-1">
            <div
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                state === "done"
                  ? "bg-emerald-100 text-emerald-700"
                  : state === "active"
                  ? "bg-slate-900 text-white"
                  : "bg-slate-100 text-slate-400"
              }`}
            >
              {state === "done" ? (
                <Check className="w-3 h-3" />
              ) : (
                <span>{step.icon}</span>
              )}
              <span className="hidden sm:inline">{step.label}</span>
            </div>
            {i < steps.length - 1 && (
              <div
                className={`h-px w-4 sm:w-6 transition-colors ${
                  i < current ? "bg-emerald-300" : "bg-slate-200"
                }`}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Validation ─────────────────────────────────────────────────────────────────

function validateStep(step: number, form: FormState): string | null {
  switch (step) {
    case 0:
      if (!form.name.trim()) return "Informe o nome da cadência."
      return null
    case 1:
      if (!form.webhookUrl.trim()) return "Informe a URL do webhook."
      try {
        new URL(form.webhookUrl)
      } catch {
        return "URL do webhook inválida."
      }
      if (form.webhookRows.some((r) => r.key.trim() === "" && r.value.trim() !== "")) {
        return "Todos os campos do webhook precisam de uma chave."
      }
      return null
    case 2:
      if (form.scheduleType === "once") {
        if (!form.scheduleDate) return "Selecione a data do disparo."
        if (!form.scheduleTime) return "Selecione o horário do disparo."
      } else {
        if (!form.intervalMonths) return "Selecione o intervalo de repetição."
        if (!form.startDate) return "Selecione a data de início."
      }
      return null
    case 3:
      if (form.targetMode === "manual" && form.selectedLeadIds.size === 0) {
        return "Selecione pelo menos um lead."
      }
      if (form.targetMode === "filter" && form.filterRules.some((r) => !r.value.trim())) {
        return "Preencha o valor de todas as regras de filtro."
      }
      return null
    default:
      return null
  }
}

// ─── Main Page ──────────────────────────────────────────────────────────────────

const initialForm: FormState = {
  name: "",
  serviceId: "none",
  description: "",
  webhookUrl: "",
  webhookRows: [{ id: uid(), key: "", value: "" }],
  scheduleType: "once",
  scheduleDate: "",
  scheduleTime: "09:00",
  intervalMonths: 3,
  startDate: "",
  endDate: "",
  targetMode: "all",
  filterRules: [],
  selectedLeadIds: new Set(),
}

export default function NewCadencePage() {
  const router = useRouter()
  const supabase = createClient()

  const [step, setStep] = useState(0)
  const [form, setForm] = useState<FormState>(initialForm)
  const [services, setServices] = useState<Service[]>([])
  const [leads, setLeads] = useState<Lead[]>([])
  const [leadsLoading, setLeadsLoading] = useState(false)
  const [leadSearch, setLeadSearch] = useState("")
  const [stepError, setStepError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [orgId, setOrgId] = useState<string | null>(null)

  const onChange = useCallback((patch: Partial<FormState>) => {
    setForm((prev) => ({ ...prev, ...patch }))
    setStepError(null)
  }, [])

  // Load org data
  useEffect(() => {
    const init = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) { router.push("/login"); return }

      const { data: profile } = await supabase
        .from("profiles")
        .select("org_id")
        .eq("id", user.id)
        .single()

      const oid = profile?.org_id
      if (!oid) return
      setOrgId(oid)

      const { data: svcData } = await supabase
        .from("services")
        .select("*")
        .eq("org_id", oid)
        .order("name")
      setServices(svcData ?? [])
    }
    init()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Load leads when reaching step 4
  useEffect(() => {
    if (step !== 3 || !orgId || leads.length > 0) return
    setLeadsLoading(true)
    supabase
      .from("leads")
      .select("id, name, phone, custom_fields, tags")
      .eq("org_id", orgId)
      .order("name")
      .then(({ data }) => {
        setLeads((data ?? []) as unknown as Lead[])
        setLeadsLoading(false)
      })
  }, [step, orgId]) // eslint-disable-line react-hooks/exhaustive-deps

  const goNext = () => {
    const error = validateStep(step, form)
    if (error) {
      setStepError(error)
      return
    }
    setStepError(null)
    setStep((s) => s + 1)
  }

  const goBack = () => {
    setStepError(null)
    setStep((s) => s - 1)
  }

  const handleSubmit = async () => {
    if (!orgId) return
    setSubmitting(true)
    setStepError(null)

    const webhookBodyTemplate: Record<string, string> = {}
    for (const row of form.webhookRows) {
      if (row.key.trim()) webhookBodyTemplate[row.key.trim()] = row.value
    }

    const scheduleConfig =
      form.scheduleType === "once"
        ? { date: form.scheduleDate, time: form.scheduleTime }
        : {
            interval_months: form.intervalMonths,
            start_date: form.startDate,
            end_date: form.endDate || null,
          }

    const targetFilter: Record<string, unknown> =
      form.targetMode === "filter"
        ? { rules: form.filterRules }
        : {}

    const body = {
      name: form.name.trim(),
      service_id: form.serviceId === "none" ? null : form.serviceId,
      webhook_url: form.webhookUrl.trim(),
      webhook_body_template: webhookBodyTemplate,
      schedule_type: form.scheduleType,
      schedule_config: scheduleConfig,
      target_filter: targetFilter,
      target_lead_ids:
        form.targetMode === "manual" ? Array.from(form.selectedLeadIds) : null,
    }

    try {
      const res = await fetch("/api/cadences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? "Erro ao criar cadência.")
      }

      const { cadence } = await res.json()
      router.push(`/cadences/${cadence.id}`)
    } catch (e: unknown) {
      setStepError(e instanceof Error ? e.message : "Erro inesperado.")
      setSubmitting(false)
    }
  }

  const STEP_TITLES = [
    "Informações Básicas",
    "Configurar Webhook",
    "Agendamento",
    "Selecionar Leads",
    "Revisar e Criar",
  ]

  return (
    <div>
      <PageHeader
        title="Nova Cadência"
        description="Configure uma sequência automática de disparos"
      />

      <div className="max-w-2xl mx-auto">
        <StepIndicator steps={STEPS} current={step} />

        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-base flex items-center gap-2">
              {step === 0 && <Info className="w-4 h-4 text-slate-500" />}
              {step === 1 && <Webhook className="w-4 h-4 text-slate-500" />}
              {step === 2 && <Calendar className="w-4 h-4 text-slate-500" />}
              {step === 3 && <Users className="w-4 h-4 text-slate-500" />}
              {step === 4 && <Eye className="w-4 h-4 text-slate-500" />}
              {STEP_TITLES[step]}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {step === 0 && (
              <Step1 form={form} services={services} onChange={onChange} />
            )}
            {step === 1 && <Step2 form={form} onChange={onChange} />}
            {step === 2 && <Step3 form={form} onChange={onChange} />}
            {step === 3 && (
              <Step4
                form={form}
                leads={leads}
                leadsLoading={leadsLoading}
                leadSearch={leadSearch}
                setLeadSearch={setLeadSearch}
                onChange={onChange}
              />
            )}
            {step === 4 && (
              <Step5 form={form} services={services} leads={leads} />
            )}

            {stepError && (
              <p className="mt-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {stepError}
              </p>
            )}

            <div className="flex items-center justify-between mt-6 pt-4 border-t border-slate-100">
              <Button
                type="button"
                variant="outline"
                onClick={step === 0 ? () => router.push("/cadences") : goBack}
                disabled={submitting}
              >
                <ChevronLeft className="w-4 h-4" />
                {step === 0 ? "Cancelar" : "Voltar"}
              </Button>

              {step < STEPS.length - 1 ? (
                <Button type="button" onClick={goNext}>
                  Continuar
                  <ChevronRight className="w-4 h-4" />
                </Button>
              ) : (
                <Button onClick={handleSubmit} disabled={submitting} variant="success">
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Criando...
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      Criar Cadência
                    </>
                  )}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Progress bar */}
        <div className="mt-4 h-1 bg-slate-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-slate-900 rounded-full transition-all duration-300"
            style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
          />
        </div>
        <p className="text-center text-xs text-slate-400 mt-1.5">
          Etapa {step + 1} de {STEPS.length}
        </p>
      </div>
    </div>
  )
}
