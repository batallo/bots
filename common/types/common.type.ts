type TelegramParseMode = 'HTML' | 'Markdown' | 'MarkdownV2';

export interface InlineKeyboard {
  text: string;
  callback_data: string;
}

export interface TelegramSendParam {
  parseMode?: TelegramParseMode;
  updateMessageId?: number;
  inlineKeyboard?: Array<InlineKeyboard[]>;
}

export interface TelegramPollSettings {
  is_anonymous?: boolean;
  allows_multiple_answers?: boolean;
  open_period?: number;
  close_date?: number;
}
