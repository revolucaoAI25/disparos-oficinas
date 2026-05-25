import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

// ─── Helpers ──────────────────────────────────────────────────────────────────

type RouteContext = { params: Promise<{ id: string }> }

async function getLeadAndVerifyAccess(leadId: string) {
  const supabase = await createClient()

  // Verify auth
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { error: "Não autorizado.", status: 401, supabase: null, lead: null }
  }

  // Get profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("org_id, role")
    .eq("id", user.id)
    .single()

  if (!profile?.org_id) {
    return { error: "Perfil sem organização.", status: 403, supabase: null, lead: null }
  }

  // Fetch lead
  const { data: lead, error: leadError } = await supabase
    .from("leads")
    .select("id, org_id")
    .eq("id", leadId)
    .single()

  if (leadError || !lead) {
    return { error: "Lead não encontrado.", status: 404, supabase: null, lead: null }
  }

  // Verify org access
  if (profile.role !== "admin" && lead.org_id !== profile.org_id) {
    return { error: "Acesso negado.", status: 403, supabase: null, lead: null }
  }

  return { error: null, status: 200, supabase, lead }
}

// ─── PATCH /api/leads/[id] ────────────────────────────────────────────────────

export async function PATCH(req: NextRequest, context: RouteContext) {
  const { id } = await context.params

  const { error, status, supabase, lead } = await getLeadAndVerifyAccess(id)
  if (error || !supabase || !lead) {
    return NextResponse.json({ error }, { status })
  }

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Corpo da requisição inválido." }, { status: 400 })
  }

  // Build update payload — only allow known fields
  const updatePayload: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  }

  if ("name" in body) {
    const name = body.name
    updatePayload.name = name === null || name === "" ? null : String(name).trim()
  }

  if ("notes" in body) {
    const notes = body.notes
    updatePayload.notes = notes === null || notes === "" ? null : String(notes).trim()
  }

  if ("tags" in body) {
    if (!Array.isArray(body.tags)) {
      return NextResponse.json({ error: "tags deve ser um array." }, { status: 400 })
    }
    updatePayload.tags = (body.tags as unknown[]).map((t) => String(t).trim()).filter(Boolean)
  }

  if ("custom_fields" in body) {
    if (typeof body.custom_fields !== "object" || body.custom_fields === null || Array.isArray(body.custom_fields)) {
      return NextResponse.json({ error: "custom_fields deve ser um objeto." }, { status: 400 })
    }
    const sanitized: Record<string, string> = {}
    for (const [k, v] of Object.entries(body.custom_fields as Record<string, unknown>)) {
      if (k.trim()) sanitized[k.trim()] = String(v ?? "")
    }
    updatePayload.custom_fields = sanitized
  }

  if ("email" in body) {
    updatePayload.email = body.email ? String(body.email).trim() : null
  }

  if ("last_service_date" in body) {
    updatePayload.last_service_date = body.last_service_date ?? null
  }

  if ("last_contact_date" in body) {
    updatePayload.last_contact_date = body.last_contact_date ?? null
  }

  // Must have at least one field to update (beyond updated_at)
  if (Object.keys(updatePayload).length <= 1) {
    return NextResponse.json(
      { error: "Nenhum campo válido para atualizar." },
      { status: 400 }
    )
  }

  const { data, error: updateError } = await supabase
    .from("leads")
    .update(updatePayload)
    .eq("id", id)
    .select()
    .single()

  if (updateError) {
    console.error("[leads/[id] PATCH]", updateError)
    return NextResponse.json(
      { error: `Erro ao atualizar lead: ${updateError.message}` },
      { status: 500 }
    )
  }

  return NextResponse.json(data, { status: 200 })
}

// ─── DELETE /api/leads/[id] ───────────────────────────────────────────────────

export async function DELETE(_req: NextRequest, context: RouteContext) {
  const { id } = await context.params

  const { error, status, supabase, lead } = await getLeadAndVerifyAccess(id)
  if (error || !supabase || !lead) {
    return NextResponse.json({ error }, { status })
  }

  // Delete related records first (activities, dispatches referencing this lead
  // may have ON DELETE CASCADE in the DB, but we handle explicitly for safety)
  const { error: activitiesError } = await supabase
    .from("lead_activities")
    .delete()
    .eq("lead_id", id)

  if (activitiesError) {
    console.error("[leads/[id] DELETE] activities:", activitiesError)
    return NextResponse.json(
      { error: "Erro ao remover atividades do lead." },
      { status: 500 }
    )
  }

  const { error: deleteError } = await supabase
    .from("leads")
    .delete()
    .eq("id", id)

  if (deleteError) {
    console.error("[leads/[id] DELETE]", deleteError)
    return NextResponse.json(
      { error: `Erro ao deletar lead: ${deleteError.message}` },
      { status: 500 }
    )
  }

  return NextResponse.json({ success: true }, { status: 200 })
}
