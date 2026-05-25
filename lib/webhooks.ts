import { buildWebhookPayload } from './utils'
import { Lead, Cadence } from '@/types'

export interface WebhookResult {
  success: boolean
  status?: number
  error?: string
}

export async function sendWebhook(
  webhookUrl: string,
  payload: Record<string, unknown>
): Promise<WebhookResult> {
  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })

    return {
      success: response.ok,
      status: response.status,
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido',
    }
  }
}

export async function sendCadenceDispatch(
  cadence: Cadence,
  lead: Lead
): Promise<WebhookResult> {
  const payload = buildWebhookPayload(cadence.webhook_body_template, {
    name: lead.name,
    phone: lead.phone,
    custom_fields: lead.custom_fields,
  })

  return sendWebhook(cadence.webhook_url, payload)
}
