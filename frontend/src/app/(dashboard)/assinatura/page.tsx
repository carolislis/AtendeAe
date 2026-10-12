'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { api, BackendOfflineError } from '@/lib/api';
import { IconCreditCard, IconCheck } from '@/components/Icons';

interface BillingStatus {
  trialEndsAt: string;
  subscriptionEndsAt: string | null;
  plan: string;
  canUsePlatform: boolean;
  daysLeftInTrial: number;
  subscriptionActive: boolean;
}

export default function AssinaturaPage() {
  const [status, setStatus] = useState<BillingStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [subscribing, setSubscribing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    setError('');
    api
      .get<BillingStatus>('/billing/status')
      .then(setStatus)
      .catch((e) => {
        if (e instanceof BackendOfflineError) setError('Servidor offline.');
        else setError((e as Error).message);
        setStatus(null);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleSubscribe = async () => {
    setSubscribing(true);
    setError('');
    try {
      const next = await api.post<BillingStatus>('/billing/subscribe', {});
      setStatus(next);
    } catch (e) {
      setError((e as Error).message || 'Não foi possível ativar a assinatura.');
    } finally {
      setSubscribing(false);
    }
  };

  if (loading) return <p className="text-gray-500">Carregando...</p>;

  const trialEndDate = status?.trialEndsAt ? new Date(status.trialEndsAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' }) : '';
  const subscriptionEndDate = status?.subscriptionEndsAt ? new Date(status.subscriptionEndsAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' }) : '';

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <span className="flex w-10 h-10 rounded-xl bg-violet-100 text-violet-600 items-center justify-center">
          <IconCreditCard className="w-5 h-5" />
        </span>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Assinatura</h1>
          <p className="text-sm text-gray-500">Gerencie seu plano e período de teste.</p>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-800 text-sm">
          {error}
        </div>
      )}

      {status && (
        <div className="space-y-6 max-w-xl">
          {/* Status atual */}
          <section className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Status atual</h2>
            {status.subscriptionActive ? (
              <div className="flex items-center gap-3 p-4 rounded-xl bg-green-50 border border-green-200">
                <IconCheck className="w-6 h-6 text-green-600 flex-shrink-0" />
                <div>
                  <p className="font-medium text-green-800">Assinatura ativa</p>
                  <p className="text-sm text-green-700">Válida até {subscriptionEndDate}</p>
                </div>
              </div>
            ) : status.daysLeftInTrial > 0 ? (
              <div className="p-4 rounded-xl bg-amber-50 border border-amber-200">
                <p className="font-medium text-amber-800">Período de teste</p>
                <p className="text-sm text-amber-700 mt-1">
                  Você tem <strong>{status.daysLeftInTrial} {status.daysLeftInTrial === 1 ? 'dia' : 'dias'}</strong> restantes.
                  O teste termina em {trialEndDate}.
                </p>
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-red-50 border border-red-200">
                <p className="font-medium text-red-800">Acesso encerrado</p>
                <p className="text-sm text-red-700 mt-1">
                  Seu período de teste acabou em {trialEndDate}. Assine o plano para continuar usando a plataforma.
                </p>
              </div>
            )}
          </section>

          {/* Plano mensal */}
          <section className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Plano mensal</h2>
            <p className="text-gray-600 text-sm mb-4">
              Acesso completo ao cardápio digital, pedidos, bot WhatsApp e motoboys.
            </p>
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-bold text-gray-900">R$ 49</span>
                <span className="text-gray-500">/mês</span>
              </div>
              {!status.subscriptionActive && (
                <button
                  type="button"
                  onClick={handleSubscribe}
                  disabled={subscribing}
                  className="px-5 py-2.5 bg-primary-600 text-white rounded-xl font-medium hover:bg-primary-700 disabled:opacity-50"
                >
                  {subscribing ? 'Ativando…' : 'Assinar por 30 dias (demonstração)'}
                </button>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-4">
              Em breve: pagamento por PIX ou cartão. Por enquanto você pode ativar 30 dias de demonstração acima.
            </p>
          </section>

          {status.canUsePlatform && (
            <p className="text-sm text-gray-600">
              <Link href="/" className="text-primary-600 hover:underline">Voltar ao início</Link>
            </p>
          )}
        </div>
      )}
    </div>
  );
}
