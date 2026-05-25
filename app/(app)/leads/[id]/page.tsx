"use client"

import { useEffect, useState, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { PageHeader } from "@/components/layout/page-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Separator } from "@/components/ui/separator"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  formatPhone,
  formatDateTime,
  formatRelativeDate,
  getStatusColor,
  getStatusLabel,
} from "@/lib/utils"
import type { Lead, LeadActivity, Dispatch } from "@/types"
import {
  ArrowLeft,
  Phone,
  Pencil,
  CheckCircle2,
  Plus,
  Loader2,
  MessageSquare,
  Send,
  CalendarClock,
  Wrench,
  StickyNote,
  Tag,
  X,
  Save,
} from "lucide-react"
import Link from "next/link"

// ─── Helpers ──────────────────────────────────────────────────────────────────

function ActivityIcon({ type }: { type: string }) {
  switch (type) {
    case "response":
      return <MessageSquare className="w-4 h-4 text-emerald-500" />
    case "visit":
      return <Wrench className="w-4 h-4 text-blue-500" />
    case "dispatch":
      return <Send className="w-4 h-4 text-amber-500" />
    case "note":
    default:
      return <StickyNote className="w-4 h-4 text-slate-400" />
  }
}

function activityLabel(type: string): string {
  const map: Record<string, string> = {
    response: "Respondeu",
    visit: "Visitou",
    dispatch: "Disparo enviado",
    note: "Nota",
  }
  return map[type] ?? type
}

// ─── AddNoteDialog ────────────────────────────────────────────────────────────

