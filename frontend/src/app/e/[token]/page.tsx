'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { api } from '@/lib/api';
import { IconMapPin, IconTruck, IconExternalLink } from '@/components/Icons';

type OrderStatus = 'recebido' | 'preparando' | 'saiu_entrega' | 'entregue' | 'cancelado';

const STATUS_LABELS: Record<OrderStatus, string> = {
  recebido: 'Recebido',
  preparando: 'Preparando',
  saiu_entrega: 'Saiu para entrega',
  entregue: 'Entregue',
  cancelado: 'Cancelado',
};

interface DeliveryData {
  id: string;
  customerName: string;
  address: string;
  phone: string;
  status: OrderStatus;
  statusLabel: string;
}

function buildMapsUrl(address: string): string {
  const encoded = encodeURIComponent(address.trim());
  return `https://www.google.com/maps/search/?api=1&query=${encoded}`;
}

function EntregaContent() {
  const params = useParams();
  const token = (params?.token as string) ?? '';
  const [data, setData] = useState<DeliveryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [code, setCode] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [confirmError, setConfirmError] = useState('');

  const fetchDelivery = useCallback(() => {
    if (!token) return;
    api
      .get<DeliveryData>(`/orders/delivery/${encodeURIComponent(token)}`)
      .then((d) => {
        setData(d);
        setError(false);
        setConfirmError('');
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(() => {
    if (!token) {
      setError(true);
      setLoading(false);
      return;
    }
    fetchDelivery();
  }, [token, fetchDelivery]);

  const handleConfirmDelivery = async () => {
    const codeTrim = code.trim();
    if (!codeTrim) {
      setConfirmError('Peça o código ao cliente.');
      return;
    }
    setConfirming(true);
    setConfirmError('');
    try {
      await api.post(`/orders/delivery/${encodeURIComponent(token)}/confirm`, { code: codeTrim });
      fetchDelivery();
      setCode('');
    } catch (e: unknown) {
      const msg = (e as Error)?.message ?? '';
      try {
        const parsed = typeof msg === 'string' && msg.startsWith('{') ? JSON.parse(msg) : null;
        setConfirmError(parsed?.message || msg || 'Código incorreto. Peça o código ao cliente.');
      } catch {
        setConfirmError(msg || 'Código incorreto. Peça o código ao cliente.');
      }
    } finally {
      setConfirming(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen min-h-[100dvh] bg-gray-50 flex items-center justify-center p-4">
        <p className="text-gray-500">Carregando...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen min-h-[100dvh] bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-8 text-center shadow-sm max-w-sm">
          <p className="font-semibold text-gray-800">Pedido não encontrado</p>
          <p className="text-sm text-gray-500 mt-2">Verifique o link.</p>
        </div>
      </div>
    );
  }

  const mapsUrl = buildMapsUrl(data.address);

  if (data.status === 'cancelado') {
    return (
      <div className="min-h-screen min-h-[100dvh] bg-gray-50 pb-8">
        <header className="bg-white shadow-sm">
          <div className="max-w-lg mx-auto px-4 py-4 flex items-center gap-3">
            <span className="flex w-10 h-10 rounded-xl bg-amber-100 text-amber-600 items-center justify-center">
              <IconTruck className="w-5 h-5" />
            </span>
            <div>
              <h1 className="text-lg font-bold text-gray-900">Entrega</h1>
              <p className="text-sm text-gray-500">Pedido #{data.id}</p>
            </div>
          </div>
        </header>
        <main className="max-w-lg mx-auto px-4 pt-6">
          <div className="bg-gray-100 rounded-2xl border border-gray-200 p-6 text-center">
            <p className="font-semibold text-gray-800">Pedido cancelado</p>
            <p className="text-sm text-gray-600 mt-1">Este pedido foi cancelado pelo cliente.</p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen min-h-[100dvh] bg-gray-50 pb-8">
      <header className="bg-white shadow-sm">
        <div className="max-w-lg mx-auto px-4 py-4 flex items-center gap-3">
          <span className="flex w-10 h-10 rounded-xl bg-amber-100 text-amber-600 items-center justify-center">
            <IconTruck className="w-5 h-5" />
          </span>
          <div>
            <h1 className="text-lg font-bold text-gray-900">Entrega</h1>
            <p className="text-sm text-gray-500">Pedido #{data.id}</p>
          </div>
        </div>
      </header>
      <main className="max-w-lg mx-auto px-4 pt-6 space-y-4">
        <div className="bg-white rounded-2xl shadow-md border border-gray-100 overflow-hidden">
          <div className="p-4 border-b border-gray-100">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-primary-50 text-primary-700 border border-primary-100">
              {data.statusLabel}
            </span>
          </div>
          <div className="p-5">
            <p className="text-sm font-medium text-gray-500 mb-1">Cliente</p>
            <p className="text-lg font-bold text-gray-900">{data.customerName}</p>
            <p className="text-sm text-gray-500 mt-3 mb-1">Endereço</p>
            <p className="text-gray-800 whitespace-pre-wrap">{data.address}</p>
            <p className="text-sm text-gray-500 mt-3 mb-1">Telefone</p>
            <a
              href={`https://wa.me/55${data.phone.replace(/\D/g, '')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary-600 font-medium hover:underline"
            >
              {data.phone}
            </a>
          </div>
        </div>

        <a
          href={mapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-3 w-full py-4 px-5 rounded-2xl bg-primary-600 text-white font-semibold shadow-md hover:bg-primary-700 active:scale-[0.98] transition-all"
        >
          <IconMapPin className="w-6 h-6" />
          <span>Abrir no Google Maps</span>
          <IconExternalLink className="w-5 h-5 opacity-80" />
        </a>

        {data.status !== 'entregue' && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 border-l-4 border-l-amber-500">
            <h2 className="font-semibold text-gray-900 mb-1">Confirmar entrega</h2>
            <p className="text-sm text-gray-500 mb-3">
              Peça o código de confirmação ao cliente e digite abaixo.
            </p>
            <div className="flex flex-wrap gap-2 items-center">
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                placeholder="Código do cliente"
                value={code}
                onChange={(e) => { setCode(e.target.value.replace(/\D/g, '')); setConfirmError(''); }}
                className="flex-1 min-w-[120px] px-3 py-2 border border-gray-300 rounded-xl text-center font-mono text-lg"
              />
              <button
                type="button"
                onClick={handleConfirmDelivery}
                disabled={confirming || !code.trim()}
                className="px-4 py-2 rounded-xl bg-amber-600 text-white font-medium hover:bg-amber-700 disabled:opacity-50"
              >
                {confirming ? 'Confirmando...' : 'Confirmar entrega'}
              </button>
            </div>
            {confirmError && <p className="mt-2 text-sm text-red-600">{confirmError}</p>}
          </div>
        )}

        {data.status === 'entregue' && (
          <div className="bg-primary-50 rounded-2xl border border-primary-200 p-4 text-center">
            <p className="font-semibold text-primary-800">Entrega já confirmada</p>
          </div>
        )}

        <p className="text-center text-sm text-gray-500">
          O link abre o destino no aplicativo Maps ou no navegador.
        </p>
      </main>
    </div>
  );
}

export default function EntregaPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <p className="text-gray-500">Carregando...</p>
        </div>
      }
    >
      <EntregaContent />
    </Suspense>
  );
}
