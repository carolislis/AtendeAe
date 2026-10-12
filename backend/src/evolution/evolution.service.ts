import { Injectable } from '@nestjs/common';
import { ConfigService } from '../config/config.service';

interface EvolutionConfig {
  baseUrl: string;
  apiKey: string;
  instanceName: string;
}

export interface BotStatusDto {
  configured: boolean;
  connected?: boolean;
  instanceName?: string;
  state?: string;
  error?: string;
}

export interface BotQrCodeDto {
  configured: boolean;
  qrcode?: string;
  error?: string;
}

@Injectable()
export class EvolutionService {
  private lastQrByEstablishment = new Map<string, string>();

  constructor(private readonly config: ConfigService) {}

  setStoredQr(establishmentId: string, base64: string): void {
    this.lastQrByEstablishment.set(establishmentId, base64);
  }

  getStoredQr(establishmentId: string): string | null {
    return this.lastQrByEstablishment.get(establishmentId) ?? null;
  }

  clearStoredQr(establishmentId: string): void {
    this.lastQrByEstablishment.delete(establishmentId);
  }

  private getConfig(establishmentId: string): EvolutionConfig | null {
    const bot = this.config.getBot(establishmentId);
    // Usa config do estabelecimento; se vazio, fallback para variáveis de ambiente (comportamento anterior)
    const baseUrl = (bot.evolutionBaseUrl || process.env.EVOLUTION_API_URL || '').replace(/\/$/, '');
    const apiKey = bot.evolutionApiKey || process.env.EVOLUTION_API_KEY || '';
    if (!baseUrl || !apiKey) return null;
    return { baseUrl, apiKey, instanceName: bot.instanceName || `atendeae-${establishmentId}` };
  }

