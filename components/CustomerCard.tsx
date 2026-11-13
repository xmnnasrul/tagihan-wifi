'use client';

import type { CSSProperties } from 'react';
import Link from 'next/link';
import { CalendarDays, ChevronRight, MapPin, UserRound } from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';

export interface CustomerCardData {
  _id: string;
  name: string;
  address: string;
  packageId: { name: string; price: number; speed: string } | null;
  createdAt?: string;
  createdBy?: string;
}

interface CustomerCardProps {
  customer: CustomerCardData;
  href: string;
  status?: { label: string; className?: string };
  className?: string;
  style?: CSSProperties;
}

export function CustomerCard({ customer, href, status, className, style }: CustomerCardProps) {
  const prefersReducedMotion = useReducedMotion();
  const createdAt = customer.createdAt
    ? new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(customer.createdAt))
    : '-';
  const packageDetails = customer.packageId
    ? `${customer.packageId.name} · ${customer.packageId.speed} · ${new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        maximumFractionDigits: 0,
      }).format(customer.packageId.price)}`
    : 'Belum ada paket';

  return (
    <motion.li
      whileHover={prefersReducedMotion ? undefined : { y: -2 }}
      whileTap={prefersReducedMotion ? undefined : { scale: 0.99 }}
      transition={{ duration: 0.16, ease: 'easeOut' }}
    >
      <Link
        href={href}
        className={`group block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${className ?? ''}`}
        style={style}
      >
        <Card className="cursor-pointer border-border/60 transition-colors duration-150 hover:border-primary/40 hover:bg-accent/30">
          <CardContent className="py-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 flex-1 items-start gap-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-sm font-semibold text-primary">
                  {customer.name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-base font-semibold">{customer.name}</p>
                  <div className="mt-1 flex items-start gap-1.5 text-xs text-muted-foreground">
                    <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    <span className="wrap-break-word">{customer.address || 'Alamat belum diisi'}</span>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <CalendarDays className="h-3 w-3" aria-hidden="true" /> {createdAt}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <UserRound className="h-3 w-3" aria-hidden="true" /> {customer.createdBy || 'Admin'}
                    </span>
                    <span>{packageDetails}</span>
                  </div>
                </div>
              </div>
              <div className="flex shrink-0 items-center justify-between gap-3 sm:justify-end">
                {status && <Badge variant="outline" className={status.className}>{status.label}</Badge>}
                <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" aria-hidden="true" />
              </div>
            </div>
          </CardContent>
        </Card>
      </Link>
    </motion.li>
  );
}
