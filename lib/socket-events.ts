export interface PaymentReceivedEvent {
  customerName: string;
  amount: number;
  month: string;
  year: number;
  method: 'Cash' | 'TF' | null;
  recordedBy: string;
  receivedAt: string;
}

export async function publishPaymentReceived(data: PaymentReceivedEvent): Promise<void> {
  const socketServerUrl = process.env.SOCKET_SERVER_URL;
  const publishSecret = process.env.SOCKET_PUBLISH_SECRET;
  if (!socketServerUrl || !publishSecret) return;

  try {
    const response = await fetch(new URL('/internal/events', socketServerUrl), {
      method: 'POST',
      headers: {
        authorization: `Bearer ${publishSecret}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ event: 'payment.received', data }),
      signal: AbortSignal.timeout(2000),
    });

    if (!response.ok) {
      console.error('Socket server menolak event payment.received:', response.status);
    }
  } catch {
    console.error('Event payment.received tidak terkirim ke socket server');
  }
}