import crypto from "crypto";
import { Invoice } from "xendit-node/invoice";

export interface XenditPaymentLinkParams {
  apiKey: string;
  externalId: string;
  amount: number;
  payerEmail?: string;
  description: string;
  currency?: string;
  successRedirectUrl?: string;
  failureRedirectUrl?: string;
}

export interface XenditPaymentLinkResult {
  xenditInvoiceId: string;
  paymentLinkUrl: string;
  externalId: string;
  externalResponse: Record<string, unknown>;
}

/**
 * Create a Xendit payment link (invoice) using the provided API key
 */
export async function createXenditPaymentLink(
  params: XenditPaymentLinkParams,
): Promise<XenditPaymentLinkResult> {
  const invoiceApi = new Invoice({ secretKey: params.apiKey });

  const invoice = await invoiceApi.createInvoice({
    data: {
      externalId: params.externalId,
      amount: params.amount,
      payerEmail: params.payerEmail,
      description: params.description,
      currency: params.currency ?? "IDR",
      shouldSendEmail: false,
      successRedirectUrl: params.successRedirectUrl,
      failureRedirectUrl: params.failureRedirectUrl,
    },
  });

  return {
    xenditInvoiceId: invoice.id ?? "",
    paymentLinkUrl: invoice.invoiceUrl,
    externalId: invoice.externalId,
    externalResponse: invoice as unknown as Record<string, unknown>,
  };
}

/**
 * Verify a Xendit webhook callback token
 */
export function verifyXenditWebhook(
  callbackToken: string,
  webhookToken: string,
): boolean {
  if (!callbackToken || !webhookToken) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(callbackToken), Buffer.from(webhookToken));
  } catch (err) {
    // timingSafeEqual throws TypeError when buffers have different lengths —
    // that means tokens don't match, so return false. Re-throw anything unexpected.
    if (err instanceof TypeError) return false;
    throw err;
  }
}
