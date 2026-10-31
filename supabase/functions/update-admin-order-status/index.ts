import { sendOrderConfirmation } from '../_shared/whatsapp.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, apikey, content-type, x-client-info, x-supabase-api-version',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const allowedStatuses = [
  'confirmed',
  'processing',
  'shipped',
  'out_for_delivery',
  'fulfilled',
  'cancelled',
];

interface StatusRequest {
  orderId?: string;
  status?: string;
  sessionToken?: string;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
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

function validRequest(body: unknown): body is Required<StatusRequest> {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return false;
  }
  const request = body as StatusRequest;
  return Boolean(
    request.orderId &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        request.orderId,
      ) &&
      request.status &&
      allowedStatuses.includes(request.status) &&
      request.sessionToken &&
      /^[0-9a-f]{64}$/i.test(request.sessionToken),
  );
}

async function updateStatus(body: Required<StatusRequest>): Promise<Response> {
  const url = new URL('/rest/v1/rpc/update_admin_order_status', requiredEnvironment('SUPABASE_URL'));
  const response = await fetch(url, {
    method: 'POST',
    headers: serviceHeaders(),
    body: JSON.stringify({
      order_id_input: body.orderId,
      next_status_input: body.status,
      session_token_input: body.sessionToken,
    }),
  });
  if (!response.ok) {
    const result = await response.json().catch(() => null);
    const message =
      result && typeof result.message === 'string'
        ? result.message
        : 'The order status could not be updated.';
    return jsonResponse({ error: message }, response.status);
  }

  const updatedStatus = await response.json();
  if (updatedStatus !== body.status) {
    return jsonResponse({ error: 'The order status update was not confirmed.' }, 502);
  }

  return jsonResponse({ status: body.status, whatsappSent: false });
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed.' }, 405);
  }

  const body: unknown = await request.json().catch(() => ({}));
  if (!validRequest(body)) {
    return jsonResponse({ error: 'A valid order, status, and admin session are required.' }, 400);
  }

  const updateResponse = await updateStatus(body);
  if (!updateResponse.ok || body.status !== 'confirmed') {
    return updateResponse;
  }

  try {
    const result = await sendOrderConfirmation(body.orderId);
    if (result === 'not_opted_in') {
      return jsonResponse({
        status: body.status,
        whatsappSent: false,
        whatsappSkipReason: 'customer_not_opted_in',
      });
    }

    return jsonResponse({ status: body.status, whatsappSent: true });
  } catch (error) {
    console.error('WhatsApp order confirmation could not be sent.', error);
    return jsonResponse({
      status: body.status,
      whatsappSent: false,
      whatsappSkipReason: 'delivery_failed',
    });
  }
});