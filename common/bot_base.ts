import axios from 'axios';
import type { TelegramSendParam, TelegramPollSettings, PreCheckoutQuery, Message } from './types';
import { DynamoDbBase } from './dynamo_base';
export class BaseBot {
  protected botName: string;
  protected dynamoDbClient: DynamoDbBase;
  private botToken: string;
  private telegramUrl: string;

  constructor(botName: string, botToken: string) {
    this.botName = botName;
    this.botToken = botToken;
    this.dynamoDbClient = new DynamoDbBase(botName);
    this.telegramUrl = `https://api.telegram.org/bot${this.botToken}`;
  }

  isMasterUser(chat_id: number) {
    const masterUserId = parseInt(process.env.MASTER_ID as string);
    return [masterUserId].includes(chat_id);
  }

  isCommand(input: string) {
    return input.match(/^\//);
  }

  isStartCommand(input = '') {
    const startRegExp = new RegExp(`^/start(@${this.botName})?$`);
    return startRegExp.test(input);
  }

  isMenuCommand(input = '') {
    const startRegExp = new RegExp(`^/menu(@${this.botName})?$`);
    return startRegExp.test(input);
  }

  async sendToTelegram(chatId: number, message: string, options?: TelegramSendParam) {
    const urlEnding = options?.updateMessageId ? 'editMessageText' : 'sendMessage';
    if (options?.inlineKeyboard) console.log('Keyboard props:', options.inlineKeyboard);

    const response = await axios
      .post(`${this.telegramUrl}/${urlEnding}`, {
        chat_id: chatId,
        message_id: options?.updateMessageId,
        text: message,
        parse_mode: options?.parseMode ?? 'HTML',
        link_preview_options: options?.link_preview_options,
        reply_markup: { inline_keyboard: options?.inlineKeyboard }
      })
      .catch(err => {
        const errorNotice = '-=ERROR ********** ERROR=-';
        console.error(errorNotice + '\n' + JSON.stringify(err.response.data) + '\n' + errorNotice);
        throw new Error(err);
      });
    return response?.data;
  }

  async sendToTelegramPoll(chatId: number, pollQuestion: string, pollOptions: string[], settings?: TelegramPollSettings) {
    const response = await axios
      .post(`${this.telegramUrl}/sendPoll`, {
        chat_id: chatId,
        question: pollQuestion,
        options: pollOptions,
        ...settings
      })
      .catch(err => {
        const errorNotice = '-=ERROR ********** ERROR=-';
        console.error(errorNotice + '\n' + err.response.data + '\n' + errorNotice);
        throw new Error(err);
      });
    return response?.data;
  }

  async deleteTelegramMessage(chatId: number, messageId: number) {
    const response = await axios
      .post(`${this.telegramUrl}/deleteMessage`, {
        chat_id: chatId,
        message_id: messageId
      })
      .catch(err => {
        const errorNotice = '-=ERROR ********** ERROR=-';
        console.error(errorNotice + '\n' + err.response.data + '\n' + errorNotice);
        throw new Error(err);
      });
    return response?.data;
  }

  private async getTelegramGroupAdmins(chatId: number) {
    const response = await axios
      .post(`${this.telegramUrl}/getChatAdministrators`, {
        chat_id: chatId
      })
      .catch(err => {
        const errorNotice = '-=ERROR ********** ERROR=-';
        console.error(errorNotice + '\n' + err.response.data + '\n' + errorNotice);
        throw new Error(err);
      });
    return response?.data;
  }

  async isUserAdmin(chatId: number, userId: number) {
    const admins = await this.getTelegramGroupAdmins(chatId);
    if (!admins?.ok) return await this.sendToTelegram(chatId, 'I cannot start the vote until I would be granted an admin role');
    const isAdmin = admins?.result?.some((admin: Record<'user', Record<'id', number>>) => admin.user.id == userId) ?? false;
    return isAdmin;
  }

  private async getBotStars() {
    const response = await axios.post(`${this.telegramUrl}/getMyStarBalance`).catch(err => {
      const errorNotice = '-=ERROR ********** ERROR=-';
      console.error(errorNotice + '\n' + err.response.data + '\n' + errorNotice);
      throw new Error(err);
    });
    return response?.data;
  }

  async sendStarBalance(chatId: number, options?: TelegramSendParam) {
    const starsResponse = await this.getBotStars();
    const stars = starsResponse?.result?.amount;
    const message = `Current <b>${this.botName}</b> stars balance: <b>${stars ? stars + '⭐️' : 0}</b>`;
    await this.sendToTelegram(chatId, message, options);
    return starsResponse;
  }

  async handlePreCheckout(pre_checkout_query: PreCheckoutQuery) {
    const errorNotice = '-=ERROR ********** ERROR=-';
    const pre_checkout_query_id = pre_checkout_query.id;
    console.log('Donation Id:', JSON.stringify(pre_checkout_query));

    try {
      const url = `${this.telegramUrl}/answerPreCheckoutQuery`;
      const response = await axios.post(url, { pre_checkout_query_id, ok: true });

      if (response.data.ok) {
        console.log('✅ Pre-checkout approved successfully');
      } else {
        console.error(errorNotice + '\n' + '❌ Telegram rejected the approval:', response.data.description);
      }
    } catch (error: any) {
      console.error(errorNotice + '\n' + '❌ Axios error during pre-checkout:', error.response?.data || error.message);
    }
  }

  async handleSuccessfulPayment(innerValue: Message, masterUserId?: number) {
    const { chat, from, successful_payment } = innerValue;
    if (!successful_payment) {
      await this.sendToTelegram(chat.id, 'Something went wrong. Please reach out to bot owner');
      throw new Error('Issue with handling successful payment');
    }
    const { total_amount: amount, invoice_payload: tier } = successful_payment;

    console.log(`💰 Star Receipt: ${amount} from ${innerValue?.from?.id} for ${tier}`);

    const fullName = [from?.first_name, from?.last_name].filter(Boolean).join(' ');
    const displayName = fullName || (from?.username ? `@${from.username}` : tier);
    const userMessage = `🍿 Thank you, <b>${displayName}!</b> 🍿\nYour <b>⭐️${amount} Stars</b> are fueling the servers.`;

    await this.sendToTelegram(chat.id, userMessage);
    if (masterUserId) {
      await this.sendToTelegram(masterUserId, `<b>🌟 Donation:</b> ${amount} XTR from ${displayName}`);
    }
  }

  getRythme(input = '') {
    const glasnye = 'а|е|ё|и|о|у|ы|э|ю|я';
    const glasnyeInInput = input.match(new RegExp(glasnye, 'i'));
    if (!glasnyeInInput) return 'Не рифмуется';

    const letterMapper: Record<string, string> = {
      а: 'я',
      о: 'ё',
      у: 'ю',
      ы: 'и',
      э: 'е'
    };

    const firstGlasnaya = glasnyeInInput[0].toLowerCase();
    const toReplace = new RegExp(`[^${glasnye}]*[${glasnye}]`, 'i');
    const replacer = 'ху' + (letterMapper[firstGlasnaya] ?? firstGlasnaya);
    const output = input.replace(toReplace, replacer);
    return `${input} → ${output}`;
  }
}
