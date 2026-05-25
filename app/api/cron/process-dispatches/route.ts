import { createAdminClient } from "@/lib/supabase/admin"
import { NextRequest, NextResponse } from "next/server"
import { buildWebhookPayload } from "@/lib/utils"

export const maxDuration = 300 // 5 minutes

export async function GET(req: NextRequest) {
  // Verify cron secret
  const authHeader = req.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const admin = createAdminClient()

  // Get all scheduled dispatches that are due
  const { data: scheduledDispatches } = await admin
    .from("dispatches")
    .select("*, leads(name, phone, custom_fields)")
    .eq("status", "scheduled")
    .lte("scheduled_at", new Date().toISOString())
    .limit(100)

  // Get pending dispatches
  const { data: pendingDispatches } = await admin
    .from("dispatches")
    .select("*, leads(name, phone, custom_fields)")
    .eq("status", "pending")
    .limit(100)

  const toProcess = [...(scheduledDispatches ?? []), ...(pendingDispatches ?? [])]

  if (!toProcess.length) {
    return NextResponse.json({ processed: 0, message: "Nenhum disparo pendente" })
  }

  let processed = 0
  let failed = 0

  const results = await Promise.allSettled(
    toProcess.map(async (dispatch: any) => {
      const lead = dispatch.leads
      if (!lead) {
        await admin.from("dispatches").update({ status: "failed" }).eq("id", dispatch.id)
        failed++
        return
      }

      const payload = buildWebhookPayload(dispatch.payload, {
        name: lead.name,
        phone: lead.phone,
        custom_fields: lead.custom_fields ?? {},
      })

      // Actually use stored payload (already built when dispatch was created)
      const finalPayload = dispatch.payload

      try {
        const resp = await fetch(dispatch.webhook_url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(finalPayload),
          signal: AbortSignal.timeout(10000),
        })

        const status = resp.ok ? "sent" : "failed"
        await admin.from("dispatches").update({
          status,
          sent_at: new Date().toISOString(),
        }).eq("id", dispatch.id)

        if (resp.ok) {
          await admin.from("leads").update({
            last_contact_date: new Date().toISOString(),
          }).eq("id", dispatch.lead_id)
          processed++
        } else {
          failed++
        }
      } catch {
        await admin.from("dispatches").update({ status: "failed" }).eq("id", dispatch.id)
        failed++
      }
    })
  )

  return NextResponse.json({
    processed,
    failed,
    total: toProcess.length,
  })
}
