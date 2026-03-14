type TelegramParseMode = 'HTML' | 'Markdown' | 'MarkdownV2';

export interface Message {
  message_id: number;
  chat: Chat;
  from?: User; // May be empty for messages sent to channels
  date: number;
  text?: string;
  entities?: MessageEntity[]; // For text messages, special entities like usernames, URLs, bot commands, etc. that appear in the text
  successful_payment?: SuccessfulPayment;
  reply_markup?: { inline_keyboard: Array<InlineKeyboard[]> };
  message_thread_id?: number;
  via_bot?: User;
}

interface Chat {
  id: number;
  type: 'private' | 'group' | 'supergroup' | 'channel';
  title?: string; // Title, for supergroups, channels and group chats
  username?: string;
  first_name?: string;
  last_name?: string;
  is_forum?: boolean; // True, if the supergroup chat is a forum (has topics enabled)
  is_direct_messages?: boolean; // True, if the chat is the direct messages chat of a channel
}
export interface User {
  id: number;
  is_bot: boolean;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string; // IETF language tag of the user's language [https://en.wikipedia.org/wiki/IETF_language_tag]
  is_premium?: boolean;
  added_to_attachment_menu?: boolean;
  can_join_groups?: boolean;
  can_read_all_group_messages?: boolean;
  supports_inline_queries?: boolean;
  can_connect_to_business?: boolean;
  has_main_web_app?: boolean;
  has_topics_enabled?: boolean;
  allows_users_to_create_topics?: boolean;
}

type MessageEntity = { offset: number; length: number } & (
  | {
      type:
        | 'mention'
        | 'hashtag'
        | 'cashtag'
        | 'bot_command'
        | 'url'
        | 'email'
        | 'phone_number'
        | 'bold'
        | 'italic'
        | 'underline'
        | 'strikethrough'
        | 'spoiler'
        | 'blockquote'
        | 'expandable_blockquote'
        | 'code';
    }
  | { type: 'text_link'; url: string }
  | { type: 'text_mention'; user: User }
  | { type: 'pre'; language: string }
  | { type: 'custom_emoji'; custom_emoji_id: string }
  | { type: 'date_time'; unix_time: string; date_time_format: string }
);

export interface SuccessfulPayment {
  currency: string; // 	Three-letter ISO 4217 currency code, or "XTR" for payments in Telegram Stars
  total_amount: number;
  invoice_payload: string;
  subscription_expiration_date?: number;
  is_recurring?: boolean;
  is_first_recurring?: boolean;
  shipping_option_id?: string;
  order_info?: Record<string, any>;
  telegram_payment_charge_id: string;
  provider_payment_charge_id: string;
}

export type InlineKeyboard = {
  text: string;
  style?: 'danger' | 'success' | 'primary';
} & (
  | { callback_data: string; url?: never }
  | { url: string; callback_data?: never } // Links tg://user?id=<user_id> can be used to mention a user by their identifier without using a username, if this is allowed by their privacy settings.
);

export interface TelegramSendParam {
  parseMode?: TelegramParseMode;
  updateMessageId?: number;
  inlineKeyboard?: Array<InlineKeyboard[]>;
  link_preview_options?: LinkPreviewOptions;
}

export interface LinkPreviewOptions {
  is_disabled?: boolean;
  url?: string; // If empty, then the first URL found in the message text will be used
  prefer_small_media?: boolean;
  prefer_large_media?: boolean;
  show_above_text?: boolean;
}

export interface TelegramPollSettings {
  is_anonymous?: boolean;
  allows_multiple_answers?: boolean;
  open_period?: number;
  close_date?: number;
}

export interface PollAnswer {
  poll_id: string;
  voter_chat?: Chat;
  user?: User;
  option_ids: number[];
}
export interface PreCheckoutQuery {
  id: string;
  from: User; // 	User who sent the query
  currency: string; // 	Three - letter ISO 4217 currency code, or "XTR" for payments in Telegram Stars
  total_amount: number;
  invoice_payload: string;
  shipping_option_id?: string;
  order_info?: any; // OrderInfo
}
