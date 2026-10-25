const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, apikey, content-type, x-client-info, x-supabase-api-version',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface OrderRow {
  id: string;
  subtotal: string | number;
  shipping_fee: string | number;
  status: string;
  payment_status: string;
  razorpay_order_id: string | null;
  razorpay_payment_id: string | null;
}

interface PaymentRequest {
  orderId?: string;
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  razorpaySignature?: string;
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

function orderIdFrom(body: PaymentRequest): string {
  const orderId = body.orderId;
  if (!orderId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(orderId)) {
    throw new ApiError(400, 'A valid order ID is required.');
  }
  return orderId;
}

function minorUnits(value: string | number): number {
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(String(value));
  if (!match) {
    throw new ApiError(422, 'The order total is invalid.');
  }
  const amount = BigInt(match[1]) * 100n + BigInt((match[2] ?? '').padEnd(2, '0'));
  if (amount <= 0n || amount > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new ApiError(422, 'The order total is outside the supported payment range.');
  }
  return Number(amount);
}

function orderTotal(order: OrderRow): number {
  const total = BigInt(minorUnits(order.subtotal)) + BigInt(minorUnits(order.shipping_fee));
  if (total > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new ApiError(422, 'The order total is outside the supported payment range.');
  }
  return Number(total);
}

class ApiError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

function supabaseHeaders(): Record<string, string> {
  const key = requiredEnvironment('SUPABASE_SERVICE_ROLE_KEY');
  return { apikey: key, Authorization: `Bearer ${key}` };
}

function orderUrl(orderId: string): URL {
  const url = new URL('/rest/v1/orders', requiredEnvironment('SUPABASE_URL'));
  url.searchParams.set('id', `eq.${orderId}`);
  url.searchParams.set(
    'select',
    'id,subtotal,shipping_fee,status,payment_status,razorpay_order_id,razorpay_payment_id',
  );
  return url;
}

async function readOrder(orderId: string): Promise<OrderRow> {
  const response = await fetch(orderUrl(orderId), { headers: supabaseHeaders() });
  if (!response.ok) {
    throw new ApiError(502, 'Could not read the order from Supabase.');
  }
  const rows = (await response.json()) as OrderRow[];
  if (!rows.length) {
    throw new ApiError(404, 'Order not found.');
  }
  return rows[0];
}

async function updateOrder(orderId: string, updates: Record<string, string>): Promise<OrderRow[]> {
  const url = orderUrl(orderId);
  url.searchParams.delete('select');
  url.searchParams.set('payment_status', 'eq.pending');
  url.searchParams.set('status', 'eq.pending');
  const response = await fetch(url, {
    method: 'PATCH',
    headers: {
      ...supabaseHeaders(),
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify(updates),
  });
  if (!response.ok) {
    throw new ApiError(502, 'Could not update the order in Supabase.');
  }
  return (await response.json()) as OrderRow[];
}

function orderStatus(order: OrderRow) {
  const subtotal = Number(order.subtotal);
  const shippingFee = Number(order.shipping_fee);
  return {
    id: order.id,
    status: order.status,
    paymentStatus: order.payment_status,
    subtotal,
    shippingFee,
    total: subtotal + shippingFee,
    paymentId: order.razorpay_payment_id,
  };
}

function razorpayAuthorization(): string {
  const id = requiredEnvironment('RAZORPAY_KEY_ID');
  const secret = requiredEnvironment('RAZORPAY_KEY_SECRET');
  return `Basic ${btoa(`${id}:${secret}`)}`;
}

async function createRazorpayOrder(order: OrderRow): Promise<{ id: string }> {
  const amount = orderTotal(order);
  const response = await fetch('https://api.razorpay.com/v1/orders', {
    method: 'POST',
    headers: {
      Authorization: razorpayAuthorization(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      amount,
      currency: 'INR',
      receipt: order.id,
      notes: { order_id: order.id },
    }),
  });
  if (!response.ok) {
    throw new ApiError(502, 'Razorpay could not create a payment order.');
  }
  return (await response.json()) as { id: string };
}

async function isValidSignature(orderId: string, paymentId: string, signature: string): Promise<boolean> {
  if (!/^[a-f0-9]{64}$/i.test(signature)) {
    return false;
  }
  const secret = requiredEnvironment('RAZORPAY_KEY_SECRET');
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const digest = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(`${orderId}|${paymentId}`),
  );
  const expected = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
  const actualBytes = new TextEncoder().encode(signature.toLowerCase());
  const expectedBytes = new TextEncoder().encode(expected);
  return actualBytes.length === expectedBytes.length
    && actualBytes.every((byte, index) => byte === expectedBytes[index]);
}

async function getRazorpayPayment(paymentId: string): Promise<{
  order_id: string;
  amount: number;
  currency: string;
  status: string;
}> {
  const response = await fetch(
    `https://api.razorpay.com/v1/payments/${encodeURIComponent(paymentId)}`,
    { headers: { Authorization: razorpayAuthorization() } },
  );
  if (!response.ok) {
    throw new ApiError(502, 'Razorpay payment status could not be confirmed.');
  }
  return await response.json();
}

async function captureRazorpayPayment(paymentId: string, amount: number): Promise<{ status: string }> {
  const response = await fetch(
    `https://api.razorpay.com/v1/payments/${encodeURIComponent(paymentId)}/capture`,
    {
      method: 'POST',
      headers: {
        Authorization: razorpayAuthorization(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ amount, currency: 'INR' }),
    },
  );
  if (!response.ok) {
    throw new ApiError(502, 'Razorpay could not capture the authorized payment.');
  }
  return await response.json();
}

export async function handlePaymentRequest(
  request: Request,
  operation: 'create' | 'verify' | 'status',
): Promise<Response> {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed.' }, 405);
  }

