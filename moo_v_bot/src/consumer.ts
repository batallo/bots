import { BotConfig, getBotConfig } from '../../common/helpers/get_bot_config';
import { StoredStreamingMovies } from '../types';
import { MooVBot } from './bot_moo_v';
import { MovieWaiters } from './producer';
import { Streaming } from './streaming';

interface Message {
  Records: {
    messageId: string;
    body: string;
    eventSource: 'aws:sqs' | 'manual';
    eventSourceARN: string;
    awsRegion: string;
  }[];
}

const streaming = new Streaming();
let cachedConfig: BotConfig;
let mooVBot: MooVBot;

export async function handler(message: Message) {
  if (!cachedConfig) {
    cachedConfig = await getBotConfig();
  }

  if (!mooVBot) {
    mooVBot = new MooVBot(cachedConfig.TOKEN_BOT_MOO_V);
  }

  const request: MovieWaiters[string][] = message.Records && message.Records.map(record => JSON.parse(record.body ?? '{}'));
  const response = {
    statusCode: 400,
    body: JSON.stringify('Error: Something went wrong with request')
  };

  if (!request || !request.every(r => r.link)) return response;

  console.log('Processing data:', request);

  for (const movie of request) {
    const { status, name } = await streaming.getMovieFullInfoByUrl(movie.link);
    console.log('Movie status:', status ?? 'Ready for watching!');
    if (status) continue;

    // Notify user in Telegram
    const sendTelegramItem = movie.users.map(user => {
      const message = `Congratulations! Movie from your list is available for watching!\n\n<b><a href="${movie.link}">${name}</a></b>`;
      return mooVBot.sendToTelegram(user, message);
    });

    await Promise.allSettled(sendTelegramItem);

    // Move movie from "await" list to "ready" list
    const movieDataToTransfer: StoredStreamingMovies = {
      [movie.id]: { title: movie.title, link: movie.link }
    };

    for (const user of movie.users) {
      await mooVBot.moveAwaitToReady(user, movieDataToTransfer);
    }

    console.log(`Summary: Processed movie "${name}". Notified ${movie.users.length} users.`);
  }
}
