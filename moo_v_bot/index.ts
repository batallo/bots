import { MooVBot } from './src';

const mooVBot = new MooVBot(process.env.TOKEN_BOT_MOO_V as string);

export async function handler(event: any) {
  const request = event.body && JSON.parse(event.body);
  const response = {
    statusCode: 400,
    body: JSON.stringify('Something went wrong with request')
  };

  if (!request) return response;

  const innerValue = request.message || request.callback_query.message || request.channel_post;
  console.log('Received next Inner Value: ', innerValue);

  if (innerValue) {
    const chatId: number = innerValue.chat.id;
    const inputMessage: string = innerValue.text;
    const callbackData: string = request.callback_query?.data;

    //consider sending userData into bot methods as parameter to avoid duplicating calls to db
    const inlineWaitsMovieInput = await mooVBot.inlineWaitsMovieInput(chatId);
    //

    if (mooVBot.isStartCommand(inputMessage) || mooVBot.isGetListCommand(inputMessage)) return await mooVBot.inlineList(chatId);
    if (callbackData == 'add_cancel') return await mooVBot.inlineList(chatId, { updateMessageId: innerValue.message_id });
    if (callbackData == 'list_add') return await mooVBot.inlineAdd(chatId, { updateMessageId: innerValue.message_id });
    if (callbackData == 'list_remove') return await mooVBot.inlineRemove(chatId, { updateMessageId: innerValue.message_id });
    if (mooVBot.isRemoveMovieCommand(callbackData)) {
      const index = callbackData.match(/\d/)?.at(0) as string;
      await mooVBot.removeMovie(chatId, index, { updateMessageId: innerValue.message_id });
      return await mooVBot.inlineList(chatId);
    }
    if (callbackData == 'remove_cancel') return await mooVBot.inlineList(chatId, { updateMessageId: innerValue.message_id });
    if (inlineWaitsMovieInput && inputMessage) {
      await mooVBot.addMovie(chatId, inputMessage, { updateMessageId: inlineWaitsMovieInput });
      return await mooVBot.inlineList(chatId);
    }

    if (request.message) return mooVBot.getRythme(inputMessage);
  }
}
