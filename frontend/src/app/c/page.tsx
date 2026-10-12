'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { api, type Category, type Product } from '@/lib/api';

interface CardapioTheme {
  backgroundColor: string;
  menuColor: string;
}

interface PublicMenuResponse {
  categories: Category[];
  products: Product[];
  theme?: CardapioTheme;
}

interface CategoryWithItems extends Category {
  items: Product[];
}

interface CartItem {
  productId: string;
  name: string;
  price: number;
  quantity: number;
}

type Step = 'menu' | 'cart' | 'checkout' | 'success';

function CardapioPublicoContent() {
  const searchParams = useSearchParams();
  const cardapioId = searchParams.get('id') ?? '';
  const waNotifyPhone = searchParams.get('wa') ?? '';
  const [data, setData] = useState<PublicMenuResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [invalidLink, setInvalidLink] = useState(false);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [step, setStep] = useState<Step>('menu');
  const [orderId, setOrderId] = useState<string | null>(null);
  const [trackingToken, setTrackingToken] = useState<string | null>(null);
  const [checkoutForm, setCheckoutForm] = useState({ name: '', address: '', phone: '' });
  const [submitError, setSubmitError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const categoryRefs = useRef<Record<string, HTMLElement | null>>({});

  useEffect(() => {
    if (!cardapioId) {
      setInvalidLink(true);
      setLoading(false);
      return;
    }
    api
      .get<PublicMenuResponse>(`/menu/public?id=${encodeURIComponent(cardapioId)}`)
      .then((res) => setData(res))
      .catch(() => setInvalidLink(true))
      .finally(() => setLoading(false));
  }, [cardapioId]);

  const addToCart = (p: Product) => {
    setCart((prev) => {
      const i = prev.findIndex((x) => x.productId === p.id);
      if (i >= 0) {
        const next = [...prev];
        next[i] = { ...next[i], quantity: next[i].quantity + 1 };
        return next;
      }
      return [...prev, { productId: p.id, name: p.name, price: p.price, quantity: 1 }];
    });
  };

  const updateQuantity = (productId: string, delta: number) => {
    setCart((prev) => {
      const i = prev.findIndex((x) => x.productId === productId);
      if (i < 0) return prev;
      const next = [...prev];
      const q = next[i].quantity + delta;
      if (q <= 0) return prev.filter((_, j) => j !== i);
      next[i] = { ...next[i], quantity: q };
      return next;
    });
  };

  const removeFromCart = (productId: string) => {
    setCart((prev) => prev.filter((x) => x.productId !== productId));
  };

  const cartTotal = cart.reduce((s, i) => s + i.price * i.quantity, 0);
  const cartCount = cart.reduce((s, i) => s + i.quantity, 0);

  const openCart = () => setStep('cart');
  const closeCart = () => setStep('menu');
  const goToCheckout = () => setStep('checkout');
  const backToCart = () => setStep('cart');

  const submitOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError('');
    if (!checkoutForm.name.trim() || !checkoutForm.address.trim() || !checkoutForm.phone.trim()) {
      setSubmitError('Preencha nome, endereço e celular.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await api.post<{ id: string; trackingToken?: string }>('/orders', {
        cardapioId,
        items: cart.map((i) => ({ productId: i.productId, name: i.name, price: i.price, quantity: i.quantity })),
        customer: {
          name: checkoutForm.name.trim(),
          address: checkoutForm.address.trim(),
          phone: checkoutForm.phone.trim(),
        },
        ...(waNotifyPhone.trim() && { waNotifyPhone: waNotifyPhone.trim() }),
      });
      setOrderId(res?.id ?? null);
      setTrackingToken(res?.trackingToken ?? null);
      setCart([]);
      setStep('success');
    } catch (err) {
      setSubmitError((err as Error).message || 'Erro ao enviar pedido. Tente de novo.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen min-h-[100dvh] flex items-center justify-center p-4" style={{ backgroundColor: '#f5f5f5' }}>
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-full border-2 border-primary-400 border-t-transparent animate-spin" />
          <p className="text-gray-600 text-sm font-medium">Carregando cardápio...</p>
        </div>
      </div>
    );
  }

  if (invalidLink || !data) {
    return (
      <div className="min-h-screen min-h-[100dvh] flex items-center justify-center px-4 py-6" style={{ backgroundColor: '#f5f5f5' }}>
        <div className="bg-white rounded-3xl p-8 text-center shadow-lg max-w-sm w-full border border-gray-100">
          <div className="w-14 h-14 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </div>
          <p className="text-gray-800 font-semibold text-lg">Link inválido ou expirado</p>
          <p className="text-sm text-gray-500 mt-2">Peça um novo link ao estabelecimento.</p>
        </div>
      </div>
    );
  }

  const { categories, products, theme } = data;
  const bgColor = theme?.backgroundColor ?? '#f5f5f5';
  const menuColor = theme?.menuColor ?? '#ffffff';
  const hexToLuma = (hex: string) => {
    const h = hex.replace(/^#/, '');
    if (h.length !== 6) return 128;
    const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
    return 0.299 * r + 0.587 * g + 0.114 * b;
  };
  const menuTextColor = hexToLuma(menuColor) < 140 ? '#ffffff' : '#1f2937';
  const menuSubtextColor = hexToLuma(menuColor) < 140 ? 'rgba(255,255,255,0.8)' : '#6b7280';
  const byCategory: CategoryWithItems[] = categories
    .sort((a, b) => a.order - b.order)
    .map((cat) => ({
      ...cat,
      items: products.filter((p) => p.categoryId === cat.id).sort((a, b) => a.order - b.order || a.name.localeCompare(b.name)),
    }));

  const scrollToCategory = (catId: string) => {
    categoryRefs.current[catId]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  // Tela de sucesso
  if (step === 'success') {
    return (
      <div className="min-h-screen min-h-[100dvh] flex items-center justify-center px-4 py-6 cardapio-page transition-colors" style={{ backgroundColor: bgColor }}>
        <div className="bg-white rounded-3xl p-8 text-center shadow-lg max-w-sm w-full border border-gray-100">
          <div className="w-16 h-16 rounded-full bg-primary-100 flex items-center justify-center mx-auto mb-5">
            <svg className="w-9 h-9 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-900">Pedido realizado!</h2>
          {orderId && <p className="text-sm text-gray-600 mt-2 font-mono">Nº {orderId}</p>}
          <p className="text-sm text-gray-500 mt-3">Em breve você receberá a confirmação pelo contato informado.</p>
          {trackingToken && (
            <div className="mt-4 p-3 bg-gray-50 rounded-xl text-left w-full">
              <p className="text-xs font-medium text-gray-500 mb-1">Acompanhe seu pedido:</p>
              <div className="flex flex-wrap items-center gap-2">
                <code className="text-sm text-gray-800 break-all flex-1 min-w-0">
                  {typeof window !== 'undefined' ? `${window.location.origin}/r/${trackingToken}` : `/r/${trackingToken}`}
                </code>
                <button
                  type="button"
                  onClick={() => {
                    const url = typeof window !== 'undefined' ? `${window.location.origin}/r/${trackingToken}` : '';
                    if (url) navigator.clipboard?.writeText(url).then(() => alert('Link copiado!'));
                  }}
                  className="px-3 py-1.5 rounded-lg bg-primary-600 text-white text-sm font-medium"
                >
                  Copiar link
                </button>
              </div>
            </div>
          )}
          <button
            type="button"
            onClick={() => { setStep('menu'); setOrderId(null); setTrackingToken(null); }}
            className="mt-6 w-full py-3.5 rounded-2xl bg-primary-600 text-white font-semibold hover:bg-primary-700 active:scale-[0.98] transition"
          >
            Fazer outro pedido
          </button>
        </div>
      </div>
    );
  }

  // Checkout: nome, endereço, celular
  if (step === 'checkout') {
    return (
      <div className="min-h-screen min-h-[100dvh] pb-32 cardapio-page transition-colors" style={{ backgroundColor: bgColor }}>
        <header className="sticky top-0 z-20 shadow-sm safe-top backdrop-blur-sm" style={{ backgroundColor: menuColor }}>
          <div className="max-w-lg mx-auto px-4 py-3 flex items-center gap-3 min-h-[52px]">
            <button type="button" onClick={backToCart} className="p-2 -ml-1 rounded-xl touch-manipulation hover:opacity-80" style={{ color: menuTextColor }} aria-label="Voltar">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            </button>
            <h1 className="text-lg font-bold flex-1" style={{ color: menuTextColor }}>Seus dados para entrega</h1>
          </div>
        </header>
        <main className="max-w-lg mx-auto px-4 sm:px-5 py-6">
          <form onSubmit={submitOrder} className="space-y-5">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1.5">Nome completo</label>
              <input
                id="name"
                type="text"
                value={checkoutForm.name}
                onChange={(e) => setCheckoutForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Seu nome"
                className="w-full px-4 py-3.5 rounded-2xl border border-gray-200 bg-white text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-primary-400 text-base"
              />
            </div>
            <div>
              <label htmlFor="address" className="block text-sm font-medium text-gray-700 mb-1.5">Endereço de entrega</label>
              <input
                id="address"
                type="text"
                value={checkoutForm.address}
                onChange={(e) => setCheckoutForm((f) => ({ ...f, address: e.target.value }))}
                placeholder="Rua, número, bairro, complemento"
                className="w-full px-4 py-3.5 rounded-2xl border border-gray-200 bg-white text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-primary-400 text-base"
              />
            </div>
            <div>
              <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1.5">Celular de contato</label>
              <input
                id="phone"
                type="tel"
                inputMode="numeric"
                value={checkoutForm.phone}
                onChange={(e) => setCheckoutForm((f) => ({ ...f, phone: e.target.value }))}
                placeholder="(11) 99999-9999"
                className="w-full px-4 py-3.5 rounded-2xl border border-gray-200 bg-white text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-primary-400 text-base"
              />
            </div>
            {submitError && <p className="text-sm text-red-600 font-medium">{submitError}</p>}
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3.5 rounded-2xl bg-primary-600 text-white font-semibold hover:bg-primary-700 disabled:opacity-60 active:scale-[0.98] transition touch-manipulation"
            >
              {submitting ? 'Enviando...' : 'Confirmar pedido'}
            </button>
          </form>
        </main>
      </div>
    );
  }

  // Drawer do carrinho (overlay)
  const cartDrawerOpen = step === 'cart';
  return (
    <div className="min-h-screen min-h-[100dvh] pb-28 sm:pb-24 cardapio-page transition-colors" style={{ backgroundColor: bgColor }}>
      <header className="sticky top-0 z-20 shadow-sm safe-top backdrop-blur-sm" style={{ backgroundColor: menuColor }}>
        <div className="max-w-lg mx-auto px-4 sm:px-5 py-4">
          <h1 className="text-xl sm:text-lg font-bold tracking-tight" style={{ color: menuTextColor }}>Cardápio</h1>
          {waNotifyPhone && (
            <p className="text-xs mt-1 flex items-center gap-1.5" style={{ color: menuSubtextColor }}>
              <span className="inline-block w-3.5 h-3.5 rounded-full bg-[#25D366]" title="WhatsApp" aria-hidden /> Atendimento via WhatsApp
            </p>
          )}
        </div>
        {byCategory.length > 1 && (
          <div className="overflow-x-auto scrollbar-hide border-t border-black/10">
            <div className="flex gap-2 px-4 py-3 min-w-0">
              {byCategory.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => scrollToCategory(cat.id)}
                  className="flex-shrink-0 px-4 py-2.5 rounded-full text-sm font-medium transition-colors touch-manipulation opacity-90 hover:opacity-100"
                  style={{ backgroundColor: hexToLuma(menuColor) < 140 ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.06)', color: menuTextColor }}
                >
                  {cat.name}
                </button>
              ))}
            </div>
          </div>
        )}
      </header>

      <main className="max-w-lg mx-auto px-4 sm:px-5 pt-4 pb-6">
        {byCategory.length === 0 ? (
          <div className="bg-white rounded-3xl p-10 text-center text-gray-500 shadow-md border border-gray-100">
            Nenhum item no cardápio no momento.
          </div>
        ) : (
          <div className="space-y-8 sm:space-y-10">
            {byCategory.map((cat) => (
              <section
                key={cat.id}
                ref={(el) => { categoryRefs.current[cat.id] = el; }}
                className="scroll-mt-28 sm:scroll-mt-24"
              >
                <h2 className="text-lg font-bold text-gray-900 mb-3 sm:mb-4 px-0.5">{cat.name}</h2>
                <div className="space-y-3 sm:space-y-3">
                  {cat.items.map((p) => (
                    <article
                      key={p.id}
                      className="bg-white rounded-2xl sm:rounded-2xl overflow-hidden shadow-md sm:shadow-sm border border-gray-100 flex flex-col sm:flex-row"
                    >
                      <div className="relative w-full sm:w-32 h-44 sm:h-28 flex-shrink-0 bg-gray-100">
                        {p.imageUrl ? (
                          <img src={p.imageUrl} alt={p.name} className="absolute inset-0 w-full h-full object-cover" />
                        ) : (
                          <div className="absolute inset-0 flex items-center justify-center text-gray-300">
                            <svg className="w-14 h-14 sm:w-12 sm:h-12" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
                              <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z" />
                            </svg>
                          </div>
                        )}
                      </div>
                      <div className="flex flex-1 flex-col justify-between p-4 sm:p-4 min-w-0">
                        <div>
                          <h3 className="font-semibold text-gray-900 text-base sm:text-base leading-tight">{p.name}</h3>
                          {p.description && <p className="text-sm text-gray-500 mt-1 line-clamp-2">{p.description}</p>}
                        </div>
                        <div className="mt-3 flex items-center justify-between gap-3">
                          <span className="text-lg font-bold text-gray-900">
                            R$ <span className="text-primary-600">{Number(p.price).toFixed(2).replace('.', ',')}</span>
                          </span>
                          <div className="flex items-center rounded-2xl border border-gray-200 bg-gray-50 overflow-hidden touch-manipulation">
                            <button
                              type="button"
                              onClick={() => {
                                const cur = cart.find((x) => x.productId === p.id);
                                if (cur && cur.quantity > 0) updateQuantity(p.id, -1);
                              }}
                              className="w-11 h-11 sm:w-9 sm:h-9 flex items-center justify-center text-gray-600 hover:bg-gray-100 active:bg-gray-200"
                              aria-label="Menos"
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" /></svg>
                            </button>
                            <span className="min-w-[2rem] text-center text-sm font-semibold text-gray-800">
                              {cart.find((x) => x.productId === p.id)?.quantity ?? 0}
                            </span>
                            <button
                              type="button"
                              onClick={() => addToCart(p)}
                              className="w-11 h-11 sm:w-9 sm:h-9 flex items-center justify-center text-primary-600 hover:bg-primary-50 active:bg-primary-100"
                              aria-label="Mais"
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                            </button>
                          </div>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </main>

      {/* Botão flutuante do carrinho — mobile: full width, desktop: compacto */}
      <div className="fixed bottom-0 left-0 right-0 z-30 px-4 sm:px-4 max-w-lg mx-auto pointer-events-none cardapio-fab">
        <div className="pointer-events-auto w-full sm:w-auto sm:flex sm:justify-end">
          <button
            type="button"
            onClick={cartCount > 0 ? openCart : undefined}
            disabled={cartCount === 0}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-3.5 sm:py-3 rounded-2xl bg-primary-600 text-white font-semibold shadow-lg disabled:opacity-50 disabled:cursor-default hover:bg-primary-700 active:scale-[0.98] transition touch-manipulation"
          >
            <span className="relative flex items-center justify-center">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
              {cartCount > 0 && (
                <span className="absolute -top-2.5 -right-2.5 min-w-[1.25rem] h-5 px-1 rounded-full bg-white text-primary-600 text-xs font-bold flex items-center justify-center">
                  {cartCount}
                </span>
              )}
            </span>
            {cartCount > 0 ? (
              <span>Ver carrinho · R$ {cartTotal.toFixed(2).replace('.', ',')}</span>
            ) : (
              <span className="sm:hidden">Carrinho vazio</span>
            )}
          </button>
        </div>
      </div>

      {/* Drawer do carrinho */}
      {cartDrawerOpen && (
        <>
          <div className="fixed inset-0 bg-black/50 z-40 sm:bg-black/40" onClick={closeCart} aria-hidden />
          <div className="cardapio-drawer fixed bottom-0 left-0 right-0 z-50 bg-white shadow-2xl max-h-[88vh] sm:max-h-[85vh] flex flex-col animate-slide-up">
            <div className="flex items-center justify-between px-4 py-4 border-b border-gray-100 flex-shrink-0">
              <h2 className="text-lg font-bold text-gray-900">Carrinho</h2>
              <button type="button" onClick={closeCart} className="p-2.5 text-gray-500 hover:bg-gray-100 rounded-xl touch-manipulation" aria-label="Fechar">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="overflow-y-auto flex-1 px-4 py-3 min-h-0">
              {cart.length === 0 ? (
                <p className="text-gray-500 py-10 text-center">Seu carrinho está vazio.</p>
              ) : (
                <ul className="space-y-3">
                  {cart.map((i) => (
                    <li key={i.productId} className="flex items-center gap-3 py-3 border-b border-gray-100 last:border-0">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900">{i.name}</p>
                        <p className="text-sm text-gray-500">R$ {Number(i.price).toFixed(2).replace('.', ',')} × {i.quantity}</p>
                      </div>
                      <div className="flex items-center gap-1">
                        <button type="button" onClick={() => updateQuantity(i.productId, -1)} className="w-10 h-10 sm:w-8 sm:h-8 rounded-xl bg-gray-100 flex items-center justify-center text-gray-600 touch-manipulation" aria-label="Menos">−</button>
                        <span className="w-7 text-center text-sm font-semibold">{i.quantity}</span>
                        <button type="button" onClick={() => updateQuantity(i.productId, 1)} className="w-10 h-10 sm:w-8 sm:h-8 rounded-xl bg-gray-100 flex items-center justify-center text-gray-600 touch-manipulation" aria-label="Mais">+</button>
                        <button type="button" onClick={() => removeFromCart(i.productId)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg touch-manipulation" aria-label="Remover">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="p-4 border-t border-gray-100 bg-gray-50 flex-shrink-0">
              <div className="flex justify-between text-lg font-bold text-gray-900 mb-3">
                <span>Total</span>
                <span className="text-primary-600">R$ {cartTotal.toFixed(2).replace('.', ',')}</span>
              </div>
              <button
                type="button"
                onClick={goToCheckout}
                disabled={cart.length === 0}
                className="w-full py-3.5 rounded-2xl bg-primary-600 text-white font-semibold hover:bg-primary-700 disabled:opacity-50 active:scale-[0.98] transition touch-manipulation"
              >
                Finalizar pedido
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default function CardapioPublicoPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#f7f7f7] flex items-center justify-center">
        <p className="text-gray-500">Carregando cardápio...</p>
      </div>
    }>
      <CardapioPublicoContent />
    </Suspense>
  );
}
