import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"
import { ScheduleType } from "@/types"

interface FilterRule {
  field: string
  operator: string
  value: string
}

interface TargetFilter {
  rules?: FilterRule[]
}

function computeScheduledAt(
  scheduleType: ScheduleType,
  scheduleConfig: Record<string, unknown>
): string {
  if (scheduleType === "once") {
    const date = scheduleConfig.date as string | undefined
    const time = scheduleConfig.time as string | undefined
    if (date && time) {
      return new Date(`${date}T${time}:00`).toISOString()
    }
    if (date) {
      return new Date(`${date}T09:00:00`).toISOString()
    }
  } else {
    // recurring: first dispatch is at start_date
    const startDate = scheduleConfig.start_date as string | undefined
    if (startDate) {
      return new Date(`${startDate}T09:00:00`).toISOString()
    }
  }
  return new Date().toISOString()
}

export async function POST(req: NextRequest) {
  try {
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

    const body = await req.json()

    // Validate required fields
    const {
      name,
      webhook_url,
      webhook_body_template,
      schedule_type,
      schedule_config,
      target_filter,
      target_lead_ids,
      service_id,
    } = body

    if (!name?.trim()) {
      return NextResponse.json({ error: "Nome é obrigatório" }, { status: 400 })
    }
    if (!webhook_url?.trim()) {
      return NextResponse.json(
        { error: "URL do webhook é obrigatória" },
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
    if (!schedule_type || !["once", "recurring"].includes(schedule_type)) {
      return NextResponse.json(
        { error: "Tipo de agendamento inválido" },
        { status: 400 }
      )
    }
    if (!schedule_config || typeof schedule_config !== "object") {
      return NextResponse.json(
        { error: "Configuração de agendamento inválida" },
        { status: 400 }
      )
    }

    if (schedule_type === "once") {
      if (!schedule_config.date) {
        return NextResponse.json(
          { error: "Data do agendamento é obrigatória" },
          { status: 400 }
        )
      }
    } else {
      if (!schedule_config.interval_months) {
        return NextResponse.json(
          { error: "Intervalo de repetição é obrigatório" },
          { status: 400 }
        )
      }
      if (!schedule_config.start_date) {
        return NextResponse.json(
          { error: "Data de início é obrigatória" },
          { status: 400 }
        )
      }
    }

    // Validate service_id belongs to org if provided
    if (service_id) {
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

    // Insert cadence
    const { data: cadence, error: insertError } = await supabase
      .from("cadences")
      .insert({
        org_id: orgId,
        name: name.trim(),
        service_id: service_id ?? null,
        webhook_url: webhook_url.trim(),
        webhook_body_template: webhook_body_template ?? {},
        status: "draft",
        schedule_type,
        schedule_config,
        target_filter: target_filter ?? {},
        target_lead_ids: target_lead_ids ?? null,
      })
      .select()
      .single()

    if (insertError || !cadence) {
      console.error("Error inserting cadence:", insertError)
      return NextResponse.json(
        { error: "Erro ao criar cadência" },
        { status: 500 }
      )
    }

    // Determine leads to create dispatches for
    const scheduledAt = computeScheduledAt(
      schedule_type as ScheduleType,
      schedule_config
    )

    let leadsToDispatch: { id: string; phone: string; name: string | null }[] = []

    if (Array.isArray(target_lead_ids) && target_lead_ids.length > 0) {
      // Explicit lead IDs
      const { data: leads } = await supabase
        .from("leads")
        .select("id, phone, name")
        .eq("org_id", orgId)
        .in("id", target_lead_ids)

      leadsToDispatch = leads ?? []
    } else if (
      target_filter &&
      typeof target_filter === "object" &&
      (target_filter as TargetFilter).rules?.length
    ) {
      // Build filter query
      let query = supabase
        .from("leads")
        .select("id, phone, name")
        .eq("org_id", orgId)

      for (const rule of (target_filter as TargetFilter).rules!) {
        const { field, operator, value } = rule
        if (!field || !operator || !value) continue

        switch (operator) {
          case "eq":
            query = query.eq(field, value)
            break
          case "neq":
            query = query.neq(field, value)
            break
          case "ilike":
            query = query.ilike(field, `%${value}%`)
            break
          case "gt":
            query = query.gt(field, value)
            break
          case "lt":
            query = query.lt(field, value)
            break
        }
      }

      const { data: leads } = await query
      leadsToDispatch = leads ?? []
    } else {
      // All leads
      const { data: leads } = await supabase
        .from("leads")
        .select("id, phone, name")
        .eq("org_id", orgId)

      leadsToDispatch = leads ?? []
    }

    // Create dispatch records in batches of 500
    if (leadsToDispatch.length > 0) {
      const BATCH_SIZE = 500
      for (let i = 0; i < leadsToDispatch.length; i += BATCH_SIZE) {
        const batch = leadsToDispatch.slice(i, i + BATCH_SIZE)

        const dispatches = batch.map((lead) => {
          // Build payload for this lead
          const payload: Record<string, string> = {}
          const template = (webhook_body_template ?? {}) as Record<string, string>
          for (const [k, v] of Object.entries(template)) {
            const filled = (v as string).replace(/\{\{(\w+)\}\}/g, (_, varName) => {
              const data: Record<string, string> = {
                nome: lead.name ?? "",
                name: lead.name ?? "",
                telefone: lead.phone,
                phone: lead.phone,
              }
              return data[varName] ?? ""
            })
            payload[k] = filled
          }

          return {
            org_id: orgId,
            cadence_id: cadence.id,
            lead_id: lead.id,
            webhook_url: webhook_url.trim(),
            payload,
            status: "scheduled" as const,
            scheduled_at: scheduledAt,
            response_received: false,
          }
        })

        const { error: dispatchError } = await supabase
          .from("dispatches")
          .insert(dispatches)

        if (dispatchError) {
          console.error("Error creating dispatches batch:", dispatchError)
        }
      }
    }

    return NextResponse.json(
      {
        cadence,
        dispatch_count: leadsToDispatch.length,
      },
      { status: 201 }
    )
  } catch (error) {
    console.error("POST /api/cadences error:", error)
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  try {
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

    const { searchParams } = new URL(req.url)
    const status = searchParams.get("status")

    let query = supabase
      .from("cadences")
      .select("*, services(name)")
      .eq("org_id", profile.org_id)
      .order("created_at", { ascending: false })

    if (status) {
      query = query.eq("status", status)
    }

    const { data: cadences, error } = await query

    if (error) {
      return NextResponse.json({ error: "Erro ao buscar cadências" }, { status: 500 })
    }

    return NextResponse.json({ cadences })
  } catch (error) {
    console.error("GET /api/cadences error:", error)
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 })
  }
}
