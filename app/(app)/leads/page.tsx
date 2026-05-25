"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { PageHeader } from "@/components/layout/page-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { formatPhone, formatDate, formatRelativeDate } from "@/lib/utils"
import type { Lead } from "@/types"
import {
  Search,
  Upload,
  Users,
  ExternalLink,
  FileSpreadsheet,
  X,
  CheckCircle2,
  Loader2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react"
import Link from "next/link"
import Papa from "papaparse"
import * as XLSX from "xlsx"

// ─── Types ────────────────────────────────────────────────────────────────────

type ImportStep = "upload" | "mapping" | "importing" | "done"

interface ParsedRow {
  [key: string]: string
}

interface ImportResult {
  imported: number
  skipped: number
}

const FIELD_OPTIONS = [
  { value: "__skip__", label: "— Ignorar —" },
  { value: "phone", label: "Telefone (obrigatório)" },
  { value: "name", label: "Nome" },
  { value: "__custom__", label: "Campo personalizado" },
]

// ─── LeadImportDialog ─────────────────────────────────────────────────────────

function LeadImportDialog({
  open,
  onOpenChange,
  orgId,
  onSuccess,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  orgId: string
  onSuccess: () => void
}) {
  const [step, setStep] = useState<ImportStep>("upload")
  const [file, setFile] = useState<File | null>(null)
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([])
  const [columns, setColumns] = useState<string[]>([])
  const [columnMap, setColumnMap] = useState<Record<string, string>>({})
  const [result, setResult] = useState<ImportResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [progress, setProgress] = useState(0)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const reset = useCallback(() => {
    setStep("upload")
    setFile(null)
    setParsedRows([])
    setColumns([])
    setColumnMap({})
    setResult(null)
    setError(null)
    setProgress(0)
  }, [])

  const handleClose = () => {
    onOpenChange(false)
    setTimeout(reset, 300)
  }

  const parseFile = useCallback(async (f: File) => {
    setError(null)
    const ext = f.name.split(".").pop()?.toLowerCase()

    if (ext === "csv") {
      Papa.parse<ParsedRow>(f, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          if (!results.data.length) {
            setError("Arquivo CSV vazio ou inválido.")
            return
          }
          const cols = results.meta.fields ?? Object.keys(results.data[0])
          setColumns(cols)
          setParsedRows(results.data)
          const defaultMap: Record<string, string> = {}
          cols.forEach((c) => { defaultMap[c] = "__skip__" })
          setColumnMap(defaultMap)
          setStep("mapping")
        },
        error: () => setError("Falha ao ler o arquivo CSV."),
      })
    } else if (ext === "xlsx" || ext === "xls") {
      try {
        const buffer = await f.arrayBuffer()
        const wb = XLSX.read(buffer, { type: "array" })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const data = XLSX.utils.sheet_to_json<ParsedRow>(ws, { defval: "" })
        if (!data.length) {
          setError("Arquivo Excel vazio ou inválido.")
          return
        }
        const cols = Object.keys(data[0])
        setColumns(cols)
        setParsedRows(data)
        const defaultMap: Record<string, string> = {}
        cols.forEach((c) => { defaultMap[c] = "__skip__" })
        setColumnMap(defaultMap)
        setStep("mapping")
      } catch {
        setError("Falha ao ler o arquivo Excel.")
      }
    } else {
      setError("Formato não suportado. Use CSV ou XLSX.")
    }
  }, [])

  const handleFileChange = (f: File) => {
    setFile(f)
    parseFile(f)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const f = e.dataTransfer.files[0]
    if (f) handleFileChange(f)
  }

  const handleImport = async () => {
    setError(null)
    const phoneCol = Object.entries(columnMap).find(([, v]) => v === "phone")?.[0]
    if (!phoneCol) {
      setError("Selecione qual coluna representa o Telefone.")
      return
    }

    const nameCol = Object.entries(columnMap).find(([, v]) => v === "name")?.[0]
    const customCols = Object.entries(columnMap)
      .filter(([, v]) => v === "__custom__")
      .map(([k]) => k)

    const leads = parsedRows
      .map((row) => {
        const phone = String(row[phoneCol] ?? "").replace(/\D/g, "")
        if (!phone) return null
        const entry: Record<string, unknown> = { phone }
        if (nameCol && row[nameCol]) entry.name = String(row[nameCol]).trim()
        const custom_fields: Record<string, string> = {}
        customCols.forEach((col) => {
          if (row[col]) custom_fields[col] = String(row[col])
        })
        if (Object.keys(custom_fields).length) entry.custom_fields = custom_fields
        return entry
      })
      .filter(Boolean)

    if (!leads.length) {
      setError("Nenhum lead válido encontrado. Verifique a coluna de telefone.")
      return
    }

    setStep("importing")
    setProgress(20)

    try {
      const res = await fetch("/api/leads/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leads, org_id: orgId }),
      })
      setProgress(80)
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? "Erro ao importar.")
      }
      const data: ImportResult = await res.json()
      setProgress(100)
      setResult(data)
      setStep("done")
      onSuccess()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erro inesperado.")
      setStep("mapping")
      setProgress(0)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Importar Planilha de Leads</DialogTitle>
          <DialogDescription>
            Carregue um arquivo CSV ou XLSX e mapeie as colunas para os campos do sistema.
          </DialogDescription>
        </DialogHeader>

        {/* Step: Upload */}
        {step === "upload" && (
          <div className="space-y-4">
            <div
              className={`border-2 border-dashed rounded-xl p-10 text-center transition-colors cursor-pointer ${
                isDragging
                  ? "border-blue-400 bg-blue-50"
                  : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
              }`}
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <FileSpreadsheet className="w-10 h-10 mx-auto mb-3 text-slate-400" />
              <p className="text-sm font-medium text-slate-700">
                Arraste um arquivo aqui ou clique para selecionar
              </p>
              <p className="text-xs text-slate-400 mt-1">CSV ou XLSX — máx. 10 MB</p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.xlsx,.xls"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) handleFileChange(f)
                  e.target.value = ""
                }}
              />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
          </div>
        )}

        {/* Step: Mapping */}
        {step === "mapping" && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm text-slate-600 bg-slate-50 rounded-lg px-3 py-2">
              <FileSpreadsheet className="w-4 h-4 shrink-0 text-slate-400" />
              <span className="font-medium truncate">{file?.name}</span>
              <span className="text-slate-400 shrink-0">— {parsedRows.length} linhas</span>
              <button onClick={reset} className="ml-auto text-slate-400 hover:text-slate-700">
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
              Mapeie as colunas do arquivo
            </p>

            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {columns.map((col) => (
                <div key={col} className="flex items-center gap-3">
                  <Label className="w-36 shrink-0 truncate font-mono text-xs text-slate-600" title={col}>
                    {col}
                  </Label>
                  <Select
                    value={columnMap[col] ?? "__skip__"}
                    onValueChange={(v) => setColumnMap((prev) => ({ ...prev, [col]: v }))}
                  >
                    <SelectTrigger className="flex-1 h-8 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {FIELD_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>

            {/* Preview */}
            {parsedRows.length > 0 && (
              <div className="rounded-lg border border-slate-200 overflow-hidden text-xs">
                <p className="px-3 py-1.5 bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
                  Prévia (primeiras 3 linhas)
                </p>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr>
                        {columns.slice(0, 5).map((col) => (
                          <th key={col} className="px-3 py-1.5 text-left text-slate-500 font-medium whitespace-nowrap border-b border-slate-100">
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {parsedRows.slice(0, 3).map((row, i) => (
                        <tr key={i} className="border-b border-slate-50 last:border-0">
                          {columns.slice(0, 5).map((col) => (
                            <td key={col} className="px-3 py-1.5 text-slate-700 whitespace-nowrap max-w-[100px] truncate">
                              {String(row[col] ?? "")}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {error && <p className="text-sm text-red-600">{error}</p>}
          </div>
        )}

        {/* Step: Importing */}
        {step === "importing" && (
          <div className="flex flex-col items-center py-10 gap-4">
            <Loader2 className="w-10 h-10 animate-spin text-blue-500" />
            <p className="text-sm text-slate-600">
              Importando {parsedRows.length.toLocaleString("pt-BR")} leads…
            </p>
            <div className="w-full bg-slate-100 rounded-full h-2">
              <div
                className="bg-blue-500 h-2 rounded-full transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {/* Step: Done */}
        {step === "done" && result && (
          <div className="flex flex-col items-center py-8 gap-4 text-center">
            <CheckCircle2 className="w-12 h-12 text-emerald-500" />
            <div>
              <p className="text-lg font-semibold text-slate-900">Importação concluída!</p>
              <div className="flex justify-center gap-8 mt-3">
                <div>
                  <p className="text-2xl font-bold text-emerald-600">
                    {result.imported.toLocaleString("pt-BR")}
                  </p>
                  <p className="text-xs text-slate-500">importados</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-400">
                    {result.skipped.toLocaleString("pt-BR")}
                  </p>
                  <p className="text-xs text-slate-500">atualizados</p>
                </div>
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          {step === "upload" && (
            <Button variant="outline" onClick={handleClose}>Cancelar</Button>
          )}
          {step === "mapping" && (
            <>
              <Button variant="outline" onClick={reset}>
                Trocar arquivo
              </Button>
              <Button onClick={handleImport}>
                <Upload className="w-4 h-4" />
                Importar {parsedRows.length.toLocaleString("pt-BR")} leads
              </Button>
            </>
          )}
          {step === "done" && (
            <Button onClick={handleClose}>Concluir</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

const PAGE_SIZE = 50

export default function LeadsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const q = searchParams.get("q") ?? ""

  const [leads, setLeads] = useState<Lead[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [orgId, setOrgId] = useState("")
  const [search, setSearch] = useState(q)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [importOpen, setImportOpen] = useState(false)
  const [page, setPage] = useState(0)

  const supabase = createClient()

  const fetchLeads = useCallback(
    async (currentOrgId: string, query: string, currentPage: number) => {
      if (!currentOrgId) return
      setLoading(true)
      const from = currentPage * PAGE_SIZE
      const to = from + PAGE_SIZE - 1

      let req = supabase
        .from("leads")
        .select("*", { count: "exact" })
        .eq("org_id", currentOrgId)
        .order("created_at", { ascending: false })
        .range(from, to)

      if (query.trim()) {
        req = req.or(`name.ilike.%${query.trim()}%,phone.ilike.%${query.trim()}%`)
      }

      const { data, count, error } = await req
      if (!error) {
        setLeads((data as Lead[]) ?? [])
        setTotalCount(count ?? 0)
      }
      setLoading(false)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  )

  // Init: resolve org_id then fetch
  useEffect(() => {
    const init = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        router.push("/login")
        return
      }
      const { data: profile } = await supabase
        .from("profiles")
        .select("org_id")
        .eq("id", user.id)
        .single()
      if (profile?.org_id) {
        setOrgId(profile.org_id)
        fetchLeads(profile.org_id, q, 0)
      } else {
        setLoading(false)
      }
    }
    init()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Re-fetch when URL search param changes
  useEffect(() => {
    if (orgId) {
      setPage(0)
      setSelected(new Set())
      fetchLeads(orgId, q, 0)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, orgId])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    const params = new URLSearchParams()
    if (search.trim()) params.set("q", search.trim())
    router.push(`/leads?${params.toString()}`)
  }

  const clearSearch = () => {
    setSearch("")
    router.push("/leads")
  }

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleAll = () => {
    if (selected.size === leads.length) setSelected(new Set())
    else setSelected(new Set(leads.map((l) => l.id)))
  }

  const totalPages = Math.ceil(totalCount / PAGE_SIZE)

  const handlePageChange = (newPage: number) => {
    setPage(newPage)
    fetchLeads(orgId, q, newPage)
    setSelected(new Set())
  }

  return (
    <div>
      <PageHeader title="Leads" description="Gerencie sua base de contatos">
        <Button onClick={() => setImportOpen(true)}>
          <FileSpreadsheet className="w-4 h-4" />
          Importar Planilha
        </Button>
      </PageHeader>

      {/* Top bar */}
      <div className="flex items-center gap-3 mb-6">
        <form onSubmit={handleSearch} className="flex items-center gap-2 flex-1 max-w-md">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            <Input
              className="pl-9"
              placeholder="Buscar por nome ou telefone…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Button type="submit" variant="outline" size="sm">
            Buscar
          </Button>
          {q && (
            <Button type="button" variant="ghost" size="sm" onClick={clearSearch}>
              <X className="w-4 h-4" />
            </Button>
          )}
        </form>

        <div className="ml-auto text-sm text-slate-500 shrink-0">
          {loading ? (
            <span className="flex items-center gap-1.5">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Carregando…
            </span>
          ) : (
            <span>
              <strong className="text-slate-800">{totalCount.toLocaleString("pt-BR")}</strong>{" "}
              lead{totalCount !== 1 ? "s" : ""}
            </span>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {!loading && !leads.length ? (
          <div className="py-20 text-center">
            <Users className="w-12 h-12 mx-auto mb-3 text-slate-300" />
            <p className="text-slate-500 font-medium">
              {q
                ? "Nenhum lead encontrado para esta busca."
                : "Nenhum lead cadastrado ainda."}
            </p>
            {!q && (
              <Button className="mt-4" onClick={() => setImportOpen(true)}>
                <Upload className="w-4 h-4" />
                Importar Planilha
              </Button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="w-10 px-4 py-3 text-left">
                    <Checkbox
                      checked={leads.length > 0 && selected.size === leads.length}
                      onCheckedChange={toggleAll}
                      aria-label="Selecionar todos"
                    />
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    Nome
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    Telefone
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    Campos Extras
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    Última visita
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    Cadastro
                  </th>
                  <th className="w-16 px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {loading
                  ? Array.from({ length: 8 }).map((_, i) => (
                      <tr key={i}>
                        {Array.from({ length: 7 }).map((_, j) => (
                          <td key={j} className="px-4 py-3">
                            <div className="h-4 bg-slate-100 rounded animate-pulse" />
                          </td>
                        ))}
                      </tr>
                    ))
                  : leads.map((lead) => (
                      <tr
                        key={lead.id}
                        className={`hover:bg-slate-50 transition-colors ${
                          selected.has(lead.id) ? "bg-blue-50/60" : ""
                        }`}
                      >
                        <td className="px-4 py-3">
                          <Checkbox
                            checked={selected.has(lead.id)}
                            onCheckedChange={() => toggleSelect(lead.id)}
                            aria-label={`Selecionar ${lead.name ?? lead.phone}`}
                          />
                        </td>
                        <td className="px-4 py-3">
                          <span className="font-medium text-slate-900">
                            {lead.name ?? (
                              <span className="text-slate-400 italic">Sem nome</span>
                            )}
                          </span>
                          {lead.tags?.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {lead.tags.slice(0, 2).map((tag) => (
                                <Badge
                                  key={tag}
                                  variant="secondary"
                                  className="text-xs px-1.5 py-0"
                                >
                                  {tag}
                                </Badge>
                              ))}
                              {lead.tags.length > 2 && (
                                <Badge variant="secondary" className="text-xs px-1.5 py-0">
                                  +{lead.tags.length - 2}
                                </Badge>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-slate-600 font-mono text-xs whitespace-nowrap">
                          {formatPhone(lead.phone)}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1">
                            {Object.entries(lead.custom_fields ?? {})
                              .slice(0, 3)
                              .map(([k, v]) => (
                                <Badge key={k} variant="outline" className="text-xs font-normal">
                                  <span className="text-slate-400 mr-1">{k}:</span>
                                  <span className="text-slate-700 truncate max-w-[80px]">{v}</span>
                                </Badge>
                              ))}
                            {Object.keys(lead.custom_fields ?? {}).length > 3 && (
                              <Badge variant="outline" className="text-xs text-slate-400">
                                +{Object.keys(lead.custom_fields).length - 3}
                              </Badge>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-slate-500 text-xs">
                          {lead.last_service_date ? (
                            formatRelativeDate(lead.last_service_date)
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">
                          {formatDate(lead.created_at)}
                        </td>
                        <td className="px-4 py-3">
                          <Link href={`/leads/${lead.id}`}>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-slate-500 hover:text-slate-900"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </Button>
                          </Link>
                        </td>
                      </tr>
                    ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 bg-slate-50">
            <p className="text-xs text-slate-500">
              Página {page + 1} de {totalPages} —{" "}
              {totalCount.toLocaleString("pt-BR")} leads
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page === 0}
                onClick={() => handlePageChange(page - 1)}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages - 1}
                onClick={() => handlePageChange(page + 1)}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Selection bar */}
      {selected.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-slate-900 text-white rounded-xl px-5 py-3 flex items-center gap-4 shadow-xl z-40">
          <span className="text-sm font-medium">
            {selected.size} selecionado{selected.size !== 1 ? "s" : ""}
          </span>
          <Button
            size="sm"
            variant="ghost"
            className="text-white hover:text-white hover:bg-white/10"
            onClick={() => setSelected(new Set())}
          >
            Limpar seleção
          </Button>
        </div>
      )}

      {/* Import Dialog */}
      {orgId && (
        <LeadImportDialog
          open={importOpen}
          onOpenChange={setImportOpen}
          orgId={orgId}
          onSuccess={() => fetchLeads(orgId, q, page)}
        />
      )}
    </div>
  )
}
