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

    if (mooVBot.isStartCommand(inputMessage) && mooVBot.isGetListCommand(inputMessage)) await mooVBot.inlineList(chatId);
    if (callbackData == 'add_cancel') await mooVBot.inlineList(chatId, { updateMessageId: innerValue.message_id });
    if (callbackData == 'list_add') await mooVBot.inlineAdd(chatId, { updateMessageId: innerValue.message_id });
    if (callbackData == 'list_remove') await mooVBot.inlineRemove(chatId, { updateMessageId: innerValue.message_id });
    if (mooVBot.isRemoveMovieCommand(callbackData)) {
      const index = callbackData.match(/\d/)?.at(0);
      if (index != undefined) await mooVBot.removeMovie(chatId, index, { updateMessageId: innerValue.message_id });
    }
    if (callbackData == 'remove_cancel') await mooVBot.inlineList(chatId, { updateMessageId: innerValue.message_id });
    if (/^\/add/.test(innerValue)) await mooVBot.addMovie(chatId, innerValue, { updateMessageId: innerValue.message_id });
  }

  return { statusCode: 200 };
}
