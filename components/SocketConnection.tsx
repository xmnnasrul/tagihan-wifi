'use client';

import { useEffect } from 'react';
import { io } from 'socket.io-client';
import { toast } from 'sonner';

interface PaymentReceivedEvent {
  customerName: string;
  amount: number;
  month: string;
  year: number;
}

export default function SocketConnection() {
  useEffect(() => {
    const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL;
    if (!socketUrl) return;

    const socket = io(socketUrl, {
      autoConnect: false,
      auth: (callback) => {
        void fetch('/api/auth/socket-ticket', {
          method: 'POST',
          cache: 'no-store',
        })
          .then(async (response) => {
            if (!response.ok) throw new Error('Gagal membuat tiket socket');

            const result = await response.json() as { ticket?: unknown };
            if (typeof result.ticket !== 'string') throw new Error('Tiket socket tidak valid');

            callback({ ticket: result.ticket });
          })
          .catch(() => callback({}));
      },
    });

    socket.on('payment.received', (event: PaymentReceivedEvent) => {
      const amount = new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        maximumFractionDigits: 0,
      }).format(event.amount);

      toast.success(`Pembayaran diterima: ${event.customerName}`, {
        description: `${event.month} ${event.year} · ${amount}`,
      });
    });

    socket.on('disconnect', (reason) => {
      if (reason === 'io server disconnect') socket.connect();
    });
    socket.connect();

    return () => {
      socket.disconnect();
    };
  }, []);

  return null;
}