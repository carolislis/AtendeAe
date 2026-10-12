'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, BackendOfflineError } from '@/lib/api';
import { IconTruck, IconWhatsApp } from '@/components/Icons';

interface Motoboy {
  id: string;
  name: string;
  phone: string;
}

export default function MotoboysPage() {
  const [list, setList] = useState<Motoboy[]>([]);
  const [loading, setLoading] = useState(true);
  const [backendOffline, setBackendOffline] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = useCallback(() => {
    api
      .get<Motoboy[]>('/config/motoboys')
      .then((data) => setList(Array.isArray(data) ? data : []))
      .catch((e) => {
        if (e instanceof BackendOfflineError) setBackendOffline(true);
        setList([]);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openNew = () => {
    setEditingId(null);
    setName('');
    setPhone('');
    setFormOpen(true);
  };

  const openEdit = (m: Motoboy) => {
    setEditingId(m.id);
    setName(m.name);
    setPhone(m.phone);
    setFormOpen(true);
  };

  const closeForm = () => {
    setFormOpen(false);
    setEditingId(null);
    setName('');
    setPhone('');
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const nameTrim = name.trim();
    const phoneTrim = phone.trim();
    if (!nameTrim || !phoneTrim) {
      alert('Preencha nome e WhatsApp.');
      return;
    }
    setSaving(true);
    try {
      if (editingId) {
        await api.put(`/config/motoboys/${editingId}`, { name: nameTrim, phone: phoneTrim });
        setList((prev) => prev.map((m) => (m.id === editingId ? { ...m, name: nameTrim, phone: phoneTrim } : m)));
      } else {
        const created = await api.post<Motoboy>('/config/motoboys', { name: nameTrim, phone: phoneTrim });
        setList((prev) => [created, ...prev]);
      }
      closeForm();
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm('Remover este motoboy da lista?')) return;
    setDeletingId(id);
    try {
      await api.delete(`/config/motoboys/${id}`);
      setList((prev) => prev.filter((m) => m.id !== id));
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) return <p className="text-gray-500">Carregando...</p>;
  if (backendOffline) return <p className="text-amber-600">Servidor offline. Tente de novo em instantes.</p>;

  return (
    <div>
      <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
        <div className="flex items-center gap-3">
          <span className="flex w-10 h-10 rounded-xl bg-emerald-100 text-emerald-600 items-center justify-center">
            <IconTruck className="w-5 h-5" />
          </span>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Motoboys</h1>
            <p className="text-sm text-gray-500">Cadastre os entregadores para receberem pedidos no WhatsApp.</p>
          </div>
        </div>
        <button
          type="button"
          onClick={openNew}
          className="px-4 py-2 bg-primary-600 text-white rounded-xl font-medium hover:bg-primary-700 transition-colors"
        >
          Adicionar motoboy
        </button>
      </div>

      {formOpen && (
        <section className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            {editingId ? 'Editar motoboy' : 'Novo motoboy'}
          </h2>
          <form onSubmit={submit} className="space-y-4">
            <div>
              <label htmlFor="motoboy-name" className="block text-sm font-medium text-gray-700 mb-1">
                Nome
              </label>
              <input
                id="motoboy-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex.: João"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900"
              />
            </div>
            <div>
              <label htmlFor="motoboy-phone" className="block text-sm font-medium text-gray-700 mb-1">
                WhatsApp (com DDD, só números)
              </label>
              <input
                id="motoboy-phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Ex.: 11999999999"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900"
              />
            </div>
            <div className="flex gap-3">
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
              >
                {saving ? 'Salvando…' : editingId ? 'Salvar' : 'Adicionar'}
              </button>
              <button
                type="button"
                onClick={closeForm}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                Cancelar
              </button>
            </div>
          </form>
        </section>
      )}

      <section className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        {list.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <IconTruck className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p>Nenhum motoboy cadastrado.</p>
            <p className="text-sm mt-1">Adicione para que recebam notificações de novos pedidos e de saída para entrega no WhatsApp.</p>
            <button
              type="button"
              onClick={openNew}
              className="mt-4 text-primary-600 font-medium hover:underline"
            >
              Adicionar motoboy
            </button>
          </div>
        ) : (
          <ul className="divide-y divide-gray-200">
            {list.map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-4 p-4 hover:bg-gray-50/50">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="flex w-10 h-10 rounded-full bg-[#25D366]/10 text-[#25D366] items-center justify-center flex-shrink-0">
                    <IconWhatsApp className="w-5 h-5" />
                  </span>
                  <div className="min-w-0">
                    <p className="font-medium text-gray-900 truncate">{m.name}</p>
                    <p className="text-sm text-gray-500 truncate">{m.phone}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => openEdit(m)}
                    className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-200 rounded-lg transition-colors"
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(m.id)}
                    disabled={deletingId === m.id}
                    className="px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                  >
                    {deletingId === m.id ? 'Removendo…' : 'Remover'}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
