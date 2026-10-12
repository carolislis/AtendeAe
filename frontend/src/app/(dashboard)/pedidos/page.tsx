'use client';

import { useEffect, useState } from 'react';
import { api, BackendOfflineError } from '@/lib/api';
import { IconCart, IconCopy, IconTruck, IconMapPin } from '@/components/Icons';

type OrderStatus = 'recebido' | 'preparando' | 'saiu_entrega' | 'entregue' | 'cancelado';

const STATUS_LABELS: Record<OrderStatus, string> = {
  recebido: 'Recebido',
  preparando: 'Preparando',
  saiu_entrega: 'Saiu para entrega',
  entregue: 'Entregue',
  cancelado: 'Cancelado',
};

/** Status que o estabelecimento pode alterar no menu. Entregue só é definido pelo código (cliente/motoqueiro). */
const DASHBOARD_STATUS_OPTIONS: OrderStatus[] = ['recebido', 'preparando', 'saiu_entrega'];

interface OrderItem {
  productId: string;
  name: string;
  price: number;
  quantity: number;
}

interface Order {
  id: string;
  trackingToken?: string;
  status?: OrderStatus;
  cardapioId: string;
  items: OrderItem[];
  customer: { name: string; address: string; phone: string };
  total: number;
  createdAt: string;
  establishmentRating?: number;
  establishmentComment?: string;
  deliveryRating?: number;
  deliveryComment?: string;
}

export default function PedidosPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const load = () => {
    api
      .get<Order[]>('/orders')
      .then((list) => setOrders(Array.isArray(list) ? list : []))
      .catch((e) => {
        if (e instanceof BackendOfflineError) setOffline(true);
        setOrders([]);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const updateStatus = async (orderId: string, status: OrderStatus) => {
    setUpdatingId(orderId);
    try {
      await api.patch(`/orders/${orderId}/status`, { status });
      setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, status } : o)));
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setUpdatingId(null);
    }
  };

  if (loading) return <p className="text-gray-500">Carregando pedidos...</p>;

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <span className="flex w-10 h-10 rounded-xl bg-amber-100 text-amber-600 items-center justify-center">
          <IconCart className="w-5 h-5" />
        </span>
        <h1 className="text-2xl font-bold text-gray-900">Pedidos</h1>
      </div>
      {offline && (
        <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-sm">
          Backend não está rodando. Pedidos aparecem aqui quando o backend estiver ativo.
        </div>
      )}
      {orders.length === 0 && !offline && (
        <p className="text-gray-500">Nenhum pedido ainda.</p>
      )}
      <ul className="space-y-5">
        {orders.map((o) => (
          <li key={o.id} className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <span className="font-mono text-sm text-gray-500">#{o.id}</span>
              <span className="text-sm text-gray-500">
                {new Date(o.createdAt).toLocaleString('pt-BR')}
              </span>
            </div>
            <div className="mb-3 flex flex-wrap items-center gap-3">
              <span
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border ${
                  o.status === 'cancelado'
                    ? 'bg-gray-100 text-gray-700 border-gray-200'
                    : 'bg-primary-50 text-primary-700 border-primary-100'
                }`}
              >
                <IconTruck className="w-3.5 h-3.5" /> {STATUS_LABELS[o.status ?? 'recebido']}
              </span>
              {(o.establishmentRating != null || o.deliveryRating != null) && (
                <span className="text-xs text-amber-600">
                  {o.establishmentRating != null && `Estabelecimento ${'★'.repeat(o.establishmentRating)}${'☆'.repeat(5 - o.establishmentRating)}`}
                  {o.establishmentRating != null && o.deliveryRating != null && ' · '}
                  {o.deliveryRating != null && `Entrega ${'★'.repeat(o.deliveryRating)}${'☆'.repeat(5 - o.deliveryRating)}`}
                </span>
              )}
              {o.status === 'entregue' ? (
                <span className="text-sm text-gray-600">Entregue (confirmado pelo código)</span>
              ) : o.status === 'cancelado' ? (
                <span className="text-sm text-gray-600">Cancelado (pelo cliente)</span>
              ) : (
                <select
                  value={o.status ?? 'recebido'}
                  onChange={(e) => updateStatus(o.id, e.target.value as OrderStatus)}
                  disabled={updatingId === o.id}
                  className="text-sm border border-gray-300 rounded-xl px-3 py-1.5 focus:ring-2 focus:ring-primary-500 focus:border-primary-400"
                >
                  {DASHBOARD_STATUS_OPTIONS.map((s) => (
                    <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                  ))}
                </select>
              )}
              {o.trackingToken && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      const url = typeof window !== 'undefined' ? `${window.location.origin}/r/${o.trackingToken}` : '';
                      if (url) navigator.clipboard?.writeText(url).then(() => alert('Link copiado!'));
                    }}
                    className="text-xs text-primary-600 hover:text-primary-700 font-medium inline-flex items-center gap-1"
                  >
                    <IconCopy className="w-3.5 h-3.5" /> Copiar link de acompanhamento
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const url = typeof window !== 'undefined' ? `${window.location.origin}/e/${o.trackingToken}` : '';
                      if (url) navigator.clipboard?.writeText(url).then(() => alert('Link para o motoqueiro copiado!'));
                    }}
                    className="text-xs text-amber-600 hover:text-amber-700 font-medium inline-flex items-center gap-1"
                  >
                    <IconMapPin className="w-3.5 h-3.5" /> Link para o motoqueiro
                  </button>
                </>
              )}
            </div>
            <div className="mb-3 text-sm">
              <p className="font-semibold text-gray-900">{o.customer.name}</p>
              <p className="text-gray-600">{o.customer.address}</p>
              <p className="text-gray-600">{o.customer.phone}</p>
            </div>
            <ul className="border-t border-gray-100 pt-3 space-y-1 text-sm text-gray-700">
              {o.items.map((i) => (
                <li key={i.productId}>
                  {i.quantity}× {i.name} — R$ {(i.price * i.quantity).toFixed(2).replace('.', ',')}
                </li>
              ))}
            </ul>
            <p className="mt-3 text-right font-bold text-primary-600">
              Total: R$ {o.total.toFixed(2).replace('.', ',')}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
