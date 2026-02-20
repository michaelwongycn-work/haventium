import { Invoice } from "xendit-node/invoice";

export interface XenditPaymentLinkParams {
  apiKey: string;
  externalId: string;
  amount: number;
  payerEmail?: string;
  description: string;
  currency?: string;
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
  return callbackToken === webhookToken;
}
