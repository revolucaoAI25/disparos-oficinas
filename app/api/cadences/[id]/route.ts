import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"
import { CadenceStatus } from "@/types"

const ALLOWED_STATUSES: CadenceStatus[] = ["draft", "active", "paused", "completed"]

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("org_id")
      .eq("id", user.id)
      .single()

    if (!profile?.org_id) {
      return NextResponse.json(
        { error: "Usuário não pertence a uma organização" },
        { status: 403 }
      )
    }

    const orgId: string = profile.org_id

    // Verify the cadence belongs to this org
    const { data: existing } = await supabase
      .from("cadences")
      .select("id, status")
      .eq("id", id)
      .eq("org_id", orgId)
      .single()

    if (!existing) {
      return NextResponse.json({ error: "Cadência não encontrada" }, { status: 404 })
    }

    const body = await req.json()

    const {
      name,
      status,
      webhook_url,
      webhook_body_template,
      schedule_type,
      schedule_config,
      target_filter,
      target_lead_ids,
      service_id,
    } = body

    // Build update patch — only include defined fields
    const patch: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    }

    if (name !== undefined) {
      if (!name?.trim()) {
        return NextResponse.json({ error: "Nome não pode ser vazio" }, { status: 400 })
      }
      patch.name = name.trim()
    }

    if (status !== undefined) {
      if (!ALLOWED_STATUSES.includes(status)) {
        return NextResponse.json({ error: "Status inválido" }, { status: 400 })
      }
      patch.status = status
    }

    if (webhook_url !== undefined) {
      if (!webhook_url?.trim()) {
        return NextResponse.json(
          { error: "URL do webhook não pode ser vazia" },
          { status: 400 }
        )
      }
      try {
        new URL(webhook_url)
      } catch {
        return NextResponse.json(
          { error: "URL do webhook é inválida" },
          { status: 400 }
        )
      }
      patch.webhook_url = webhook_url.trim()
    }

    if (webhook_body_template !== undefined) {
      patch.webhook_body_template = webhook_body_template
    }

    if (schedule_type !== undefined) {
      if (!["once", "recurring"].includes(schedule_type)) {
        return NextResponse.json(
          { error: "Tipo de agendamento inválido" },
          { status: 400 }
        )
      }
      patch.schedule_type = schedule_type
    }

    if (schedule_config !== undefined) {
      patch.schedule_config = schedule_config
    }

    if (target_filter !== undefined) {
      patch.target_filter = target_filter
    }

    if (target_lead_ids !== undefined) {
      patch.target_lead_ids = target_lead_ids
    }

    if (service_id !== undefined) {
      if (service_id !== null) {
        const { data: svc } = await supabase
          .from("services")
          .select("id")
          .eq("id", service_id)
          .eq("org_id", orgId)
          .single()
        if (!svc) {
          return NextResponse.json(
            { error: "Serviço não encontrado" },
            { status: 400 }
          )
        }
      }
      patch.service_id = service_id
    }

    if (Object.keys(patch).length === 1) {
      // Only updated_at — nothing to update
      return NextResponse.json({ error: "Nenhum campo para atualizar" }, { status: 400 })
    }

    const { data: cadence, error: updateError } = await supabase
      .from("cadences")
      .update(patch)
      .eq("id", id)
      .eq("org_id", orgId)
      .select("*, services(name)")
      .single()

    if (updateError || !cadence) {
      console.error("Error updating cadence:", updateError)
      return NextResponse.json(
        { error: "Erro ao atualizar cadência" },
        { status: 500 }
      )
    }

    return NextResponse.json({ cadence })
  } catch (error) {
    console.error("PATCH /api/cadences/[id] error:", error)
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 })
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("org_id")
      .eq("id", user.id)
      .single()

    if (!profile?.org_id) {
      return NextResponse.json(
        { error: "Usuário não pertence a uma organização" },
        { status: 403 }
      )
    }

    const orgId: string = profile.org_id

    // Verify ownership
    const { data: existing } = await supabase
      .from("cadences")
      .select("id, name")
      .eq("id", id)
      .eq("org_id", orgId)
      .single()

    if (!existing) {
      return NextResponse.json({ error: "Cadência não encontrada" }, { status: 404 })
    }

    // Delete dispatches first (if cascade is not set up at DB level)
    const { error: dispatchDeleteError } = await supabase
      .from("dispatches")
      .delete()
      .eq("cadence_id", id)
      .eq("org_id", orgId)

    if (dispatchDeleteError) {
      console.error("Error deleting dispatches:", dispatchDeleteError)
      return NextResponse.json(
        { error: "Erro ao excluir disparos da cadência" },
        { status: 500 }
      )
    }

    const { error: deleteError } = await supabase
      .from("cadences")
      .delete()
      .eq("id", id)
      .eq("org_id", orgId)

    if (deleteError) {
      console.error("Error deleting cadence:", deleteError)
      return NextResponse.json(
        { error: "Erro ao excluir cadência" },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, id })
  } catch (error) {
    console.error("DELETE /api/cadences/[id] error:", error)
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 })
  }
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("org_id")
      .eq("id", user.id)
      .single()

    if (!profile?.org_id) {
      return NextResponse.json(
        { error: "Usuário não pertence a uma organização" },
        { status: 403 }
      )
    }

    const { data: cadence, error } = await supabase
      .from("cadences")
      .select("*, services(name, description)")
      .eq("id", id)
      .eq("org_id", profile.org_id)
      .single()

    if (error || !cadence) {
      return NextResponse.json({ error: "Cadência não encontrada" }, { status: 404 })
    }

    return NextResponse.json({ cadence })
  } catch (error) {
    console.error("GET /api/cadences/[id] error:", error)
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 })
  }
}
