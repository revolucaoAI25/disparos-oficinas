import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

// ─── Types ────────────────────────────────────────────────────────────────────

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

// ─── POST /api/leads/import ───────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()

    // Verify authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Não autorizado." }, { status: 401 })
    }

    // Verify user belongs to org
    const { data: profile } = await supabase
      .from("profiles")
      .select("org_id, role")
      .eq("id", user.id)
      .single()

    if (!profile?.org_id) {
      return NextResponse.json(
        { error: "Perfil sem organização associada." },
        { status: 403 }
      )
    }

    // Parse body
    const body: ImportRequestBody = await req.json()
    const { leads, org_id } = body

    if (!org_id) {
      return NextResponse.json({ error: "org_id é obrigatório." }, { status: 400 })
    }

    // Admins can import for any org; clients must match their own org
    if (profile.role !== "admin" && profile.org_id !== org_id) {
      return NextResponse.json({ error: "Acesso negado a esta organização." }, { status: 403 })
    }

    if (!Array.isArray(leads) || leads.length === 0) {
      return NextResponse.json({ error: "Nenhum lead enviado." }, { status: 400 })
    }

    // Validate + normalize leads
    const validLeads: Array<{
      org_id: string
      phone: string
      name: string | null
      custom_fields: Record<string, string>
    }> = []

    const skippedPhones: string[] = []

    for (const raw of leads) {
      const phone = String(raw.phone ?? "")
        .replace(/\s/g, "")
        .trim()

      if (!phone) {
        skippedPhones.push("(vazio)")
        continue
      }

      // Normalize phone: keep only digits and leading +
      const normalizedPhone = phone.startsWith("+")
        ? "+" + phone.slice(1).replace(/\D/g, "")
        : phone.replace(/\D/g, "")

      if (normalizedPhone.replace(/\D/g, "").length < 8) {
        skippedPhones.push(phone)
        continue
      }

      const custom_fields: Record<string, string> = {}

      // Merge raw.custom_fields
      if (raw.custom_fields && typeof raw.custom_fields === "object") {
        for (const [k, v] of Object.entries(raw.custom_fields)) {
          if (k && v !== null && v !== undefined) {
            custom_fields[k] = String(v)
          }
        }
      }

      // Any extra keys (not phone/name/custom_fields) become custom fields
      const reservedKeys = new Set(["phone", "name", "custom_fields", "org_id"])
      for (const [k, v] of Object.entries(raw)) {
        if (!reservedKeys.has(k) && v !== null && v !== undefined && v !== "") {
          custom_fields[k] = String(v)
        }
      }

      validLeads.push({
        org_id,
        phone: normalizedPhone,
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

    // Upsert by (phone, org_id)
    // Supabase upsert with onConflict on the unique constraint
    const BATCH_SIZE = 100
    let upserted = 0

    for (let i = 0; i < validLeads.length; i += BATCH_SIZE) {
      const batch = validLeads.slice(i, i + BATCH_SIZE)

      const { error: upsertError, data } = await supabase
        .from("leads")
        .upsert(batch, {
          onConflict: "phone,org_id",
          ignoreDuplicates: false, // update existing records
        })
        .select("id")

      if (upsertError) {
        console.error("[leads/import] upsert error:", upsertError)
        return NextResponse.json(
          { error: `Erro ao importar leads: ${upsertError.message}` },
          { status: 500 }
        )
      }

      upserted += data?.length ?? batch.length
    }

    const imported = upserted
    const skipped = leads.length - validLeads.length

    return NextResponse.json({ imported, skipped }, { status: 200 })
  } catch (err: unknown) {
    console.error("[leads/import]", err)
    const message = err instanceof Error ? err.message : "Erro interno do servidor."
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
