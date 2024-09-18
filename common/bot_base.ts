import axios from 'axios';
import { TelegramSendParam, TelegramPollSettings } from './types';
import { DynamoDbBase } from './dynamo_base';
export class BaseBot {
  protected botName: string;
  protected dynamoDbClient: DynamoDbBase;
  private botToken: string;

  constructor(botName: string, botToken: string) {
    this.botName = botName;
    this.botToken = botToken;
    this.dynamoDbClient = new DynamoDbBase(botName);
  }

  isCommand(input: string) {
    return input.match(/^\//);
  }

  isStartCommand(input: string) {
    const startRegExp = new RegExp(`^/start(@${this.botName})?$`);
    return startRegExp.test(input);
  }

  async sendToTelegram(chatId: number, message: string, options?: TelegramSendParam) {
    const urlEnding = options?.updateMessageId ? 'editMessageText' : 'sendMessage';
    const response = await axios
      .post(`https://api.telegram.org/bot${this.botToken}/${urlEnding}`, {
        chat_id: chatId,
        message_id: options?.updateMessageId,
        text: message,
        parse_mode: options?.parseMode ?? 'HTML',
        reply_markup: { inline_keyboard: options?.inlineKeyboard }
      })
      .catch(err => {
        const errorNotice = '-=ERROR ********** ERROR=-';
        console.error(errorNotice + '\n' + err.response.data + '\n' + errorNotice);
        throw new Error(err);
      });
    return response?.data;
  }

  async sendToTelegramPoll(chatId: number, pollQuestion: string, pollOptions: string[], settings?: TelegramPollSettings) {
    const response = await axios
      .post(`https://api.telegram.org/bot${this.botToken}/sendPoll`, {
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

  getRythme(input: string) {
    const glasnye = 'а|е|ё|и|о|у|ы|э|ю|я';
    const glasnyeInInput = input.match(new RegExp(glasnye));
    if (!glasnyeInInput) return 'Не рифмуется';

    const letterMapper: Record<string, string> = {
      а: 'я',
      о: 'ё',
      у: 'ю',
      ы: 'и',
      э: 'е'
    };

    const firstGlasnaya = glasnyeInInput[0];
    const toReplace = new RegExp(`[^${glasnye}]*[${glasnye}]`);
    const replacer = 'ху' + (letterMapper[firstGlasnaya] ?? firstGlasnaya);
    const output = input.replace(toReplace, replacer);
    return `${input} → ${output}`;
  }
}
