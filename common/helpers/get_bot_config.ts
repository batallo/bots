import axios from 'axios';

export interface BotConfig {
  MASTER_ID: number;
  MAX_MOVIE_COUNT?: number;
  MAX_MOVIE_QUERIES?: number;
  MAX_COUNT_FOR_SEND_MESSAGE_BATCH_COMMAND: number;
  SQS_MESSAGE_DELAY?: number;
  SQS_QUEUE_URL: string;
  STREAMING_URL: string;
  TOKEN_BOT_MOO_V: string;
}

export async function getBotConfig() {
  const url = process.env.MOO_V_BOT_CONFIG_URL as string;
  const config: BotConfig = (await axios.get(url))?.data;
  return config;
}
