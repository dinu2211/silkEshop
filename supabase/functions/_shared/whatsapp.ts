interface OrderNotificationRecord {
  id: string;
  phone: string;
  whatsapp_opt_in: boolean;
  status: string;
}

export type OrderConfirmationResult = 'sent' | 'not_opted_in';

function graphErrorDetails(body: unknown): string | null {
  if (typeof body !== 'object' || body === null || !('error' in body)) {
    return null;
  }
  const error = body.error;
  if (
    typeof error !== 'object' ||
    error === null ||
    !('message' in error) ||
    typeof error.message !== 'string'
  ) {
    return null;
  }

  const codes: string[] = [];
  if ('code' in error && typeof error.code === 'number') {
    codes.push(`code ${error.code}`);
  }
  if ('error_subcode' in error && typeof error.error_subcode === 'number') {
    codes.push(`subcode ${error.error_subcode}`);
  }
  return [...codes, error.message].join(': ');
}

function requiredEnvironment(name: string): string {
  const value = Deno.env.get(name);
  if (!value) {
    throw new Error(`Missing required function environment variable: ${name}`);
  }
  return value;
}

function serviceHeaders(): Record<string, string> {
  const key = requiredEnvironment('SUPABASE_SERVICE_ROLE_KEY');
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
  };
}

function recipientNumber(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (/^[6-9]\d{9}$/.test(digits)) {
    return `91${digits}`;
  }
  if (/^91[6-9]\d{9}$/.test(digits)) {
    return digits;
  }
  throw new Error('The customer phone number is not a valid Indian mobile number.');
}

async function readNotificationRecord(orderId: string): Promise<OrderNotificationRecord | null> {
  const url = new URL('/rest/v1/orders', requiredEnvironment('SUPABASE_URL'));
  url.searchParams.set('id', `eq.${orderId}`);
  url.searchParams.set('select', 'id,phone,whatsapp_opt_in,status');
  const response = await fetch(url, { headers: serviceHeaders() });
  if (!response.ok) {
    throw new Error('The confirmed order could not be loaded for notification.');
  }
  const rows: unknown = await response.json();
  return Array.isArray(rows) ? (rows[0] as OrderNotificationRecord | undefined) ?? null : null;
}

export async function sendOrderConfirmation(
  orderId: string,
): Promise<OrderConfirmationResult> {
  const order = await readNotificationRecord(orderId);
  if (!order || order.status !== 'confirmed') {
    throw new Error('The order is no longer confirmed.');
  }
  if (!order.whatsapp_opt_in) {
    return 'not_opted_in';
  }

  const apiVersion = requiredEnvironment('WHATSAPP_API_VERSION');
  if (!/^v\d+\.\d+$/.test(apiVersion)) {
    throw new Error('WHATSAPP_API_VERSION must use the Meta version format, such as v25.0.');
  }
  const phoneNumberId = requiredEnvironment('WHATSAPP_PHONE_NUMBER_ID');
  const accessToken = requiredEnvironment('WHATSAPP_ACCESS_TOKEN');
  const templateName = requiredEnvironment('WHATSAPP_ORDER_CONFIRMED_TEMPLATE');
  const languageCode = requiredEnvironment('WHATSAPP_TEMPLATE_LANGUAGE');
  const components =
    templateName === 'hello_world'
      ? undefined
      : [
          {
            type: 'body',
            parameters: [{ type: 'text', text: order.id }],
          },
        ];
  const url = new URL(
    `/${apiVersion}/${encodeURIComponent(phoneNumberId)}/messages`,
    'https://graph.facebook.com',
  );
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: recipientNumber(order.phone),
      type: 'template',
      template: {
        name: templateName,
        language: { code: languageCode },
        ...(components ? { components } : {}),
      },
    }),
  });
  if (!response.ok) {
    const errorBody: unknown = await response.json().catch(() => null);
    const details = graphErrorDetails(errorBody);
    throw new Error(
      `WhatsApp Cloud API rejected the message (HTTP ${response.status})${details ? `: ${details}` : '.'}`,
    );
  }

  return 'sent';
}
