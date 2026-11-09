import type { Cents } from "../money";

export type PayPalMode = "sandbox" | "mock";

export interface OrderInfo {
  id: string;
  status: string;
  amountCents: Cents;
  captureId?: string;
  payerEmail?: string;
}

export interface PayoutItemInput {
  senderItemId: string;
  receiver: string;
  amountCents: Cents;
  note: string;
}

export interface PayoutItemStatus {
  senderItemId: string;
  receiver: string;
  amountCents: Cents;
  status: string;
  transactionId?: string;
  payoutItemId?: string;
}

export interface PayoutBatch {
  batchId: string;
  status: string;
  items: PayoutItemStatus[];
}

export interface InvoiceInput {
  invoicerName: string;
  recipientName: string;
  recipientEmail: string;
  itemName: string;
  amountCents: Cents;
  note: string;
}

export interface InvoiceInfo {
  id: string;
  status: string;
  number?: string;
  payerViewUrl?: string;
}

/** Everything Settle needs from PayPal. The sandbox and mock adapters both implement it. */
export interface PayPalGateway {
  mode: PayPalMode;
  createOrder(input: { amountCents: Cents; description: string; referenceId: string }): Promise<OrderInfo>;
  captureOrder(orderId: string): Promise<OrderInfo>;
  getOrder(orderId: string): Promise<OrderInfo>;
  createPayoutBatch(input: { senderBatchId: string; subject: string; message: string; items: PayoutItemInput[] }): Promise<PayoutBatch>;
  getPayoutBatch(batchId: string): Promise<PayoutBatch>;
  createAndSendInvoice(input: InvoiceInput): Promise<InvoiceInfo>;
  refundCapture(captureId: string): Promise<{ id: string; status: string }>;
}

export class PayPalError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly name_: string = "PAYPAL_ERROR",
    readonly debugId?: string,
  ) {
    super(message);
  }
}