  try {
    let body: PaymentRequest;
    try {
      body = (await request.json()) as PaymentRequest;
    } catch {
      throw new ApiError(400, 'A valid JSON request body is required.');
    }
    const id = orderIdFrom(body);
    const order = await readOrder(id);

    if (operation === 'status') {
      return jsonResponse(orderStatus(order));
    }

    if (operation === 'create') {
      if (order.payment_status !== 'pending' || order.status !== 'pending') {
        throw new ApiError(409, 'This order cannot accept payment.');
      }
      let razorpayOrderId = order.razorpay_order_id;
      if (!order.razorpay_order_id) {
        const createdOrder = await createRazorpayOrder(order);
        const updated = await updateOrder(order.id, { razorpay_order_id: createdOrder.id });
        const latest = updated[0] ?? await readOrder(order.id);
        razorpayOrderId = latest.razorpay_order_id;
        if (!razorpayOrderId) {
          throw new ApiError(409, 'The payment order could not be associated with this order.');
        }
      }
      return jsonResponse({
        keyId: requiredEnvironment('RAZORPAY_KEY_ID'),
        razorpayOrderId,
        amount: orderTotal(order),
        currency: 'INR',
      });
    }

    const {
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature,
    } = body;
    if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
      throw new ApiError(400, 'Payment verification data is incomplete.');
    }
    if (razorpayOrderId !== order.razorpay_order_id) {
      throw new ApiError(400, 'Payment order does not match this order.');
    }
    if (!(await isValidSignature(razorpayOrderId, razorpayPaymentId, razorpaySignature))) {
      throw new ApiError(400, 'Payment signature is invalid.');
    }

    let payment = await getRazorpayPayment(razorpayPaymentId);
    if (
      payment.order_id !== razorpayOrderId
      || payment.currency !== 'INR'
      || payment.amount !== orderTotal(order)
    ) {
      throw new ApiError(400, 'Payment details do not match the order.');
    }
    if (payment.status === 'authorized') {
      payment = {
        ...payment,
        ...await captureRazorpayPayment(razorpayPaymentId, orderTotal(order)),
      };
    }
    if (payment.status !== 'captured') {
      throw new ApiError(409, 'Razorpay has not captured this payment.');
    }

    if (order.payment_status === 'paid') {
      if (order.razorpay_payment_id !== razorpayPaymentId) {
        throw new ApiError(409, 'This order has already been paid.');
      }
      return jsonResponse(orderStatus(order));
    }
    if (order.payment_status !== 'pending' || order.status !== 'pending') {
      throw new ApiError(409, 'This order cannot be verified.');
    }

    const updated = await updateOrder(order.id, {
      status: 'confirmed',
      payment_status: 'paid',
      razorpay_payment_id: razorpayPaymentId,
    });
    if (updated.length) {
      return jsonResponse(orderStatus(updated[0]));
    }

    const latest = await readOrder(id);
    if (latest.payment_status === 'paid' && latest.razorpay_payment_id === razorpayPaymentId) {
      return jsonResponse(orderStatus(latest));
    }
    throw new ApiError(409, 'The order status changed during payment verification.');
  } catch (error) {
    if (error instanceof ApiError) {
      return jsonResponse({ error: error.message }, error.status);
    }
    console.error('Payment function failed.', error);
    return jsonResponse({ error: 'Payment service is temporarily unavailable.' }, 500);
  }
}



// npx supabase secrets set RAZORPAY_KEY_ID="rzp_live_Trn0CrmXdsrxJD" RAZORPAY_KEY_SECRET="6XDrOp6FZ3W25XrSzBOz7UAY" --project-ref krrsrzekaxqfmxfbmlnd