import { MooVBot } from './src';
import { UserSchema } from './types';

const mooVBot = new MooVBot(process.env.TOKEN_BOT_MOO_V as string);
const masterUserId = parseInt(process.env.MASTER_ID as string);

export async function handler(event: any) {
  const request = event.body && JSON.parse(event.body);
  const response = {
    statusCode: 400,
    body: JSON.stringify('Something went wrong with request')
  };

  if (!request) return response;

  const innerValue = request.message || request.callback_query?.message || request.channel_post;
  const pollAnswer = request.poll_answer;

  if (pollAnswer?.option_ids?.every((el: number) => el == 0)) {
    console.log('Received next Poll Answer: ', pollAnswer);
    const voteChat = (await mooVBot.getChatWithVote(pollAnswer.poll_id)).at(0);
    const userId: number = pollAnswer.user.id;
    if (voteChat) await mooVBot.addWatcher(voteChat, userId);
  }

  if (innerValue) {
    console.log('Received next Inner Value: ', innerValue);
    const chatId: number = innerValue.chat.id;
    const inputMessage: string = innerValue.text;
    const callbackData: string = request.callback_query?.data;

    const isPrivateChat = innerValue.chat.type == 'private';

    // TODO: consider sending userData into bot methods as parameter to avoid duplicating calls to db
    const knownData = await mooVBot.getItem<UserSchema>(chatId);
    const missingInDb = knownData == undefined;
    const inlineWaitsMovieInput = knownData?.waitForMovieInput;
    const inlineWaitsStreamingInput = knownData?.waitForStreamingInput;
    // TODO

    if (callbackData == 'inline_cancel') return await mooVBot.deleteTelegramMessage(chatId, innerValue.message_id);

    // GROUP CHAT
    if (!isPrivateChat) {
      const user: number = innerValue.from.id;
      const isAdmin = async () => await mooVBot.isUserAdmin(chatId, user);
      if (missingInDb) await mooVBot.addGroup(innerValue.chat);

      if (mooVBot.isStartCommand(inputMessage)) return await mooVBot.inlineMenuGroup(chatId); // TODO: update with some message
      if (mooVBot.isMenuCommand(inputMessage))
        return (await isAdmin())
          ? await mooVBot.inlineMenuGroup(chatId)
          : await mooVBot.sendToTelegram(chatId, 'Only Group Admins could start a vote', { updateMessageId: innerValue.message_id });

      if (callbackData == 'vote_watchers')
        await Promise.all([mooVBot.startVoteWatchers(chatId), mooVBot.deleteTelegramMessage(chatId, innerValue.message_id)]);

      if (callbackData == 'vote_movies')
        await Promise.all([mooVBot.startVoteMovies(chatId), mooVBot.deleteTelegramMessage(chatId, innerValue.message_id)]);
    }

    // PRIVATE CHAT
    if (isPrivateChat) {
      if (missingInDb) await mooVBot.addUser(innerValue.chat);

      if (mooVBot.isStartCommand(inputMessage) || mooVBot.isMenuCommand(inputMessage)) return await mooVBot.inlineMenuPrivate(chatId);

      if (callbackData == 'private_menu_streaming_cancel_search')
        return await mooVBot.inlineMenuPrivate(chatId, { updateMessageId: innerValue.message_id });

      if (callbackData == 'private_menu_list') return await mooVBot.inlineList(chatId, { updateMessageId: innerValue.message_id });

      if (callbackData == 'add_cancel') {
        await mooVBot.setWaitForMovieInput(chatId, 0);
        return await mooVBot.inlineList(chatId, { updateMessageId: innerValue.message_id });
      }

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

      if (callbackData == 'private_menu_streaming') {
        if (inlineWaitsStreamingInput) await mooVBot.setWaitForStreamingInput(chatId, 0);
        return await mooVBot.inlineMenuPrivateStreaming(chatId, { updateMessageId: innerValue.message_id });
      }
      if (callbackData == 'private_menu_streaming_search')
        return await mooVBot.inlineStreamingSearch(chatId, { updateMessageId: innerValue.message_id });

      if (/^\d+$/.test(callbackData)) {
        const movieId = +callbackData;
        return await mooVBot.inlineStreamingMovieData(chatId, movieId, { updateMessageId: innerValue.message_id });
      }

      if (inlineWaitsStreamingInput && inputMessage) {
        await mooVBot.deleteTelegramMessage(chatId, inlineWaitsStreamingInput);
        return await mooVBot.inlineStreamingSearchResult(chatId, inputMessage);
      }

      if (request.message && chatId == masterUserId) {
        const rythme = mooVBot.getRythme(inputMessage);
        return await mooVBot.sendToTelegram(chatId, rythme);
      }
    }
  }
}
