'use client';

import { useEffect, useState } from 'react';
import { api, BackendOfflineError, type Category, type Product } from '@/lib/api';
import { IconLink, IconCopy, IconPalette, IconMenu } from '@/components/Icons';

const PALETA_FUNDO = [
  { nome: 'Cinza claro', hex: '#f5f5f5' },
  { nome: 'Verde claro', hex: '#f0fdf4' },
  { nome: 'Azul claro', hex: '#eff6ff' },
  { nome: 'Amarelo claro', hex: '#fefce8' },
  { nome: 'Rosa claro', hex: '#fdf2f8' },
  { nome: 'Violeta claro', hex: '#f5f3ff' },
  { nome: 'Menta', hex: '#ecfdf5' },
  { nome: 'Laranja claro', hex: '#fff7ed' },
  { nome: 'Slate', hex: '#f8fafc' },
  { nome: 'Âmbar claro', hex: '#fef3c7' },
];

const PALETA_MENU = [
  { nome: 'Branco', hex: '#ffffff' },
  { nome: 'Verde', hex: '#128c4c' },
  { nome: 'Escuro', hex: '#0f172a' },
  { nome: 'Azul marinho', hex: '#1e3a5f' },
  { nome: 'Cinza', hex: '#374151' },
  { nome: 'Esmeralda', hex: '#059669' },
  { nome: 'Vermelho', hex: '#dc2626' },
  { nome: 'Violeta', hex: '#7c3aed' },
  { nome: 'Âmbar', hex: '#d97706' },
  { nome: 'Rosa', hex: '#db2777' },
];