  private async evolutionFetch(establishmentId: string, path: string, options: RequestInit = {}): Promise<Response> {
    const cfg = this.getConfig(establishmentId);
    if (!cfg) throw new Error('Evolution API não configurada. Configure na aba Bot WhatsApp.');
    const url = `${cfg.baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
    return fetch(url, {
      ...options,
      headers: {
        apikey: cfg.apiKey,
        Authorization: `Bearer ${cfg.apiKey}`,
        'Content-Type': 'application/json',
        ...(options.headers as Record<string, string>),
      },
    });
  }

  private async evolutionFetchV1(establishmentId: string, path: string, options: RequestInit = {}): Promise<Response> {
    let res = await this.evolutionFetch(establishmentId, path, options);
    if (res.status === 404 && !path.startsWith('/v1')) {
      res = await this.evolutionFetch(establishmentId, `/v1${path.startsWith('/') ? path : `/${path}`}`, options);
    }
    return res;
  }

  private getInstanceName(establishmentId: string): string {
    return this.getConfig(establishmentId)?.instanceName || `atendeae-${establishmentId}`;
  }

  async ensureInstance(establishmentId: string): Promise<void> {
    const instanceName = this.getInstanceName(establishmentId);
    const res = await this.evolutionFetchV1(establishmentId, '/instance/create', {
      method: 'POST',
      body: JSON.stringify({
        instanceName,
        integration: 'WHATSAPP-BAILEYS',
        qrcode: true,
      }),
    });
    if (res.status === 201 || res.status === 200) return;
    const text = await res.text();
    const lower = text.toLowerCase();
    if (res.status === 409 || res.status === 403 || lower.includes('already exists') || lower.includes('already in use')) return;
    throw new Error(`Evolution: ${res.status} ${text}`);
  }

  async getConnectionState(establishmentId: string): Promise<{ state: string; instance?: { state?: string } }> {
    const instanceName = this.getInstanceName(establishmentId);
    const res = await this.evolutionFetchV1(establishmentId, `/instance/connectionState/${instanceName}`);
    if (!res.ok) {
      const t = await res.text();
      throw new Error(t || `Evolution ${res.status}`);
    }
    return res.json();
  }

  async connect(establishmentId: string): Promise<Record<string, unknown>> {
    await this.ensureInstance(establishmentId);
    const instanceName = this.getInstanceName(establishmentId);
    const getRes = await this.evolutionFetchV1(establishmentId, `/instance/connect/${instanceName}`, { method: 'GET' });
    if (getRes.ok) {
      try {
        return (await getRes.json()) as Record<string, unknown>;
      } catch {
        return {};
      }
    }
    const postRes = await this.evolutionFetchV1(establishmentId, '/instance/connect', {
      method: 'POST',
      body: JSON.stringify({ instanceName }),
    });
    if (!postRes.ok) {
      const t = await postRes.text();
      throw new Error(t || `Evolution connect ${postRes.status}`);
    }
    try {
      return (await postRes.json()) as Record<string, unknown>;
    } catch {
      return {};
    }
  }

  private extractBase64(obj: unknown): string | null {
    if (!obj || typeof obj !== 'object') return null;
    const o = obj as Record<string, unknown>;
    const data = o.data as Record<string, unknown> | undefined;
    const result = o.result as Record<string, unknown> | undefined;
    const base64 =
      (o.base64 as string) ?? (data?.base64 as string) ?? (result?.base64 as string) ?? (o.base64Image as string);
    if (base64 && typeof base64 === 'string') return base64;
    const code = (o.code as string) ?? (data?.code as string) ?? (result?.code as string);
    if (code && typeof code === 'string' && (code.startsWith('data:') || code.length > 100)) return code;
    const pairCode =
      (o.pairingCode as string) ?? (o.pairCode as string) ?? (data?.pairingCode as string) ?? (data?.pairCode as string);
    if (pairCode && typeof pairCode === 'string') return `CODE:${pairCode}`;
    const qr = (data?.qr as string) ?? (o.qr as string);
    if (qr && typeof qr === 'string') return qr;
    if (data && typeof data === 'object') {
      const fromData = this.extractBase64(data);
      if (fromData) return fromData;
    }
    return null;
  }

  async fetchInstance(establishmentId: string): Promise<Record<string, unknown>> {
    const instanceName = this.getInstanceName(establishmentId);
    const paths = [
      `/instance/fetchInstances?instanceName=${instanceName}`,
      `/instance/fetchInstance/${instanceName}`,
      `/instance/fetchInstances`,
    ];
    for (const p of paths) {
      const res = await this.evolutionFetchV1(establishmentId, p);
      if (!res.ok) continue;
      const data = await res.json();
      if (Array.isArray(data)) {
        const inst = data.find(
          (i: { instance?: string; instanceName?: string }) => (i?.instance ?? i?.instanceName) === instanceName,
        );
        return (inst as Record<string, unknown>) || {};
      }
      if (data && typeof data === 'object') return data as Record<string, unknown>;
    }
    return {};
  }

  async getStatus(establishmentId: string): Promise<BotStatusDto> {
    const cfg = this.getConfig(establishmentId);
    if (!cfg) return { configured: false };
    try {
      const data = await this.getConnectionState(establishmentId);
      const state = data?.instance?.state ?? data?.state ?? '';
      if (state === 'open') this.clearStoredQr(establishmentId);
      return {
        configured: true,
        connected: state === 'open',
        instanceName: cfg.instanceName,
        state: state || 'desconectado',
      };
    } catch (e) {
      const msg = (e as Error).message || '';
      if (msg.includes('404') || msg.includes('not found')) {
        return { configured: true, connected: false, instanceName: cfg.instanceName, state: 'inexistente' };
      }
      return { configured: true, connected: false, instanceName: cfg.instanceName, error: msg };
    }
  }

  async getQrCode(establishmentId: string): Promise<BotQrCodeDto> {
    const cfg = this.getConfig(establishmentId);
    if (!cfg) return { configured: false };
    const stored = this.getStoredQr(establishmentId);
    if (stored) {
      const qrcode =
        stored.startsWith('data:') || stored.startsWith('CODE:') ? stored : `data:image/png;base64,${stored}`;
      return { configured: true, qrcode };
    }
    try {
      let data: unknown = await this.fetchInstance(establishmentId);
      let base64 = this.extractBase64(data);
      if (!base64) {
        const instanceName = this.getInstanceName(establishmentId);
        const connectRes = await this.evolutionFetchV1(establishmentId, `/instance/connect/${instanceName}`, {
          method: 'GET',
        });
        if (connectRes.ok) {
          data = await connectRes.json();
          base64 = this.extractBase64(data);
        }
      }
      if (base64) {
        const qrcode =
          base64.startsWith('data:') || base64.startsWith('CODE:') ? base64 : `data:image/png;base64,${base64}`;
        return { configured: true, qrcode };
      }
      return { configured: true };
    } catch (e) {
      return { configured: true, error: (e as Error).message };
    }
  }

  async connectAndGetQr(establishmentId: string): Promise<BotQrCodeDto> {
    const cfg = this.getConfig(establishmentId);
    if (!cfg) return { configured: false };
    this.clearStoredQr(establishmentId);
    try {
      const connectBody = await this.connect(establishmentId);
      const base64 = this.extractBase64(connectBody);
      if (base64) {
        const qrcode =
          base64.startsWith('data:') || base64.startsWith('CODE:') ? base64 : `data:image/png;base64,${base64}`;
        this.setStoredQr(establishmentId, qrcode);
        return { configured: true, qrcode };
      }
      return { configured: true };
    } catch (e) {
      return { configured: true, error: (e as Error).message };
    }
  }

  private normalizePhone(phone: string): string {
    const digits = phone.replace(/\D/g, '');
    if (digits.length >= 10 && digits.length <= 11 && !digits.startsWith('55')) return '55' + digits;
    return digits.startsWith('55') ? digits : '55' + digits;
  }

  async sendTextMessage(establishmentId: string, phone: string, text: string): Promise<void> {
    const cfg = this.getConfig(establishmentId);
    if (!cfg) throw new Error('Evolution API não configurada. Configure na aba Bot WhatsApp.');
    const number = this.normalizePhone(phone);
    if (!number || number.length < 12) throw new Error('Número de telefone inválido.');
    const path = `/message/sendText/${cfg.instanceName}`;
    const res = await this.evolutionFetchV1(establishmentId, path, {
      method: 'POST',
      body: JSON.stringify({ number, text }),
    });
    if (!res.ok) {
      const t = await res.text();
      throw new Error(t || `Evolution sendText ${res.status}`);
    }
  }

  async disconnect(establishmentId: string): Promise<void> {
    const instanceName = this.getInstanceName(establishmentId);
    const paths = [
      { method: 'POST' as const, path: '/instance/logout', body: { instanceName } },
      { method: 'POST' as const, path: `/instance/logout/${instanceName}` },
      { method: 'DELETE' as const, path: `/instance/logout/${instanceName}` },
    ];
    let lastError: string | null = null;
    for (const { method, path, body } of paths) {
      try {
        const res = await this.evolutionFetchV1(establishmentId, path, {
          method,
          ...(body && { body: JSON.stringify(body) }),
        });
        if (res.ok) {
          this.clearStoredQr(establishmentId);
          return;
        }
        lastError = await res.text();
      } catch (e) {
        lastError = (e as Error).message;
      }
    }
    throw new Error(lastError || 'Falha ao desconectar');
  }
}