function AddNoteDialog({
  open,
  onOpenChange,
  leadId,
  onAdded,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  leadId: string
  onAdded: () => void
}) {
  const [text, setText] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()

  const handleClose = () => {
    onOpenChange(false)
    setText("")
    setError(null)
  }

  const handleSave = async () => {
    if (!text.trim()) return
    setLoading(true)
    setError(null)
    const {
      data: { user },
    } = await supabase.auth.getUser()
    const { error: err } = await supabase.from("lead_activities").insert({
      lead_id: leadId,
      type: "note",
      description: text.trim(),
      created_by: user?.id ?? null,
    })
    setLoading(false)
    if (err) {
      setError("Erro ao salvar nota.")
      return
    }
    onAdded()
    handleClose()
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Adicionar Nota</DialogTitle>
          <DialogDescription>
            Registre uma observação ou anotação sobre este lead.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Textarea
            placeholder="Escreva sua nota aqui…"
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={4}
            className="resize-none"
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={!text.trim() || loading}>
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            Salvar nota
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── EditLeadDialog ───────────────────────────────────────────────────────────

function EditLeadDialog({
  open,
  onOpenChange,
  lead,
  onSaved,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  lead: Lead
  onSaved: () => void
}) {
  const [name, setName] = useState(lead.name ?? "")
  const [notes, setNotes] = useState(lead.notes ?? "")
  const [tagInput, setTagInput] = useState("")
  const [tags, setTags] = useState<string[]>(lead.tags ?? [])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setName(lead.name ?? "")
      setNotes(lead.notes ?? "")
      setTags(lead.tags ?? [])
      setError(null)
    }
  }, [open, lead])

  const addTag = () => {
    const t = tagInput.trim()
    if (t && !tags.includes(t)) setTags((prev) => [...prev, t])
    setTagInput("")
  }

  const removeTag = (tag: string) => setTags((prev) => prev.filter((t) => t !== tag))

  const handleSave = async () => {
    setLoading(true)
    setError(null)
    const res = await fetch(`/api/leads/${lead.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim() || null, notes: notes.trim() || null, tags }),
    })
    setLoading(false)
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      setError(body.error ?? "Erro ao salvar.")
      return
    }
    onSaved()
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Editar Lead</DialogTitle>
          <DialogDescription>
            Atualize as informações do contato.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Nome</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nome do contato"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Tags</Label>
            <div className="flex flex-wrap gap-1 mb-2">
              {tags.map((tag) => (
                <Badge key={tag} variant="secondary" className="gap-1">
                  {tag}
                  <button
                    onClick={() => removeTag(tag)}
                    className="hover:text-red-500 transition-colors"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                placeholder="Nova tag…"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag() } }}
              />
              <Button type="button" variant="outline" size="sm" onClick={addTag}>
                <Tag className="w-4 h-4" />
              </Button>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Observações gerais</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Anotações sobre o cliente…"
              rows={3}
              className="resize-none"
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={loading}>
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── CustomFieldsEditor ───────────────────────────────────────────────────────

function CustomFieldsEditor({
  leadId,
  fields,
  onSaved,
}: {
  leadId: string
  fields: Record<string, string>
  onSaved: () => void
}) {
  const [localFields, setLocalFields] = useState<Array<[string, string]>>(
    Object.entries(fields)
  )
  const [newKey, setNewKey] = useState("")
  const [newValue, setNewValue] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLocalFields(Object.entries(fields))
  }, [fields])

  const updateField = (idx: number, key: string, value: string) => {
    setLocalFields((prev) => {
      const next = [...prev]
      next[idx] = [key, value]
      return next
    })
  }

  const removeField = (idx: number) => {
    setLocalFields((prev) => prev.filter((_, i) => i !== idx))
  }

  const addField = () => {
    const k = newKey.trim()
    const v = newValue.trim()
    if (!k) return
    setLocalFields((prev) => [...prev, [k, v]])
    setNewKey("")
    setNewValue("")
  }

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    const custom_fields: Record<string, string> = {}
    localFields.forEach(([k, v]) => {
      if (k.trim()) custom_fields[k.trim()] = v
    })
    const res = await fetch(`/api/leads/${leadId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ custom_fields }),
    })
    setSaving(false)
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      setError(body.error ?? "Erro ao salvar campos.")
      return
    }
    onSaved()
  }

  return (
    <div className="space-y-3">
      {localFields.map(([k, v], idx) => (
        <div key={idx} className="flex items-center gap-2">
          <Input
            value={k}
            onChange={(e) => updateField(idx, e.target.value, v)}
            placeholder="Campo"
            className="w-36 text-sm font-mono"
          />
          <Input
            value={v}
            onChange={(e) => updateField(idx, k, e.target.value)}
            placeholder="Valor"
            className="flex-1 text-sm"
          />
          <Button
            variant="ghost"
            size="sm"
            className="text-slate-400 hover:text-red-500"
            onClick={() => removeField(idx)}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      ))}

      {/* Add new field row */}
      <div className="flex items-center gap-2">
        <Input
          value={newKey}
          onChange={(e) => setNewKey(e.target.value)}
          placeholder="Novo campo"
          className="w-36 text-sm font-mono"
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addField() } }}
        />
        <Input
          value={newValue}
          onChange={(e) => setNewValue(e.target.value)}
          placeholder="Valor"
          className="flex-1 text-sm"
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addField() } }}
        />
        <Button variant="outline" size="sm" onClick={addField}>
          <Plus className="w-4 h-4" />
        </Button>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <Button size="sm" onClick={handleSave} disabled={saving} className="w-full">
        {saving ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Save className="w-4 h-4" />
        )}
        Salvar campos personalizados
      </Button>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function LeadDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()

  const [lead, setLead] = useState<Lead | null>(null)
  const [activities, setActivities] = useState<LeadActivity[]>([])
  const [dispatches, setDispatches] = useState<Dispatch[]>([])
  const [loading, setLoading] = useState(true)
  const [editOpen, setEditOpen] = useState(false)
  const [noteOpen, setNoteOpen] = useState(false)
  const [markingVisit, setMarkingVisit] = useState(false)
  const [markingDispatch, setMarkingDispatch] = useState<string | null>(null)

  const supabase = createClient()

  const fetchData = useCallback(async () => {
    if (!id) return
    const [leadRes, activitiesRes, dispatchesRes] = await Promise.all([
      supabase.from("leads").select("*").eq("id", id).single(),
      supabase
        .from("lead_activities")
        .select("*, dispatches(id, status, scheduled_at, sent_at)")
        .eq("lead_id", id)
        .order("created_at", { ascending: false })
        .limit(50),
      supabase
        .from("dispatches")
        .select("*, cadences(name)")
        .eq("lead_id", id)
        .order("created_at", { ascending: false })
        .limit(50),
    ])

    if (leadRes.error || !leadRes.data) {
      router.push("/leads")
      return
    }

    setLead(leadRes.data as Lead)
    setActivities((activitiesRes.data as LeadActivity[]) ?? [])
    setDispatches((dispatchesRes.data as Dispatch[]) ?? [])
    setLoading(false)
  }, [id]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleMarkVisit = async () => {
    if (!lead) return
    setMarkingVisit(true)
    const {
      data: { user },
    } = await supabase.auth.getUser()

    await Promise.all([
      supabase.from("lead_activities").insert({
        lead_id: lead.id,
        type: "visit",
        description: "Visitou a oficina",
        created_by: user?.id ?? null,
      }),
      supabase
        .from("leads")
        .update({ last_service_date: new Date().toISOString() })
        .eq("id", lead.id),
    ])
    setMarkingVisit(false)
    fetchData()
  }

  const handleMarkResponse = async (dispatchId: string) => {
    setMarkingDispatch(dispatchId)
    const {
      data: { user },
    } = await supabase.auth.getUser()

    await Promise.all([
      supabase
        .from("dispatches")
        .update({ response_received: true })
        .eq("id", dispatchId),
      supabase.from("lead_activities").insert({
        lead_id: lead!.id,
        dispatch_id: dispatchId,
        type: "response",
        description: "Respondeu ao disparo",
        created_by: user?.id ?? null,
      }),
    ])
    setMarkingDispatch(null)
    fetchData()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    )
  }

  if (!lead) return null

  const customEntries = Object.entries(lead.custom_fields ?? {})

  return (
    <div>
      <PageHeader
        title={lead.name ?? formatPhone(lead.phone)}
        description={lead.name ? formatPhone(lead.phone) : "Lead sem nome"}
      >
        <Link href="/leads">
          <Button variant="outline" size="sm">
            <ArrowLeft className="w-4 h-4" />
            Voltar
          </Button>
        </Link>
        <Button
          variant="outline"
          size="sm"
          onClick={handleMarkVisit}
          disabled={markingVisit}
        >
          {markingVisit ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Wrench className="w-4 h-4" />
          )}
          Marcar como visitou
        </Button>
        <Button size="sm" onClick={() => setEditOpen(true)}>
          <Pencil className="w-4 h-4" />
          Editar
        </Button>
      </PageHeader>

      {/* Name + tags header */}
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <div className="flex items-center gap-2 text-slate-500">
          <Phone className="w-4 h-4" />
          <span className="font-mono text-sm">{formatPhone(lead.phone)}</span>
        </div>
        {lead.tags?.map((tag) => (
          <Badge key={tag} variant="info">
            {tag}
          </Badge>
        ))}
        {lead.last_service_date && (
          <span className="text-xs text-slate-400">
            Última visita: {formatRelativeDate(lead.last_service_date)}
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column */}
        <div className="lg:col-span-1 space-y-4">
          {/* Lead info */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Informações do Lead</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <p className="text-xs text-slate-400 font-medium uppercase tracking-wide mb-0.5">
                  Telefone
                </p>
                <p className="text-slate-900 font-mono">{formatPhone(lead.phone)}</p>
              </div>
              {lead.name && (
                <div>
                  <p className="text-xs text-slate-400 font-medium uppercase tracking-wide mb-0.5">
                    Nome
                  </p>
                  <p className="text-slate-900">{lead.name}</p>
                </div>
              )}
              {lead.email && (
                <div>
                  <p className="text-xs text-slate-400 font-medium uppercase tracking-wide mb-0.5">
                    E-mail
                  </p>
                  <p className="text-slate-900">{lead.email}</p>
                </div>
              )}
              <div>
                <p className="text-xs text-slate-400 font-medium uppercase tracking-wide mb-0.5">
                  Cadastro
                </p>
                <p className="text-slate-700">{formatDateTime(lead.created_at)}</p>
              </div>
              {lead.last_contact_date && (
                <div>
                  <p className="text-xs text-slate-400 font-medium uppercase tracking-wide mb-0.5">
                    Último contato
                  </p>
                  <p className="text-slate-700">{formatRelativeDate(lead.last_contact_date)}</p>
                </div>
              )}
              {lead.notes && (
                <>
                  <Separator />
                  <div>
                    <p className="text-xs text-slate-400 font-medium uppercase tracking-wide mb-0.5">
                      Observações
                    </p>
                    <p className="text-slate-700 whitespace-pre-line leading-relaxed">
                      {lead.notes}
                    </p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Custom fields */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Campos Personalizados</CardTitle>
            </CardHeader>
            <CardContent>
              {customEntries.length === 0 && (
                <p className="text-sm text-slate-400 mb-4">Nenhum campo personalizado.</p>
              )}
              <CustomFieldsEditor
                leadId={lead.id}
                fields={lead.custom_fields ?? {}}
                onSaved={fetchData}
              />
            </CardContent>
          </Card>
        </div>

        {/* Right column */}
        <div className="lg:col-span-2 space-y-4">
          {/* Activity timeline */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-base">Linha do Tempo</CardTitle>
              <Button size="sm" variant="outline" onClick={() => setNoteOpen(true)}>
                <Plus className="w-4 h-4" />
                Adicionar nota
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              {activities.length === 0 ? (
                <div className="px-6 py-10 text-center text-slate-400">
                  <CalendarClock className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  <p className="text-sm">Nenhuma atividade registrada.</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-50">
                  {activities.map((activity) => (
                    <div key={activity.id} className="flex items-start gap-3 px-6 py-3">
                      <div className="mt-0.5 w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
                        <ActivityIcon type={activity.type} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-800">
                          {activityLabel(activity.type)}
                        </p>
                        {activity.description && (
                          <p className="text-sm text-slate-600 mt-0.5 whitespace-pre-line">
                            {activity.description}
                          </p>
                        )}
                        <p className="text-xs text-slate-400 mt-1">
                          {formatRelativeDate(activity.created_at)}
                          {" · "}
                          {formatDateTime(activity.created_at)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Dispatch history */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Histórico de Disparos</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {dispatches.length === 0 ? (
                <div className="px-6 py-10 text-center text-slate-400">
                  <Send className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  <p className="text-sm">Nenhum disparo para este lead.</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-50">
                  {dispatches.map((dispatch) => (
                    <div
                      key={dispatch.id}
                      className="flex items-center justify-between px-6 py-3"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-medium text-slate-800 truncate">
                            {(dispatch.cadences as any)?.name ?? "Disparo avulso"}
                          </p>
                          <Badge
                            className={`text-xs ${getStatusColor(dispatch.status)}`}
                            variant="outline"
                          >
                            {getStatusLabel(dispatch.status)}
                          </Badge>
                          {dispatch.response_received && (
                            <Badge variant="success" className="text-xs">
                              Respondeu
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {dispatch.sent_at
                            ? `Enviado ${formatDateTime(dispatch.sent_at)}`
                            : `Agendado ${formatDateTime(dispatch.scheduled_at)}`}
                        </p>
                      </div>
                      {dispatch.status === "sent" && !dispatch.response_received && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="shrink-0 ml-3"
                          disabled={markingDispatch === dispatch.id}
                          onClick={() => handleMarkResponse(dispatch.id)}
                        >
                          {markingDispatch === dispatch.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          )}
                          Marcar como respondeu
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Dialogs */}
      <EditLeadDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        lead={lead}
        onSaved={fetchData}
      />
      <AddNoteDialog
        open={noteOpen}
        onOpenChange={setNoteOpen}
        leadId={lead.id}
        onAdded={fetchData}
      />
    </div>
  )
}
