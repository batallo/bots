import { BotConfig, getBotConfig } from '../../common/helpers/get_bot_config';
import { StoredStreamingMovies } from '../types';
import { MooVBot } from './bot_moo_v';
import { MovieWaiters } from './producer';
import { Streaming } from './streaming';

interface ConsumerMessage {
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

export async function handler(message: ConsumerMessage) {
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
    const { status, name, link } = await streaming.getMovieFullInfoByUrl(movie.link);
    const regExp = /ожидаем/i;
    console.log('Movie status:', regExp.test(status!) ? status : 'Ready for watching!');
    if (regExp.test(status!)) continue;

    const actualTitle = name ?? movie.title;
    const actualLink = link ?? movie.link;

    // Notify user in Telegram
    const sendTelegramItem = movie.users.map(user => {
      const message = `Congratulations! Movie from your list is available for watching!\n\n<b><a href="${actualLink}">${actualTitle}</a></b>`;
      return mooVBot.sendToTelegram(user, message);
    });

    await Promise.allSettled(sendTelegramItem);

    // Move movie from "await" list to "ready" list
    const movieDataToTransfer: StoredStreamingMovies = {
      [movie.id]: { title: mooVBot.trimMovieNameToLength(actualTitle), link: actualLink }
    };

    for (const user of movie.users) {
      await mooVBot.moveAwaitToReady(user, movieDataToTransfer);
    }

    console.log(`Summary: Processed movie "${actualTitle}". Notified ${movie.users.length} users.`);
  }
}
