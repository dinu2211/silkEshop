import { handlePaymentRequest } from '../_shared/payments.ts';

Deno.serve((request) => handlePaymentRequest(request, 'status'));
