/**
 * Mensagem normalizada após o middleware: apenas mensagens de clientes reais,
 * pronta para o "cérebro" (n8n / Typebot) consumir.
 */
export interface IncomingMessageDto {
  /** Nome da instância Evolution que recebeu a mensagem */
  instance: string;
  /** JID do chat (ex: 5511999999999@s.whatsapp.net) */
  remoteJid: string;
  /** Número do cliente (sem sufixo @s.whatsapp.net), para uso em links ?u= */
  clientPhone: string;
  /** Nome de exibição (pushName) quando disponível */
  pushName?: string;
  /** Texto da mensagem (extraído de conversation ou extendedTextMessage.text) */
  text: string;
  /** Tipo de conteúdo: text | button | list | audio (para transcrição futura) */
  contentType: 'text' | 'button' | 'list' | 'audio' | 'image' | 'other';
  /** ID da mensagem na Evolution */
  messageId?: string;
  /** Timestamp da mensagem */
  messageTimestamp?: number;
  /** Se veio de grupo (útil para filtrar apenas DM) */
  isGroup: boolean;
}
