'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { api } from '@/lib/api';

interface BillingStatus {
  canUsePlatform: boolean;
  daysLeftInTrial: number;
  subscriptionActive: boolean;
  subscriptionEndsAt: string | null;
}

export function BillingBanner() {
  const pathname = usePathname();
  const [status, setStatus] = useState<BillingStatus | null>(null);

  useEffect(() => {
    api.get<BillingStatus>('/billing/status').then(setStatus).catch(() => setStatus(null));
  }, []);

  if (!status?.canUsePlatform) return null;
  if (pathname === '/assinatura') return null;

  if (status.subscriptionActive && status.subscriptionEndsAt) {
    const end = new Date(status.subscriptionEndsAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
    return (
      <div className="mb-4 p-3 rounded-xl bg-green-50 border border-green-200 text-green-800 text-sm flex items-center justify-between flex-wrap gap-2">
        <span>Assinatura ativa até {end}.</span>
        <Link href="/assinatura" className="font-medium text-green-700 hover:underline">Ver plano</Link>
      </div>
    );
  }

  if (status.daysLeftInTrial > 0) {
    const isLow = status.daysLeftInTrial <= 3;
    return (
      <div className={`mb-4 p-3 rounded-xl border text-sm flex items-center justify-between flex-wrap gap-2 ${isLow ? 'bg-amber-50 border-amber-200 text-amber-800' : 'bg-primary-50 border-primary-200 text-primary-800'}`}>
        <span>
          {status.daysLeftInTrial === 1
            ? 'Último dia do período de teste.'
            : `${status.daysLeftInTrial} dias restantes no período de teste.`}
        </span>
        <Link href="/assinatura" className="font-medium hover:underline">
          {isLow ? 'Assinar agora' : 'Ver plano'}
        </Link>
      </div>
    );
  }

  return null;
}
