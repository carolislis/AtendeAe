'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  IconMenu,
  IconCart,
  IconWhatsApp,
  IconSparkles,
  IconStar,
  IconTruck,
  IconClipboard,
} from '@/components/Icons';
import { api } from '@/lib/api';

type OrderStatus = 'recebido' | 'preparando' | 'saiu_entrega' | 'entregue' | 'cancelado';

const STATUS_LABELS: Record<OrderStatus, string> = {
  recebido: 'Recebido',
  preparando: 'Preparando',
  saiu_entrega: 'Saiu p/ entrega',
  entregue: 'Entregue',
  cancelado: 'Cancelado',
};

interface DashboardStats {
  ordersToday: number;
  ordersThisWeek: number;
  revenueToday: number;
  revenueThisWeek: number;
  byStatus: Record<OrderStatus, number>;
  pendingCount: number;
  ratings: {
    establishment: { average: number; count: number };
    delivery: { average: number; count: number };
  };
}

function formatMoney(value: number): string {
  return `R$ ${value.toFixed(2).replace('.', ',')}`;
}

export default function HomePage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get<DashboardStats>('/orders/dashboard-stats')
      .then(setStats)
      .catch(() => setStats(null))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <h1 className="text-2xl font-bold text-gray-900">Bem-vindo ao Atendeaê</h1>
        <IconSparkles className="w-6 h-6 text-primary-500" />
      </div>
      <p className="text-gray-600 mb-6">
        Visão geral do seu negócio. Acompanhe pedidos, faturamento e avaliações.
      </p>

      {loading ? (
        <div className="flex items-center gap-2 text-gray-500 mb-8">
          <span className="inline-block w-5 h-5 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
          Carregando indicadores...
        </div>
      ) : stats ? (
        <>
          {/* Cards de indicadores */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
            <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500">Pedidos hoje</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">{stats.ordersToday}</p>
                </div>
                <span className="flex w-10 h-10 rounded-xl bg-amber-100 text-amber-600 items-center justify-center">
                  <IconCart className="w-5 h-5" />
                </span>
              </div>
              <Link href="/pedidos" className="text-xs text-primary-600 hover:underline mt-2 inline-block">
                Ver pedidos →
              </Link>
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500">Pedidos esta semana</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">{stats.ordersThisWeek}</p>
                </div>
              </div>
              <Link href="/pedidos" className="text-xs text-primary-600 hover:underline mt-2 inline-block">
                Ver pedidos →
              </Link>
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500">Faturamento hoje</p>
                  <p className="text-xl font-bold text-primary-600 mt-1">{formatMoney(stats.revenueToday)}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500">Faturamento esta semana</p>
                  <p className="text-xl font-bold text-primary-600 mt-1">{formatMoney(stats.revenueThisWeek)}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Pedidos pendentes + status */}
          <div className="grid gap-6 sm:grid-cols-2 mb-8">
            <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
              <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <IconClipboard className="w-5 h-5 text-amber-500" /> Pedidos pendentes
              </h2>
              <p className="text-3xl font-bold text-amber-600">{stats.pendingCount}</p>
              <p className="text-sm text-gray-500 mt-1">Aguardando preparo ou entrega</p>
              <Link href="/pedidos" className="mt-3 text-sm text-primary-600 font-medium hover:underline inline-block">
                Gerenciar pedidos →
              </Link>
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
              <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <IconTruck className="w-5 h-5 text-gray-500" /> Por status
              </h2>
              <ul className="space-y-2">
                {(Object.entries(stats.byStatus) as [OrderStatus, number][]).map(([status, count]) => (
                  <li key={status} className="flex justify-between text-sm">
                    <span className="text-gray-600">{STATUS_LABELS[status]}</span>
                    <span className="font-medium text-gray-900">{count}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Avaliações */}
          {(stats.ratings.establishment.count > 0 || stats.ratings.delivery.count > 0) && (
            <div className="mb-8 p-5 bg-white rounded-2xl border border-gray-200 shadow-sm">
              <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <IconStar className="w-5 h-5 text-amber-400" /> Avaliações
              </h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="p-4 rounded-xl bg-gray-50 border border-gray-100">
                  <p className="text-sm font-medium text-gray-600">Estabelecimento</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">
                    {stats.ratings.establishment.average > 0
                      ? stats.ratings.establishment.average.toFixed(1)
                      : '—'}
                    {stats.ratings.establishment.count > 0 && (
                      <span className="text-amber-500 ml-1">★</span>
                    )}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {stats.ratings.establishment.count}{' '}
                    {stats.ratings.establishment.count === 1 ? 'avaliação' : 'avaliações'}
                  </p>
                </div>
                <div className="p-4 rounded-xl bg-gray-50 border border-gray-100">
                  <p className="text-sm font-medium text-gray-600">Entrega / Motoboy</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">
                    {stats.ratings.delivery.average > 0
                      ? stats.ratings.delivery.average.toFixed(1)
                      : '—'}
                    {stats.ratings.delivery.count > 0 && (
                      <span className="text-amber-500 ml-1">★</span>
                    )}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {stats.ratings.delivery.count}{' '}
                    {stats.ratings.delivery.count === 1 ? 'avaliação' : 'avaliações'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Acesso rápido */}
          <h2 className="font-semibold text-gray-900 mb-4">Acesso rápido</h2>
        </>
      ) : null}

      <div className="grid gap-5 sm:grid-cols-2 max-w-2xl">
        <Link href="/cardapio" className="dash-card p-6 group">
          <span className="inline-flex w-12 h-12 rounded-xl bg-primary-100 text-primary-600 items-center justify-center group-hover:bg-primary-500 group-hover:text-white transition-colors">
            <IconMenu className="w-6 h-6" />
          </span>
          <h2 className="font-semibold text-gray-900 mt-4 group-hover:text-primary-700">Cardápio</h2>
          <p className="text-sm text-gray-500 mt-1">
            Crie categorias e produtos do seu cardápio digital.
          </p>
        </Link>
        <Link href="/pedidos" className="dash-card p-6 group">
          <span className="inline-flex w-12 h-12 rounded-xl bg-amber-100 text-amber-600 items-center justify-center group-hover:bg-amber-500 group-hover:text-white transition-colors">
            <IconCart className="w-6 h-6" />
          </span>
          <h2 className="font-semibold text-gray-900 mt-4 group-hover:text-amber-700">Pedidos</h2>
          <p className="text-sm text-gray-500 mt-1">
            Veja e gerencie os pedidos feitos pelo link do cardápio.
          </p>
        </Link>
        <Link href="/bot" className="dash-card p-6 group sm:col-span-2 max-w-xl">
          <span className="inline-flex w-12 h-12 rounded-xl bg-[#25D366]/10 text-[#25D366] items-center justify-center group-hover:bg-[#25D366] group-hover:text-white transition-colors">
            <IconWhatsApp className="w-6 h-6" />
          </span>
          <h2 className="font-semibold text-gray-900 mt-4 group-hover:text-[#128C4C]">Bot WhatsApp</h2>
          <p className="text-sm text-gray-500 mt-1">
            Conecte seu número e configure as mensagens do atendimento.
          </p>
        </Link>
      </div>
    </div>
  );
}
