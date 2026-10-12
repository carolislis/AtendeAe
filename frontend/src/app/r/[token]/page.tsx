'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { api } from '@/lib/api';
import { IconTruck, IconStar } from '@/components/Icons';

type OrderStatus = 'recebido' | 'preparando' | 'saiu_entrega' | 'entregue' | 'cancelado';

const STATUS_LABELS: Record<OrderStatus, string> = {
  recebido: 'Pedido recebido',
  preparando: 'Preparando',
  saiu_entrega: 'Saiu para entrega',
  entregue: 'Entregue',
  cancelado: 'Cancelado',
};

const STATUS_ORDER: OrderStatus[] = ['recebido', 'preparando', 'saiu_entrega', 'entregue'];

const CANCEL_WINDOW_MS = 5 * 60 * 1000; // 5 minutos

interface TrackingData {
  id: string;
  status: OrderStatus;
  statusLabel: string;
  deliveryCode: string;
  createdAt: string;
  items: { name: string; quantity: number; subtotal: number }[];
  total: number;
  customerName: string;
  establishmentRating?: number;
  establishmentComment?: string;
  deliveryRating?: number;
  deliveryComment?: string;
}

function AcompanharContent() {
  const params = useParams();
  const token = (params?.token as string) ?? '';
  const [data, setData] = useState<TrackingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState('');
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [rateEstablishment, setRateEstablishment] = useState(0);
  const [rateDelivery, setRateDelivery] = useState(0);
  const [commentEstablishment, setCommentEstablishment] = useState('');
  const [commentDelivery, setCommentDelivery] = useState('');
  const [ratingSent, setRatingSent] = useState(false);
  const [sendingRating, setSendingRating] = useState(false);

  const fetchTracking = useCallback(() => {
    if (!token) return;
    api
      .get<TrackingData>(`/orders/track/${encodeURIComponent(token)}`)
      .then((d) => {
        setData(d);
        setError(false);
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
    fetchTracking();
  }, [token, fetchTracking]);

  // Atualização automática quando o estabelecimento altera o status
  useEffect(() => {
    if (!token || !data || error) return;
    const interval = setInterval(fetchTracking, 10000); // a cada 10 segundos
    return () => clearInterval(interval);
  }, [token, data?.id, error, fetchTracking]);

  // Preencher estrelas quando já existir avaliação
  useEffect(() => {
    if (data?.establishmentRating != null) setRateEstablishment(data.establishmentRating);
    if (data?.deliveryRating != null) setRateDelivery(data.deliveryRating);
  }, [data?.establishmentRating, data?.deliveryRating]);

  const canCancel =
    data &&
    data.status !== 'cancelado' &&
    data.status !== 'entregue' &&
    Date.now() - new Date(data.createdAt).getTime() < CANCEL_WINDOW_MS;

  const canRate = data?.status === 'entregue';
  const alreadyRatedEstablishment = canRate && data.establishmentRating != null;
  const alreadyRatedDelivery = canRate && data.deliveryRating != null;
  const canSubmitRating = canRate && (rateEstablishment >= 1 || rateDelivery >= 1) && !sendingRating;

  const handleSubmitRating = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmitRating) return;
    setSendingRating(true);
    try {
      await api.post(`/orders/rate/${encodeURIComponent(token)}`, {
        ...(rateEstablishment >= 1 && { establishmentRating: rateEstablishment, establishmentComment: commentEstablishment.trim() || undefined }),
        ...(rateDelivery >= 1 && { deliveryRating: rateDelivery, deliveryComment: commentDelivery.trim() || undefined }),
      });
      setRatingSent(true);
      fetchTracking();
    } catch (err) {
      alert((err as Error).message || 'Não foi possível enviar a avaliação.');
    } finally {
      setSendingRating(false);
    }
  };

  const handleCancel = async () => {
    if (!canCancel) return;
    setCancelling(true);
    setCancelError('');
    try {
      await api.post(`/orders/cancel/${encodeURIComponent(token)}`, {});
      setShowCancelConfirm(false);
      fetchTracking();
    } catch (e: unknown) {
      const msg = (e as Error)?.message ?? '';
      try {
        const parsed = typeof msg === 'string' && msg.startsWith('{') ? JSON.parse(msg) : null;
        setCancelError(parsed?.message || msg || 'Não foi possível cancelar.');
      } catch {
        setCancelError(msg || 'Não foi possível cancelar.');
      }
    } finally {
      setCancelling(false);
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
          <p className="text-sm text-gray-500 mt-2">Verifique o link ou peça um novo ao estabelecimento.</p>
        </div>
      </div>
    );
  }

  const currentIndex = data.status === 'cancelado' ? -1 : STATUS_ORDER.indexOf(data.status);

  return (
    <div className="min-h-screen min-h-[100dvh] bg-gray-50 pb-8">
      <header className="bg-white shadow-sm">
        <div className="max-w-lg mx-auto px-4 py-4 flex items-center gap-3">
          <span className="flex w-10 h-10 rounded-xl bg-primary-100 text-primary-600 items-center justify-center">
            <IconTruck className="w-5 h-5" />
          </span>
          <div>
            <h1 className="text-lg font-bold text-gray-900">Acompanhar pedido</h1>
            <p className="text-sm text-gray-500">#{data.id}</p>
          </div>
        </div>
      </header>
      <main className="max-w-lg mx-auto px-4 pt-6">
        {data.status === 'cancelado' ? (
          <div className="bg-gray-100 rounded-2xl border border-gray-200 p-6 text-center">
            <p className="font-semibold text-gray-800">Pedido cancelado</p>
            <p className="text-sm text-gray-600 mt-1">Este pedido foi cancelado.</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-md border border-gray-100 overflow-hidden">
            <div className="p-5 border-b border-gray-100 bg-gradient-to-r from-primary-50/50 to-white">
              <p className="text-sm text-gray-500">Status atual</p>
              <p className="text-lg font-bold text-primary-600 mt-0.5">{data.statusLabel}</p>
            </div>
            {/* Stepper */}
            <div className="px-4 py-6">
              <div className="flex relative">
                <div className="absolute top-4 left-0 right-0 h-0.5 bg-gray-200" />
                <div
                  className="absolute top-4 left-0 h-0.5 bg-primary-500 transition-all duration-300"
                  style={{ width: `${(currentIndex / (STATUS_ORDER.length - 1)) * 100}%` }}
                />
                {STATUS_ORDER.map((s, i) => {
                  const done = i <= currentIndex;
                  return (
                    <div key={s} className="relative z-10 flex-1 flex flex-col items-center">
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${done ? 'bg-primary-600 text-white' : 'bg-gray-200 text-gray-500'}`}
                      >
                        {done ? (i === currentIndex ? (i + 1) : '✓') : i + 1}
                      </div>
                      <span className={`text-xs mt-2 text-center font-medium max-w-[4rem] ${done ? 'text-gray-900' : 'text-gray-400'}`}>
                        {STATUS_LABELS[s]}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {canCancel && (
          <div className="mt-6 bg-white rounded-2xl shadow-sm border border-gray-100 p-4 border-l-4 border-l-amber-500">
            <p className="text-sm text-gray-600 mb-3">Você pode cancelar o pedido nos primeiros 5 minutos.</p>
            <button
              type="button"
              onClick={() => setShowCancelConfirm(true)}
              disabled={cancelling}
              className="w-full py-3 rounded-xl bg-red-600 text-white font-medium hover:bg-red-700 disabled:opacity-50"
            >
              Cancelar pedido
            </button>
            {cancelError && <p className="mt-2 text-sm text-red-600">{cancelError}</p>}
          </div>
        )}

        {/* Popup de confirmação de cancelamento */}
        {showCancelConfirm && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
            onClick={() => !cancelling && setShowCancelConfirm(false)}
          >
            <div
              className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-5"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="font-bold text-gray-900 text-lg">Cancelar pedido?</h3>
              <p className="text-gray-600 mt-2 text-sm">
                Tem certeza? Esta ação não pode ser desfeita.
              </p>
              <div className="mt-5 flex gap-3">
                <button
                  type="button"
                  onClick={() => !cancelling && setShowCancelConfirm(false)}
                  disabled={cancelling}
                  className="flex-1 py-2.5 rounded-xl border border-gray-300 text-gray-700 font-medium hover:bg-gray-50 disabled:opacity-50"
                >
                  Voltar
                </button>
                <button
                  type="button"
                  onClick={handleCancel}
                  disabled={cancelling}
                  className="flex-1 py-2.5 rounded-xl bg-red-600 text-white font-medium hover:bg-red-700 disabled:opacity-50"
                >
                  {cancelling ? 'Cancelando...' : 'Sim, cancelar'}
                </button>
              </div>
            </div>
          </div>
        )}

        {data.status !== 'entregue' && data.status !== 'cancelado' && data.deliveryCode && (
          <div className="mt-6 bg-white rounded-2xl shadow-sm border border-gray-100 p-4 border-l-4 border-l-primary-500">
            <h2 className="font-semibold text-gray-900 mb-1">Código para o entregador</h2>
            <p className="text-sm text-gray-500 mb-3">
              Informe este código ao motoqueiro no momento da entrega. Só ele pode confirmar a entrega digitando o código na página dele.
            </p>
            <p className="text-2xl font-mono font-bold text-primary-600 tracking-widest">{data.deliveryCode}</p>
          </div>
        )}
        {data.status === 'entregue' && (
          <>
            <div className="mt-6 bg-primary-50 rounded-2xl border border-primary-200 p-4 text-center">
              <p className="font-semibold text-primary-800">Entrega confirmada</p>
              <p className="text-sm text-primary-700 mt-1">Obrigado!</p>
            </div>
            {/* Avaliações */}
            <div className="mt-6 bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
              <h2 className="font-semibold text-gray-900 mb-4">Como foi sua experiência?</h2>
              {ratingSent || (alreadyRatedEstablishment && alreadyRatedDelivery) ? (
                <div className="text-center py-4 text-gray-600">
                  <p className="font-medium text-primary-600">Obrigado por avaliar!</p>
                  <p className="text-sm mt-1">Sua opinião ajuda a melhorar nosso atendimento.</p>
                  {data.establishmentRating != null && (
                    <p className="text-sm mt-2">Estabelecimento: {'★'.repeat(data.establishmentRating)}{'☆'.repeat(5 - data.establishmentRating)}</p>
                  )}
                  {data.deliveryRating != null && (
                    <p className="text-sm">Entrega: {'★'.repeat(data.deliveryRating)}{'☆'.repeat(5 - data.deliveryRating)}</p>
                  )}
                </div>
              ) : (
                <form onSubmit={handleSubmitRating} className="space-y-6">
                  <div>
                    <p className="text-sm font-medium text-gray-700 mb-2">Avalie o estabelecimento</p>
                    <div className="flex gap-1 mb-2">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <button
                          key={n}
                          type="button"
                          onClick={() => setRateEstablishment(n)}
                          className="p-1 rounded focus:outline-none focus:ring-2 focus:ring-primary-400"
                          aria-label={`${n} estrela(s)`}
                        >
                          <IconStar className={`w-8 h-8 ${rateEstablishment >= n ? 'text-amber-400' : 'text-gray-300'}`} />
                        </button>
                      ))}
                    </div>
                    <input
                      type="text"
                      value={commentEstablishment}
                      onChange={(e) => setCommentEstablishment(e.target.value)}
                      placeholder="Comentário (opcional)"
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900"
                    />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-700 mb-2">Avalie a entrega / motoboy</p>
                    <div className="flex gap-1 mb-2">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <button
                          key={n}
                          type="button"
                          onClick={() => setRateDelivery(n)}
                          className="p-1 rounded focus:outline-none focus:ring-2 focus:ring-primary-400"
                          aria-label={`${n} estrela(s)`}
                        >
                          <IconStar className={`w-8 h-8 ${rateDelivery >= n ? 'text-amber-400' : 'text-gray-300'}`} />
                        </button>
                      ))}
                    </div>
                    <input
                      type="text"
                      value={commentDelivery}
                      onChange={(e) => setCommentDelivery(e.target.value)}
                      placeholder="Comentário (opcional)"
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={!canSubmitRating}
                    className="w-full py-3 rounded-xl bg-primary-600 text-white font-medium hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {sendingRating ? 'Enviando…' : 'Enviar avaliações'}
                  </button>
                </form>
              )}
            </div>
          </>
        )}

        <div className="mt-6 bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
          <h2 className="font-semibold text-gray-900 mb-3">Resumo do pedido</h2>
          <p className="text-sm text-gray-500 mb-3">Feito em {new Date(data.createdAt).toLocaleString('pt-BR')}</p>
          <ul className="space-y-2 border-t border-gray-100 pt-3">
            {data.items.map((i, idx) => (
              <li key={idx} className="flex justify-between text-sm">
                <span className="text-gray-700">{i.quantity}× {i.name}</span>
                <span className="text-gray-600">R$ {i.subtotal.toFixed(2).replace('.', ',')}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 pt-3 border-t border-gray-100 font-bold text-gray-900 flex justify-between">
            <span>Total</span>
            <span className="text-primary-600">R$ {data.total.toFixed(2).replace('.', ',')}</span>
          </p>
        </div>
      </main>
    </div>
  );
}

export default function AcompanharPedidoPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500">Carregando...</p>
      </div>
    }>
      <AcompanharContent />
    </Suspense>
  );
}
