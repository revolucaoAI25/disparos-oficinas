import { createAdminClient } from "@/lib/supabase/admin"
import { NextRequest, NextResponse } from "next/server"

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

  await Promise.allSettled(
    toProcess.map(async (dispatch: any) => {
      const lead = dispatch.leads
      if (!lead) {
        await admin.from("dispatches").update({ status: "failed" }).eq("id", dispatch.id)
        failed++
        return
      }

      // Use the stored payload (already built with variables substituted at creation)
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

          // For recurring cadences: schedule the next dispatch after successful send
          if (dispatch.cadence_id) {
            const { data: cadence } = await admin
              .from("cadences")
              .select("schedule_type, schedule_config, status")
              .eq("id", dispatch.cadence_id)
              .single()

            if (cadence?.schedule_type === "recurring" && cadence.status === "active") {
              const config = cadence.schedule_config as {
                interval_months?: number
                end_date?: string | null
              }
              const intervalMonths = config.interval_months
              const endDate = config.end_date

              if (intervalMonths) {
                const nextScheduled = new Date(dispatch.scheduled_at)
                nextScheduled.setMonth(nextScheduled.getMonth() + intervalMonths)

                const withinEndDate = !endDate || nextScheduled <= new Date(endDate)

                if (withinEndDate) {
                  // Avoid duplicates: check if a future dispatch already exists for this cadence+lead
                  const { data: existingNext } = await admin
                    .from("dispatches")
                    .select("id")
                    .eq("cadence_id", dispatch.cadence_id)
                    .eq("lead_id", dispatch.lead_id)
                    .in("status", ["scheduled", "pending"])
                    .gt("scheduled_at", new Date().toISOString())
                    .limit(1)
                    .maybeSingle()

                  if (!existingNext) {
                    await admin.from("dispatches").insert({
                      org_id: dispatch.org_id,
                      cadence_id: dispatch.cadence_id,
                      lead_id: dispatch.lead_id,
                      webhook_url: dispatch.webhook_url,
                      payload: dispatch.payload,
                      status: "scheduled",
                      scheduled_at: nextScheduled.toISOString(),
                      response_received: false,
                    })
                  }
                }
              }
            }
          }
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
