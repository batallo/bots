import { RockPaperScissorsGameBot } from './src';
import { CallbackOption } from './types';

const rockPaperScissorsBot = new RockPaperScissorsGameBot(process.env.TOKEN_BOT_ROCK_PAPER_SCISSORS as string);

export async function handler(event: any) {
  const request = event.body && JSON.parse(event.body);
  const errorResponse = {
    statusCode: 400,
    body: JSON.stringify('Something went wrong with request')
  };

  if (!request) return errorResponse;

  const callBack = request.callback_query;
  const innerMessage = request.message || request.channel_post || callBack?.message;

  const chatId: number = innerMessage?.chat.id;
  const messageText: string = innerMessage?.text;

  if (innerMessage) console.log('Received next Inner Message: ', innerMessage);

  if (rockPaperScissorsBot.isStartGameCommand(messageText)) await rockPaperScissorsBot.firstRound(chatId);

  if (callBack) {
    const playerInput: CallbackOption = JSON.parse(callBack?.data);
    const messageId = callBack.message?.message_id;

    await rockPaperScissorsBot.playRound(chatId, messageId, playerInput);
  }
}
