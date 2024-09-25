import { BaseBot } from '../../common/bot_base';
import { CallbackOption, RollOptions } from '../types';
import { iconMapper, rollOptions } from './options';
import { InlineKeyboard } from '../../common/types';

export class RockPaperScissorsGameBot extends BaseBot {
  private options = rollOptions;

  constructor(token: string) {
    super('PlayRockPaperScissorsGameBot', token);
  }

  get randomOption() {
    const randomIndex = Math.floor(Math.random() * this.options.length);
    return this.options[randomIndex];
  }

  isStartGameCommand(input: string) {
    const startRegExp = new RegExp(`^/play(@${this.botName})?$`);
    return startRegExp.test(input);
  }

  private getRoundResult(playerInput: RollOptions = this.options[0]) {
    const randomOption = this.randomOption;
    let resultMessage = 'You Win';

    if (playerInput == randomOption) resultMessage = "It's a Draw";

    const playerOptionIndex = this.options.indexOf(playerInput);
    const randomOptionIndex = this.options.indexOf(randomOption);
    const gameResult = playerOptionIndex - randomOptionIndex;

    if (gameResult == -1 || gameResult == 2) resultMessage = 'You Loose';

    const roundResult = {
      currentRolls: [playerOptionIndex, randomOptionIndex],
      message: `<b>${playerInput}</b> vs <b>${randomOption}</b>: <u>${resultMessage}</u>`
    };

    return roundResult;
  }

  private formInlineKeyboardParams(currentResult: number[]) {
    const callbacks = this.options.map(option => {
      const callback = {
        roll: option,
        prev: currentResult
      };
      return JSON.stringify(callback);
    });

    const getByteSize = (callback: string) => new TextEncoder().encode(callback).length;
    const limitSize = 64;
    if (callbacks.some(callback => getByteSize(callback) > limitSize)) throw new Error('Could not form a callback due to size limitation');

    const resultParams = this.options.map((option, i) => {
      const param: InlineKeyboard = {
        text: `${option} ${iconMapper[option]}`,
        callback_data: callbacks[i]
      };
      return param;
    });

    return resultParams;
  }

  async firstRound(chatId: number) {
    return await this.playRound(chatId);
  }

  async playRound(chatId: number, messageId?: number, playerInput?: CallbackOption) {
    const baseMessage = `Let's play a classic <b>Rock - Paper - Scissors</b> game!`;

    const playerRoll = playerInput?.roll;
    const previousResults = playerInput?.prev;
    const roundResult = this.getRoundResult(playerRoll);

    if (previousResults?.every((el, i) => el == roundResult.currentRolls[i])) return;

    const message = messageId ? `${baseMessage}\n\n${roundResult.message}` : baseMessage;

    const inlineParams: InlineKeyboard[][] = [this.formInlineKeyboardParams(roundResult.currentRolls)];

    return await this.sendToTelegram(chatId, message, { inlineKeyboard: inlineParams, updateMessageId: messageId });
  }
}
