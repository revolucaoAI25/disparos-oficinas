import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

interface LeadInput {
  phone: string
  name?: string
  custom_fields?: Record<string, string>
  [key: string]: unknown
}

interface ImportRequestBody {
  leads: LeadInput[]
  org_id: string
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: "Não autorizado." }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("org_id, role")
      .eq("id", user.id)
      .single()

    if (!profile?.org_id) {
      return NextResponse.json({ error: "Perfil sem organização associada." }, { status: 403 })
    }

    const body: ImportRequestBody = await req.json()
    const { leads, org_id } = body

    if (!org_id) {
      return NextResponse.json({ error: "org_id é obrigatório." }, { status: 400 })
    }

    if (profile.role !== "admin" && profile.org_id !== org_id) {
      return NextResponse.json({ error: "Acesso negado a esta organização." }, { status: 403 })
    }

    if (!Array.isArray(leads) || leads.length === 0) {
      return NextResponse.json({ error: "Nenhum lead enviado." }, { status: 400 })
    }

    // Normaliza e valida os leads recebidos
    const reservedKeys = new Set(["phone", "name", "custom_fields", "org_id"])
    const validLeads: Array<{
      phone: string
      name: string | null
      custom_fields: Record<string, string>
    }> = []

    for (const raw of leads) {
      const rawPhone = String(raw.phone ?? "").trim()
      if (!rawPhone) continue

      const normalized = rawPhone.startsWith("+")
        ? "+" + rawPhone.slice(1).replace(/\D/g, "")
        : rawPhone.replace(/\D/g, "")

      if (normalized.replace(/\D/g, "").length < 8) continue

      const custom_fields: Record<string, string> = {}
      if (raw.custom_fields && typeof raw.custom_fields === "object") {
        for (const [k, v] of Object.entries(raw.custom_fields)) {
          if (k && v != null) custom_fields[k] = String(v)
        }
      }
      for (const [k, v] of Object.entries(raw)) {
        if (!reservedKeys.has(k) && v != null && v !== "") {
          custom_fields[k] = String(v)
        }
      }

      validLeads.push({
        phone: normalized,
        name: raw.name ? String(raw.name).trim() || null : null,
        custom_fields,
      })
    }

    if (validLeads.length === 0) {
      return NextResponse.json(
        { error: "Nenhum lead válido encontrado. Verifique os números de telefone.", imported: 0, skipped: leads.length },
        { status: 422 }
      )
    }

    // Busca telefones que já existem nesta org
    const phones = validLeads.map(l => l.phone)
    const { data: existing } = await supabase
      .from("leads")
      .select("id, phone")
      .eq("org_id", org_id)
      .in("phone", phones)

    const existingByPhone = new Map((existing ?? []).map((r: { id: string; phone: string }) => [r.phone, r.id]))

    const toInsert = validLeads.filter(l => !existingByPhone.has(l.phone))
    const toUpdate = validLeads.filter(l => existingByPhone.has(l.phone))

    let imported = 0
    let updated = 0
    const BATCH = 100

    // Insere novos leads em lotes
    for (let i = 0; i < toInsert.length; i += BATCH) {
      const batch = toInsert.slice(i, i + BATCH).map(l => ({ ...l, org_id }))
      const { error, data } = await supabase.from("leads").insert(batch).select("id")
      if (error) {
        return NextResponse.json({ error: `Erro ao inserir leads: ${error.message}` }, { status: 500 })
      }
      imported += data?.length ?? batch.length
    }

    // Atualiza leads existentes em lotes
    for (let i = 0; i < toUpdate.length; i += BATCH) {
      const batch = toUpdate.slice(i, i + BATCH)
      await Promise.all(
        batch.map(l => {
          const id = existingByPhone.get(l.phone)!
          return supabase
            .from("leads")
            .update({ name: l.name, custom_fields: l.custom_fields, updated_at: new Date().toISOString() })
            .eq("id", id)
        })
      )
      updated += batch.length
    }

    const skipped = leads.length - validLeads.length

    return NextResponse.json({ imported, skipped: skipped + updated, updated }, { status: 200 })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro interno do servidor."
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
