import axios from 'axios';
// import commands from './commands.json';

export class BaseBot {
  protected name: string;
  private botToken: string;
  // private listOfCommands: string[];

  constructor(name: string, botToken: string) {
    this.name = name;
    this.botToken = botToken;
    // this.listOfCommands = Object.keys(commands);
  }

  isCommand(input: string) {
    return input.match(/^\//);
  }

  isStartCommand(input: string) {
    return this.isCommand(input) && input == '/start'; //upd to include botname
  }

  async sendToTelegram(chatID: number, message: string, parseMode = 'HTML') {
    const response = await axios
      .post(`https://api.telegram.org/bot${this.botToken}/sendMessage`, {
        chat_id: chatID,
        text: message,
        parse_mode: parseMode
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