export default function CardapioPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [backendOffline, setBackendOffline] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [showProductForm, setShowProductForm] = useState(false);
  const [categoryName, setCategoryName] = useState('');
  const [productForm, setProductForm] = useState({ name: '', description: '', price: '', categoryId: '', imageUrl: '' });
  const [cardapioId, setCardapioId] = useState('');
  const [theme, setTheme] = useState<{ backgroundColor: string; menuColor: string }>({ backgroundColor: '#f5f5f5', menuColor: '#ffffff' });

  const load = async () => {
    try {
      setLoading(true);
      setBackendOffline(false);
      const [catRes, prodRes, cardapioRes, themeRes] = await Promise.all([
        api.get<Category[]>('/menu/categories').catch((e) => { if (e instanceof BackendOfflineError) throw e; return []; }),
        api.get<Product[]>('/menu/products').catch((e) => { if (e instanceof BackendOfflineError) throw e; return []; }),
        api.get<{ cardapioId: string }>('/config/cardapio').catch(() => ({ cardapioId: '' })),
        api.get<{ backgroundColor: string; menuColor: string }>('/config/cardapio-theme').catch(() => ({ backgroundColor: '#f5f5f5', menuColor: '#ffffff' })),
      ]);
      setCategories(Array.isArray(catRes) ? catRes : []);
      setProducts(Array.isArray(prodRes) ? prodRes : []);
      setCardapioId((cardapioRes?.cardapioId ?? '').toString());
      if (themeRes?.backgroundColor) setTheme((t) => ({ ...t, backgroundColor: themeRes.backgroundColor }));
      if (themeRes?.menuColor) setTheme((t) => ({ ...t, menuColor: themeRes.menuColor }));
    } catch (e) {
      if (e instanceof BackendOfflineError) {
        setBackendOffline(true);
      }
      setCategories([]);
      setProducts([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const saveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!categoryName.trim()) return;
    try {
      if (editingCategory) {
        await api.put(`/menu/categories/${editingCategory.id}`, { name: categoryName.trim(), order: editingCategory.order });
      } else {
        await api.post('/menu/categories', { name: categoryName.trim(), order: categories.length });
      }
      setCategoryName('');
      setEditingCategory(null);
      setShowCategoryForm(false);
      load();
    } catch (err) {
      alert((err as Error).message);
    }
  };

  const saveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    const price = parseFloat(productForm.price);
    if (!productForm.name.trim() || isNaN(price) || price < 0 || !productForm.categoryId) {
      alert('Preencha nome, preço e categoria.');
      return;
    }
    try {
      const body = {
        name: productForm.name.trim(),
        description: productForm.description.trim() || undefined,
        price,
        categoryId: productForm.categoryId,
        imageUrl: productForm.imageUrl.trim() || undefined,
        order: products.filter(p => p.categoryId === productForm.categoryId).length,
      };
      if (editingProduct) {
        await api.put(`/menu/products/${editingProduct.id}`, { ...body, order: editingProduct.order });
      } else {
        await api.post('/menu/products', body);
      }
      setProductForm({ name: '', description: '', price: '', categoryId: '', imageUrl: '' });
      setEditingProduct(null);
      setShowProductForm(false);
      load();
    } catch (err) {
      alert((err as Error).message);
    }
  };

  const deleteCategory = async (id: string) => {
    if (!confirm('Excluir categoria? Os produtos dela ficarão sem categoria.')) return;
    try {
      await api.delete(`/menu/categories/${id}`);
      load();
    } catch (err) {
      alert((err as Error).message);
    }
  };

  const deleteProduct = async (id: string) => {
    if (!confirm('Excluir este produto?')) return;
    try {
      await api.delete(`/menu/products/${id}`);
      load();
    } catch (err) {
      alert((err as Error).message);
    }
  };

  const openEditCategory = (c: Category) => {
    setEditingCategory(c);
    setCategoryName(c.name);
    setShowCategoryForm(true);
  };

  const openEditProduct = (p: Product) => {
    setEditingProduct(p);
    setProductForm({
      name: p.name,
      description: p.description || '',
      price: String(p.price),
      categoryId: p.categoryId,
      imageUrl: p.imageUrl || '',
    });
    setShowProductForm(true);
  };

  if (loading) {
    return <p className="text-gray-500">Carregando cardápio...</p>;
  }

  return (
    <div>
      {backendOffline && (
        <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-sm">
          <strong>Backend não está rodando.</strong> O dashboard precisa do backend na porta 4000.
          <ul className="mt-2 list-disc list-inside">
            <li><strong>Docker:</strong> <code className="bg-amber-100 px-1 rounded">docker compose up -d</code> e use <a href="http://localhost:3100" className="underline">http://localhost:3100</a></li>
            <li><strong>Local:</strong> em outro terminal: <code className="bg-amber-100 px-1 rounded">cd backend &amp;&amp; npm run start:dev</code></li>
          </ul>
        </div>
      )}
      <div className="flex items-center gap-3 mb-6">
        <span className="flex w-10 h-10 rounded-xl bg-primary-100 text-primary-600 items-center justify-center">
          <IconMenu className="w-5 h-5" />
        </span>
        <h1 className="text-2xl font-bold text-gray-900">Cardápio</h1>
      </div>

      {/* Link do cardápio (atrelado ao ID do cardápio) */}
      <section className="mb-8 p-5 bg-gradient-to-br from-primary-50 to-primary-50/50 border border-primary-200 rounded-2xl shadow-sm">
        <h2 className="text-sm font-semibold text-primary-900 mb-2 flex items-center gap-2">
          <IconLink className="w-4 h-4" /> Link do cardápio
        </h2>
        <p className="text-sm text-primary-800 mb-3">
          O link é atrelado ao <strong>ID do cardápio</strong>. Envie este link para o cliente — ele abre uma <strong>página separada, sem o menu do dashboard</strong>, só o cardápio para pedir.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <code className="flex-1 min-w-0 text-sm bg-white border border-primary-200 rounded px-3 py-2 text-primary-900 break-all">
            {typeof window !== 'undefined' && cardapioId
              ? `${window.location.origin}/c?id=${encodeURIComponent(cardapioId)}`
              : cardapioId ? `/c?id=${encodeURIComponent(cardapioId)}` : '/c?id=...'}
          </code>
          <button
            type="button"
            onClick={() => {
              const url = typeof window !== 'undefined' && cardapioId
                ? `${window.location.origin}/c?id=${encodeURIComponent(cardapioId)}`
                : '';
              if (url) navigator.clipboard?.writeText(url).then(() => alert('Link copiado!'));
            }}
            disabled={!cardapioId}
            className="px-4 py-2 bg-primary-600 text-white rounded-xl text-sm font-medium hover:bg-primary-700 whitespace-nowrap disabled:opacity-50 inline-flex items-center gap-2 transition-all hover:shadow-md"
          >
            <IconCopy className="w-4 h-4" /> Copiar link
          </button>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="text-xs text-primary-700">ID do cardápio:</span>
          <code className="text-xs bg-primary-100 px-2 py-0.5 rounded text-primary-900">{cardapioId || '—'}</code>
          <button
            type="button"
            onClick={async () => {
              try {
                const res = await api.put<{ cardapioId: string }>('/config/cardapio', { cardapioId: '' });
                setCardapioId(res?.cardapioId ?? '');
                alert('Novo ID gerado. O link anterior deixa de funcionar.');
              } catch {
                alert('Erro ao gerar novo ID.');
              }
            }}
            className="text-xs text-primary-600 hover:underline"
          >
            Gerar novo ID
          </button>
        </div>
      </section>

      {/* Aparência do cardápio */}
      <section className="mb-8 p-5 bg-white border border-gray-200 rounded-2xl shadow-sm">
        <h2 className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
          <IconPalette className="w-4 h-4 text-primary-600" /> Aparência do cardápio
        </h2>
        <p className="text-sm text-gray-600 mb-4">
          Escolha as cores de fundo e do menu (cabeçalho) que o cliente vê ao abrir o link.
        </p>
        <div className="space-y-4">
          <div>
            <span className="block text-xs font-medium text-gray-500 mb-2">Cor de fundo</span>
            <div className="flex flex-wrap gap-2">
              {PALETA_FUNDO.map((c) => (
                <button
                  key={c.hex}
                  type="button"
                  onClick={async () => {
                    try {
                      await api.put('/config/cardapio-theme', { backgroundColor: c.hex });
                      setTheme((t) => ({ ...t, backgroundColor: c.hex }));
                    } catch {
                      alert('Erro ao salvar.');
                    }
                  }}
                  className="w-9 h-9 rounded-xl border-2 shadow-sm hover:scale-110 transition-transform duration-200"
                  style={{ backgroundColor: c.hex, borderColor: theme.backgroundColor === c.hex ? '#128c4c' : 'transparent' }}
                  title={c.nome}
                  aria-label={c.nome}
                />
              ))}
            </div>
          </div>
          <div>
            <span className="block text-xs font-medium text-gray-500 mb-2">Cor do menu (cabeçalho)</span>
            <div className="flex flex-wrap gap-2">
              {PALETA_MENU.map((c) => (
                <button
                  key={c.hex}
                  type="button"
                  onClick={async () => {
                    try {
                      await api.put('/config/cardapio-theme', { menuColor: c.hex });
                      setTheme((t) => ({ ...t, menuColor: c.hex }));
                    } catch {
                      alert('Erro ao salvar.');
                    }
                  }}
                  className="w-9 h-9 rounded-xl border-2 shadow-sm hover:scale-110 transition-transform duration-200"
                  style={{ backgroundColor: c.hex, borderColor: theme.menuColor === c.hex ? '#128c4c' : 'transparent' }}
                  title={c.nome}
                  aria-label={c.nome}
                />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Categorias */}
      <section className="mb-10">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-800">Categorias</h2>
          <button
            type="button"
            onClick={() => { setShowCategoryForm(true); setEditingCategory(null); setCategoryName(''); }}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700"
          >
            + Nova categoria
          </button>
        </div>
        {showCategoryForm && (
          <form onSubmit={saveCategory} className="flex gap-2 mb-4 p-4 bg-white rounded-xl border border-gray-200">
            <input
              type="text"
              value={categoryName}
              onChange={(e) => setCategoryName(e.target.value)}
              placeholder="Nome da categoria"
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg"
              autoFocus
            />
            <button type="submit" className="px-4 py-2 bg-primary-600 text-white rounded-lg">Salvar</button>
            <button type="button" onClick={() => { setShowCategoryForm(false); setEditingCategory(null); setCategoryName(''); }} className="px-4 py-2 text-gray-600">Cancelar</button>
          </form>
        )}
        <ul className="space-y-2">
          {categories.length === 0 && <p className="text-gray-500 text-sm">Nenhuma categoria. Crie uma para organizar os produtos.</p>}
          {categories.map((c) => (
            <li key={c.id} className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-200">
              <span className="font-medium">{c.name}</span>
              <div className="flex gap-2">
                <button type="button" onClick={() => openEditCategory(c)} className="text-sm text-primary-600 hover:underline">Editar</button>
                <button type="button" onClick={() => deleteCategory(c.id)} className="text-sm text-red-600 hover:underline">Excluir</button>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* Produtos */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-800">Produtos</h2>
          <button
            type="button"
            onClick={() => { setShowProductForm(true); setEditingProduct(null); setProductForm({ name: '', description: '', price: '', categoryId: categories[0]?.id || '', imageUrl: '' }); }}
            disabled={categories.length === 0}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50"
          >
            + Novo produto
          </button>
        </div>
        {showProductForm && (
          <form onSubmit={saveProduct} className="grid gap-3 p-4 bg-white rounded-xl border border-gray-200 mb-4 max-w-xl">
            <input
              type="text"
              value={productForm.name}
              onChange={(e) => setProductForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Nome do produto"
              className="px-3 py-2 border border-gray-300 rounded-lg"
              required
            />
            <textarea
              value={productForm.description}
              onChange={(e) => setProductForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="Descrição (opcional)"
              className="px-3 py-2 border border-gray-300 rounded-lg"
              rows={2}
            />
            <input
              type="number"
              step="0.01"
              min="0"
              value={productForm.price}
              onChange={(e) => setProductForm((f) => ({ ...f, price: e.target.value }))}
              placeholder="Preço (R$)"
              className="px-3 py-2 border border-gray-300 rounded-lg"
              required
            />
            <select
              value={productForm.categoryId}
              onChange={(e) => setProductForm((f) => ({ ...f, categoryId: e.target.value }))}
              className="px-3 py-2 border border-gray-300 rounded-lg"
              required
            >
              <option value="">Selecione a categoria</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <input
              type="url"
              value={productForm.imageUrl}
              onChange={(e) => setProductForm((f) => ({ ...f, imageUrl: e.target.value }))}
              placeholder="URL da imagem (opcional)"
              className="px-3 py-2 border border-gray-300 rounded-lg"
            />
            <div className="flex gap-2">
              <button type="submit" className="px-4 py-2 bg-primary-600 text-white rounded-lg">Salvar</button>
              <button type="button" onClick={() => { setShowProductForm(false); setEditingProduct(null); }} className="px-4 py-2 text-gray-600">Cancelar</button>
            </div>
          </form>
        )}
        <div className="space-y-4">
          {categories.map((cat) => {
            const prods = products.filter((p) => p.categoryId === cat.id);
            return (
              <div key={cat.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <h3 className="px-4 py-2 bg-gray-100 font-medium text-gray-800">{cat.name}</h3>
                {prods.length === 0 ? (
                  <p className="px-4 py-3 text-gray-500 text-sm">Nenhum produto nesta categoria.</p>
                ) : (
                  <ul className="divide-y divide-gray-100">
                    {prods.map((p) => (
                      <li key={p.id} className="flex items-center justify-between px-4 py-3">
                        <div className="flex items-center gap-3">
                          {p.imageUrl && (
                            <img src={p.imageUrl} alt="" className="w-12 h-12 object-cover rounded-lg" />
                          )}
                          <div>
                            <p className="font-medium">{p.name}</p>
                            {p.description && <p className="text-sm text-gray-500">{p.description}</p>}
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-semibold text-primary-600">R$ {Number(p.price).toFixed(2)}</span>
                          <button type="button" onClick={() => openEditProduct(p)} className="text-sm text-primary-600 hover:underline">Editar</button>
                          <button type="button" onClick={() => deleteProduct(p.id)} className="text-sm text-red-600 hover:underline">Excluir</button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
          {categories.length === 0 && <p className="text-gray-500 text-sm">Crie uma categoria antes de adicionar produtos.</p>}
        </div>
      </section>
    </div>
  );
}
