import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"
import { buildWebhookPayload } from "@/lib/utils"

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 })
  }

  const body = await req.json()
  const {
    org_id,
    webhook_url,
    webhook_body_template,
    target_lead_ids,
    schedule_type,
    scheduled_at,
    service_id,
    cadence_id,
  } = body

  if (!org_id || !webhook_url || !webhook_body_template) {
    return NextResponse.json({ error: "Campos obrigatórios faltando" }, { status: 400 })
  }

  // Verify user has access to this org
  const { data: profile } = await supabase
    .from("profiles")
    .select("org_id, role")
    .eq("id", user.id)
    .single()

  if (profile?.org_id !== org_id && profile?.role !== "admin") {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 })
  }

  // Get target leads
  let targetLeads: { id: string; name: string | null; phone: string; custom_fields: Record<string, string> }[] = []

  if (target_lead_ids && target_lead_ids.length > 0) {
    const { data } = await supabase
      .from("leads")
      .select("id, name, phone, custom_fields")
      .eq("org_id", org_id)
      .in("id", target_lead_ids)

    targetLeads = data ?? []
  } else {
    const { data } = await supabase
      .from("leads")
      .select("id, name, phone, custom_fields")
      .eq("org_id", org_id)

    targetLeads = data ?? []
  }

  if (targetLeads.length === 0) {
    return NextResponse.json({ error: "Nenhum lead encontrado", created: 0 })
  }

  const scheduledTime = schedule_type === "later" && scheduled_at
    ? new Date(scheduled_at).toISOString()
    : new Date().toISOString()

  const dispatchStatus = schedule_type === "later" ? "scheduled" : "pending"

  // Build dispatch records
  const dispatches = targetLeads.map(lead => {
    const payload = buildWebhookPayload(webhook_body_template, {
      name: lead.name,
      phone: lead.phone,
      custom_fields: lead.custom_fields,
    })

    return {
      org_id,
      cadence_id: cadence_id ?? null,
      lead_id: lead.id,
      webhook_url,
      payload,
      status: dispatchStatus,
      scheduled_at: scheduledTime,
    }
  })

  const { data: inserted, error } = await supabase
    .from("dispatches")
    .insert(dispatches)
    .select("id")

  if (error) {
    return NextResponse.json({ error: "Erro ao criar disparos: " + error.message }, { status: 500 })
  }

  // If "now", process immediately (send webhooks)
  if (dispatchStatus === "pending" && inserted) {
    const sendPromises = inserted.map(async (d: { id: string }, index: number) => {
      const lead = targetLeads[index]
      const payload = buildWebhookPayload(webhook_body_template, {
        name: lead.name,
        phone: lead.phone,
        custom_fields: lead.custom_fields,
      })

      try {
        const resp = await fetch(webhook_url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(10000),
        })

        await supabase
          .from("dispatches")
          .update({
            status: resp.ok ? "sent" : "failed",
            sent_at: new Date().toISOString(),
          })
          .eq("id", d.id)

        // Update lead's last_contact_date
        await supabase
          .from("leads")
          .update({ last_contact_date: new Date().toISOString() })
          .eq("id", lead.id)

      } catch {
        await supabase
          .from("dispatches")
          .update({ status: "failed" })
          .eq("id", d.id)
      }
    })

    await Promise.allSettled(sendPromises)
  }

  return NextResponse.json({
    created: inserted?.length ?? 0,
    status: dispatchStatus,
  })
}
