import { SQSClient, SendMessageBatchCommand, SendMessageBatchRequestEntry } from '@aws-sdk/client-sqs';
import { BotConfig, getBotConfig } from '../../common/helpers/get_bot_config';
import { MooVBot } from './bot_moo_v';
import type { StoredStreamingMovies } from '../types';

const sqsClient = new SQSClient();

let cachedConfig: BotConfig;
let mooVBot: MooVBot;

export interface MovieWaiters {
  [movieId: string]: {
    id: number;
    link: string;
    title: string;
    users: number[];
  };
}

export async function handler() {
  if (!cachedConfig) {
    cachedConfig = await getBotConfig();
  }

  if (!mooVBot) {
    mooVBot = new MooVBot(cachedConfig.TOKEN_BOT_MOO_V);
  }

  const masterUserId = Number(cachedConfig.MASTER_ID);
  const maxCountForSendMessageBatchCommand = Number(cachedConfig.MAX_COUNT_FOR_SEND_MESSAGE_BATCH_COMMAND) || 10;
  const maxMovieQueries = Number(cachedConfig.MAX_MOVIE_QUERIES) || 50;
  const SQS_MESSAGE_DELAY = Number(cachedConfig.SQS_MESSAGE_DELAY) || 0;
  const SQS_QUEUE_URL = cachedConfig.SQS_QUEUE_URL;

  const movieWaiters: MovieWaiters = {};

  const chatsAwaitingForMovies = await mooVBot.getChatsAwaitingForMovies();
  chatsAwaitingForMovies.forEach(chat => {
    if (chat.deleted) return;
    Object.entries(chat.streaming.await).forEach(([id, movie]: [string, StoredStreamingMovies[number]]) => {
      if (movieWaiters[id]) {
        movieWaiters[id].users.push(chat.chat_id);
      } else {
        movieWaiters[id] = {
          id: Number(id),
          link: movie.link,
          title: movie.title,
          users: [chat.chat_id]
        };
      }
    });
  });

  const aggregatedSQSMessageData = Object.values(movieWaiters).map((movie, index) => ({
    Id: `msg_${Date.now()}_${index}`,
    MessageBody: JSON.stringify(movie),
    DelaySeconds: Math.min(index * SQS_MESSAGE_DELAY, 15 * 60) // delay between messages appearing in SQS with a maximum of 15 minutes
  }));

  if (masterUserId && aggregatedSQSMessageData.length >= +maxMovieQueries) {
    await mooVBot.sendToTelegram(masterUserId, `Maximum movie queries (<b>${maxMovieQueries} unique movies</b> in users' lists) reached.`);
  }

  const messages: Array<SendMessageBatchRequestEntry[]> = [];
  while (aggregatedSQSMessageData.length > 0) {
    messages.push(aggregatedSQSMessageData.splice(0, maxCountForSendMessageBatchCommand));
  }

  for (const singleMessage of messages) {
    const command = new SendMessageBatchCommand({
      QueueUrl: SQS_QUEUE_URL,
      Entries: singleMessage
    });

    try {
      const response = await sqsClient.send(command);

      if (response.Failed && response.Failed.length > 0) {
        console.error('Some messages in the batch failed:', response.Failed);
      }
    } catch (err) {
      console.error('The entire batch request failed:', err);
    }
  }

  return {
    statusCode: 200,
    body: JSON.stringify(movieWaiters),
    totalMovies: Object.keys(movieWaiters).length,
    totalUsers: chatsAwaitingForMovies.length
  };
}
