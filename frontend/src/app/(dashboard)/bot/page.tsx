'use client';

import { useCallback, useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { api, BackendOfflineError } from '@/lib/api';
import { IconWhatsApp, IconQrCode, IconLogout, IconDocumentText, IconCopy, IconLink } from '@/components/Icons';

function QRCodeDisplay({ value }: { value: string }) {
  return (
    <div className="bg-white p-4 rounded-lg shadow border border-gray-200">
      <QRCodeSVG value={value} size={256} level="M" />
    </div>
  );
}

interface BotStatus {
  configured: boolean;
  connected?: boolean;
  instanceName?: string;
  state?: string;
  error?: string;
}

interface BotQrCode {
  configured: boolean;
  qrcode?: string;
  error?: string;
}

type OrderStatusKey = 'recebido' | 'preparando' | 'saiu_entrega' | 'entregue';

interface BotMessages {
  welcomeMessage: string;
  cardapioMessageTemplate: string;
  statusMessages?: Partial<Record<OrderStatusKey, string>>;
}

const STATUS_LABELS: Record<OrderStatusKey, string> = {
  recebido: 'Recebido',
  preparando: 'Preparando',
  saiu_entrega: 'Saiu para entrega',
  entregue: 'Entregue',
};

interface CardapioPreview {
  link: string;
  message: string;
}

export default function BotPage() {
  const [status, setStatus] = useState<BotStatus | null>(null);
  const [qrcode, setQrcode] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [backendOffline, setBackendOffline] = useState(false);
  const [pollQr, setPollQr] = useState(false);
  const [messages, setMessages] = useState<BotMessages | null>(null);
  const [cardapioPreview, setCardapioPreview] = useState<CardapioPreview | null>(null);
  const [savingMessages, setSavingMessages] = useState(false);
  const [messagesForm, setMessagesForm] = useState<{
    welcomeMessage: string;
    cardapioMessageTemplate: string;
    statusMessages: Partial<Record<OrderStatusKey, string>>;
  }>({
    welcomeMessage: '',
    cardapioMessageTemplate: '',
    statusMessages: {},
  });
  const [publicBaseUrl, setPublicBaseUrl] = useState('');
  const [savingUrl, setSavingUrl] = useState(false);

  const loadStatus = useCallback(async () => {
    try {
      const data = await api.get<BotStatus>('/bot/status');
      setStatus(data);
      setBackendOffline(false);
      return data;
    } catch (e) {
      if (e instanceof BackendOfflineError) setBackendOffline(true);
      setStatus(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  const loadMessagesAndPreview = useCallback(async () => {
    try {
      const origin = typeof window !== 'undefined' ? window.location.origin : '';
      const [botRes, msgRes] = await Promise.all([
        api.get<{ publicBaseUrl?: string }>('/config/bot').catch(() => null),
        api.get<BotMessages>('/config/bot-messages').catch(() => null),
      ]);
      const baseForPreview = (botRes?.publicBaseUrl && botRes.publicBaseUrl.trim()) || origin;
      if (botRes?.publicBaseUrl !== undefined) setPublicBaseUrl(botRes.publicBaseUrl || '');
      else if (origin) setPublicBaseUrl(origin);
      const previewRes = await api.get<CardapioPreview>(`/config/bot-cardapio-preview?baseUrl=${encodeURIComponent(baseForPreview)}`).catch(() => null);
      if (previewRes) setCardapioPreview(previewRes);
      if (msgRes) {
        setMessages(msgRes);
        setMessagesForm({
          welcomeMessage: msgRes.welcomeMessage,
          cardapioMessageTemplate: msgRes.cardapioMessageTemplate,
          statusMessages: msgRes.statusMessages ?? {},
        });
      }
    } catch {
      // ignore
    }
  }, []);

  const loadPreviewWithUrl = useCallback((baseUrl: string) => {
    if (!baseUrl) return;
    api
      .get<CardapioPreview>(`/config/bot-cardapio-preview?baseUrl=${encodeURIComponent(baseUrl)}`)
      .then(setCardapioPreview)
      .catch(() => {});
  }, []);

  const handleSavePublicUrl = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingUrl(true);
    try {
      await api.put('/config/bot', { publicBaseUrl: publicBaseUrl.trim() || undefined });
      loadPreviewWithUrl(publicBaseUrl.trim() || (typeof window !== 'undefined' ? window.location.origin : ''));
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setSavingUrl(false);
    }
  };

  useEffect(() => {
    if (!loading && !backendOffline) loadMessagesAndPreview();
  }, [loading, backendOffline, loadMessagesAndPreview]);

  useEffect(() => {
    if (!pollQr || !status?.configured) return;
    const t = setInterval(async () => {
      const s = await api.get<BotStatus>('/bot/status').catch(() => null);
      if (s?.connected) {
        setPollQr(false);
        setQrcode(null);
        setStatus(s);
        return;
      }
      const q = await api.get<BotQrCode>('/bot/qrcode').catch((): Partial<BotQrCode> => ({}));
      if (q && 'qrcode' in q && q.qrcode) setQrcode(q.qrcode);
    }, 2500);
    return () => clearInterval(t);
  }, [pollQr, status?.configured]);

  const handleConnect = async () => {
    setConnecting(true);
    setQrcode(null);
    try {
      const res = await api.post<BotQrCode & { ok?: boolean }>('/bot/connect', {});
      if (res && 'qrcode' in res && res.qrcode) setQrcode(res.qrcode);
      setPollQr(true);
      if (!res?.qrcode) {
        const q = await api.get<BotQrCode>('/bot/qrcode').catch((): Partial<BotQrCode> => ({}));
        if (q && 'qrcode' in q && q.qrcode) setQrcode(q.qrcode);
      }
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm('Desconectar o WhatsApp? Você precisará escanear o QR Code novamente para reconectar.')) return;
    setDisconnecting(true);
    try {
      await api.post('/bot/disconnect', {});
      await loadStatus();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setDisconnecting(false);
    }
  };

  const handleSaveMessages = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingMessages(true);
    try {
      const statusMessages: Partial<Record<OrderStatusKey, string>> = {};
      (Object.keys(STATUS_LABELS) as OrderStatusKey[]).forEach((k) => {
        const v = messagesForm.statusMessages?.[k]?.trim();
        if (v) statusMessages[k] = v;
      });
      await api.put('/config/bot-messages', {
        welcomeMessage: messagesForm.welcomeMessage.trim() || undefined,
        cardapioMessageTemplate: messagesForm.cardapioMessageTemplate.trim() || undefined,
        statusMessages: Object.keys(statusMessages).length ? statusMessages : undefined,
      });
      await loadMessagesAndPreview();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setSavingMessages(false);
    }
  };

  if (loading) {
    return <p className="text-gray-500">Carregando...</p>;
  }

  return (
    <div className="max-w-2xl space-y-8">
      {backendOffline && (
        <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-sm">
          <strong>Backend não está rodando.</strong> Use <code className="bg-amber-100 px-1 rounded">docker compose up -d</code> e acesse <a href="http://localhost:3100" className="underline">http://localhost:3100</a>.
        </div>
      )}

      <div>
        <div className="flex items-center gap-3 mb-2">
          <span className="flex w-10 h-10 rounded-xl bg-[#25D366]/10 text-[#25D366] items-center justify-center">
            <IconWhatsApp className="w-5 h-5" />
          </span>
          <h1 className="text-2xl font-bold text-gray-900">Bot WhatsApp</h1>
        </div>
        <p className="text-gray-600 mb-6">
          Conecte seu número ao Atendeaê. Com o Docker Compose, basta escanear o QR Code abaixo.
        </p>

        <div className="space-y-4">
          {status?.configured === false && (
            <div className="p-5 bg-gray-100 rounded-2xl border border-gray-200 text-gray-700">
              <p className="font-medium mb-2">Evolution API não configurada automaticamente.</p>
              <p className="text-sm mb-4">
                Rode o projeto com <code className="bg-gray-200 px-1 rounded">docker compose up -d</code>. O backend e a Evolution API sobem juntos e o webhook já fica configurado — você só precisa escanear o QR Code nesta página.
              </p>
              <p className="text-sm">
                Se você usa a Evolution em outro servidor, configure as variáveis <code className="bg-gray-200 px-1 rounded">EVOLUTION_API_URL</code> e <code className="bg-gray-200 px-1 rounded">EVOLUTION_API_KEY</code> no backend.
              </p>
            </div>
          )}

          {status?.configured === true && status?.connected === true && (
            <div className="p-5 bg-green-50 rounded-2xl border border-green-200 text-green-800 flex flex-wrap items-center justify-between gap-4 shadow-sm">
              <div>
                <p className="font-semibold flex items-center gap-2">
                  <span className="flex w-8 h-8 rounded-full bg-green-500 text-white items-center justify-center text-sm">✓</span> WhatsApp conectado
                </p>
                <p className="text-sm mt-1">O número está vinculado. As mensagens serão recebidas no Atendeaê.</p>
              </div>
              <button
                type="button"
                onClick={handleDisconnect}
                disabled={disconnecting}
                className="px-4 py-2 rounded-xl border border-red-300 bg-white text-red-700 font-medium hover:bg-red-50 disabled:opacity-50 inline-flex items-center gap-2 transition-all"
              >
                <IconLogout className="w-4 h-4" /> {disconnecting ? 'Desconectando...' : 'Desconectar'}
              </button>
            </div>
          )}

          {status?.configured === true && status?.connected !== true && (
            <div className="p-5 bg-white rounded-2xl border border-gray-200 shadow-sm">
              <p className="font-medium text-gray-800 mb-4">Conecte escaneando o QR Code com o WhatsApp no celular.</p>
              <button
                type="button"
                onClick={handleConnect}
                disabled={connecting}
                className="w-full py-3 px-4 bg-[#25D366] text-white rounded-xl font-medium hover:bg-[#20bd5a] disabled:opacity-50 inline-flex items-center justify-center gap-2 transition-all hover:shadow-lg"
              >
                <IconQrCode className="w-5 h-5" /> {connecting ? 'Gerando QR Code...' : 'Gerar QR Code'}
              </button>
              {qrcode && (
                <div className="mt-6 flex flex-col items-center">
                  {(qrcode.startsWith('data:image') || (qrcode.length > 400 && !qrcode.startsWith('CODE:'))) ? (
                    <img
                      src={qrcode.startsWith('data:') ? qrcode : `data:image/png;base64,${qrcode}`}
                      alt="QR Code WhatsApp"
                      className="w-64 h-64 object-contain border border-gray-200 rounded-lg"
                      width={256}
                      height={256}
                    />
                  ) : (
                    <QRCodeDisplay value={qrcode} />
                  )}
                  <p className="text-sm text-gray-500 mt-2">Abra o WhatsApp → Dispositivos vinculados → Vincular dispositivo</p>
                </div>
              )}
              {status?.error && (
                <p className="mt-3 text-sm text-amber-600">{status.error}</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Link e mensagem do cardápio */}
      {!backendOffline && (
        <section className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <IconLink className="w-5 h-5 text-primary-600" /> Link e mensagem do cardápio
          </h2>
          <p className="text-sm text-gray-600 mb-4">
            Configure a URL do site e a mensagem que o bot envia no WhatsApp quando o cliente pede o cardápio. Use <code className="bg-gray-100 px-1 rounded">{'{link}'}</code> no texto para inserir o link automaticamente.
          </p>

          <form onSubmit={handleSavePublicUrl} className="space-y-4">
            <div>
              <label htmlFor="publicBaseUrl" className="block text-sm font-medium text-gray-700 mb-1">URL do site</label>
              <div className="flex flex-wrap gap-3 items-end">
                <input
                  id="publicBaseUrl"
                  type="url"
                  value={publicBaseUrl}
                  onChange={(e) => setPublicBaseUrl(e.target.value)}
                  placeholder="https://seusite.com"
                  className="flex-1 min-w-[200px] px-3 py-2 border border-gray-300 rounded-lg text-gray-900"
                />
                <button
                  type="submit"
                  disabled={savingUrl}
                  className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
                >
                  {savingUrl ? 'Salvando…' : 'Salvar URL'}
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-1">URL pública onde o site está acessível (ex.: https://seusite.com)</p>
            </div>
          </form>

          <div className="mt-6 pt-6 border-t border-gray-200">
            <label htmlFor="cardapioMessageTemplateMain" className="block text-sm font-medium text-gray-700 mb-1">Mensagem que será enviada com o link</label>
            <textarea
              id="cardapioMessageTemplateMain"
              value={messagesForm.cardapioMessageTemplate}
              onChange={(e) => setMessagesForm((f) => ({ ...f, cardapioMessageTemplate: e.target.value }))}
              placeholder="Acesse nosso cardápio e faça seu pedido: {link}"
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 mb-2"
            />
            <p className="text-xs text-gray-500 mb-4">Use {'{link}'} onde quiser que o link do cardápio apareça.</p>

            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
              <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Preview (como o cliente verá no WhatsApp)</span>
              <div className="mt-2 p-3 bg-white rounded border border-gray-200 text-sm text-gray-700 whitespace-pre-wrap">
                {(messagesForm.cardapioMessageTemplate || 'Acesse nosso cardápio: {link}')
                  .replace(/\{link\}/g, cardapioPreview?.link || '[configure a URL acima e salve]')}
              </div>
            </div>

            <button
              type="button"
              onClick={() => handleSaveMessages({ preventDefault: () => {} } as React.FormEvent)}
              disabled={savingMessages}
              className="mt-4 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
            >
              {savingMessages ? 'Salvando…' : 'Salvar mensagem'}
            </button>
          </div>
        </section>
      )}

      {/* Mensagens do bot */}
      {!backendOffline && (
        <section className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <IconDocumentText className="w-5 h-5 text-primary-600" /> Mensagens do bot
          </h2>
          <p className="text-sm text-gray-600 mb-4">
            Mensagem de boas-vindas e textos enviados quando o status do pedido muda. A mensagem do cardápio fica na seção &quot;Link e mensagem do cardápio&quot; acima.
          </p>
          <form onSubmit={handleSaveMessages} className="space-y-4">
            <div>
              <label htmlFor="welcomeMessage" className="block text-sm font-medium text-gray-700 mb-1">Mensagem de boas-vindas</label>
              <textarea
                id="welcomeMessage"
                value={messagesForm.welcomeMessage}
                onChange={(e) => setMessagesForm((f) => ({ ...f, welcomeMessage: e.target.value }))}
                placeholder="Olá! Bem-vindo(a). Digite *cardápio* para receber o link."
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900"
              />
            </div>

            <div className="pt-4 border-t border-gray-200">
              <h3 className="text-sm font-semibold text-gray-800 mb-1">Mensagens de status do pedido</h3>
              <p className="text-sm text-gray-500 mb-3">
                Enviadas no WhatsApp quando o status do pedido muda. Use <code className="bg-gray-100 px-1 rounded">{'{customerName}'}</code>, <code className="bg-gray-100 px-1 rounded">{'{orderId}'}</code> e <code className="bg-gray-100 px-1 rounded">{'{link}'}</code> (link de acompanhamento).
              </p>
              {(Object.entries(STATUS_LABELS) as [OrderStatusKey, string][]).map(([key, label]) => (
                <div key={key} className="mb-3">
                  <label htmlFor={`status-${key}`} className="block text-sm font-medium text-gray-700 mb-1">
                    {label}
                  </label>
                  <textarea
                    id={`status-${key}`}
                    value={messagesForm.statusMessages?.[key] ?? ''}
                    onChange={(e) =>
                      setMessagesForm((f) => ({
                        ...f,
                        statusMessages: { ...f.statusMessages, [key]: e.target.value },
                      }))
                    }
                    placeholder={key === 'recebido' ? 'Olá, *{customerName}*! Recebemos seu pedido *#{orderId}*.' : undefined}
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900"
                  />
                </div>
              ))}
            </div>

            <button
              type="submit"
              disabled={savingMessages}
              className="px-4 py-2 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 disabled:opacity-50"
            >
              {savingMessages ? 'Salvando...' : 'Salvar mensagens'}
            </button>
          </form>
        </section>
      )}

      {/* Link do cardápio que o bot envia */}
      {!backendOffline && cardapioPreview && (
        <section className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <IconLink className="w-5 h-5 text-primary-600" /> Link do cardápio no WhatsApp
          </h2>
          <p className="text-sm text-gray-600 mb-4">
            Este é o link que o bot pode enviar ao cliente. A mensagem abaixo é a que será exibida (conforme configurada acima).
          </p>
          <div className="space-y-3">
            <div>
              <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Link</span>
              <div className="flex flex-wrap items-center gap-2 mt-1">
                <code className="flex-1 min-w-0 text-sm bg-gray-100 rounded-lg px-3 py-2 break-all text-gray-800">
                  {cardapioPreview.link || '—'}
                </code>
                <button
                  type="button"
                  onClick={() => {
                    if (cardapioPreview.link) navigator.clipboard?.writeText(cardapioPreview.link).then(() => alert('Link copiado!'));
                  }}
                  className="px-3 py-2 rounded-xl border border-gray-300 bg-white text-gray-700 text-sm font-medium hover:bg-gray-50 inline-flex items-center gap-1.5 transition-all"
                >
                  <IconCopy className="w-4 h-4" /> Copiar link
                </button>
              </div>
            </div>
            <div>
              <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Preview da mensagem</span>
              <div className="mt-1 p-3 bg-gray-50 rounded-lg text-sm text-gray-700 whitespace-pre-wrap">
                {cardapioPreview.message || '—'}
              </div>
              <button
                type="button"
                onClick={() => {
                  if (cardapioPreview.message) navigator.clipboard?.writeText(cardapioPreview.message).then(() => alert('Mensagem copiada!'));
                }}
                className="mt-2 px-3 py-1.5 rounded-xl border border-gray-300 bg-white text-gray-600 text-sm hover:bg-gray-50 inline-flex items-center gap-1.5"
              >
                <IconCopy className="w-3.5 h-3.5" /> Copiar mensagem
              </button>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
