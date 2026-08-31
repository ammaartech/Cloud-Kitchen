import { serverEnv } from '@/lib/env';
import { adminClient } from '@/lib/supabase/admin';

/**
 * Notification abstraction (PRD 15).
 *
 * The governing rule: **a notification failure must never break an order.**
 * Core flows enqueue a row inside their own transaction and return
 * immediately; this module drains that outbox separately. If WhatsApp is down,
 * subscriptions still activate and tickets still reach the kitchen.
 *
 * The provider and the exact notification matrix are chosen later, so the
 * default here logs rather than sends -- which is a working, honest default
 * rather than a stub that pretends to deliver.
 */

export type NotificationChannel = 'whatsapp' | 'sms' | 'email';

export interface OutboundNotification {
  id: string;
  channel: NotificationChannel;
  to: string;
  body: string;
}

export interface SendResult {
  sent: boolean;
  providerMessageId?: string;
  error?: string;
  /** False for a permanent failure -- a bad number should not be retried. */
  retryable?: boolean;
}

export interface NotificationTransport {
  readonly id: string;
  send(notification: OutboundNotification): Promise<SendResult>;
}

/** Development default: records what would have been sent. */
class ConsoleTransport implements NotificationTransport {
  readonly id = 'console';

  async send(notification: OutboundNotification): Promise<SendResult> {
    console.info(
      `[notification:${notification.channel}] -> ${notification.to}\n${notification.body}`,
    );
    return { sent: true, providerMessageId: `console-${notification.id}` };
  }
}

class TwilioTransport implements NotificationTransport {
  readonly id = 'twilio';

  async send(notification: OutboundNotification): Promise<SendResult> {
    const env = serverEnv();

    if (!env.TWILIO_ACCOUNT_SID || !env.TWILIO_AUTH_TOKEN || !env.TWILIO_WHATSAPP_FROM) {
      return { sent: false, error: 'Twilio credentials are not configured', retryable: false };
    }

    const to =
      notification.channel === 'whatsapp'
        ? `whatsapp:${notification.to}`
        : notification.to;

    const from =
      notification.channel === 'whatsapp'
        ? `whatsapp:${env.TWILIO_WHATSAPP_FROM}`
        : env.TWILIO_WHATSAPP_FROM;

    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/Messages.json`,
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${Buffer.from(
            `${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`,
          ).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({ To: to, From: from, Body: notification.body }),
      },
    );

    if (!response.ok) {
      const detail = await response.text();
      return {
        sent: false,
        error: `Twilio responded ${response.status}: ${detail.slice(0, 200)}`,
        // 4xx means the request itself is wrong; retrying will not fix it.
        retryable: response.status >= 500,
      };
    }

    const message = (await response.json()) as { sid: string };
    return { sent: true, providerMessageId: message.sid };
  }
}

export function notificationTransport(): NotificationTransport {
  const env = serverEnv();
  return env.NOTIFICATION_PROVIDER === 'twilio' ? new TwilioTransport() : new ConsoleTransport();
}

/**
 * Renders a template. Placeholders are `{{name}}`; an unknown placeholder is
 * left visible rather than silently blanked, so a broken template is obvious
 * in testing instead of shipping a message with a hole in it.
 */
export function renderTemplate(template: string, payload: Record<string, unknown>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key: string) => {
    const value = payload[key];
    return value === undefined || value === null ? match : String(value);
  });
}

/**
 * Drains the outbox.
 *
 * Called by the scheduled job. Each notification is attempted independently:
 * one bad number cannot stall the queue behind it, and a retryable failure is
 * backed off exponentially until max_attempts, then parked in dead_letter for
 * a human to look at.
 */
export async function dispatchQueuedNotifications(limit = 50): Promise<{
  attempted: number;
  sent: number;
  failed: number;
}> {
  const db = adminClient();
  const transport = notificationTransport();

  const { data: queued, error } = await db
    .from('notifications')
    .select('id, channel, to_address, payload, rendered_body, attempts, max_attempts, template_code')
    .in('status', ['queued', 'failed'])
    .lte('next_attempt_at', new Date().toISOString())
    .order('created_at', { ascending: true })
    .limit(limit);

  if (error || !queued?.length) {
    return { attempted: 0, sent: 0, failed: 0 };
  }

  const templates = new Map<string, string>();
  const codes = [...new Set(queued.map((n) => n.template_code).filter(Boolean))] as string[];

  if (codes.length) {
    const { data: rows } = await db
      .from('notification_templates')
      .select('code, body_template')
      .in('code', codes);

    for (const row of rows ?? []) templates.set(row.code, row.body_template);
  }

  let sent = 0;
  let failed = 0;

  for (const item of queued) {
    const body =
      item.rendered_body ??
      renderTemplate(
        templates.get(item.template_code ?? '') ?? '',
        (item.payload ?? {}) as Record<string, unknown>,
      );

    await db.from('notifications').update({ status: 'sending' }).eq('id', item.id);

    let result: SendResult;
    try {
      result = await transport.send({
        id: item.id,
        channel: item.channel,
        to: item.to_address,
        body,
      });
    } catch (cause) {
      result = {
        sent: false,
        error: cause instanceof Error ? cause.message : 'Transport threw',
        retryable: true,
      };
    }

    const attempts = item.attempts + 1;

    if (result.sent) {
      sent += 1;
      await db
        .from('notifications')
        .update({
          status: 'sent',
          attempts,
          sent_at: new Date().toISOString(),
          rendered_body: body,
          provider: transport.id,
          provider_message_id: result.providerMessageId,
          last_error: null,
        })
        .eq('id', item.id);
    } else {
      failed += 1;
      const exhausted = attempts >= item.max_attempts || result.retryable === false;

      await db
        .from('notifications')
        .update({
          status: exhausted ? 'dead_letter' : 'failed',
          attempts,
          rendered_body: body,
          last_error: result.error ?? 'Unknown error',
          // Exponential backoff, capped so a long outage does not push the
          // next attempt days away.
          next_attempt_at: new Date(
            Date.now() + Math.min(2 ** attempts, 60) * 60_000,
          ).toISOString(),
        })
        .eq('id', item.id);
    }

    await db.from('notification_events').insert({
      notification_id: item.id,
      event_type: result.sent ? 'sent' : 'failed',
      payload: { transport: transport.id, error: result.error ?? null },
    });
  }

  return { attempted: queued.length, sent, failed };
}
