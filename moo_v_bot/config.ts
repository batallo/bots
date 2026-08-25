import type { BotConfigDefinition, BotConfigOf } from '../common/helpers/get_bot_config';

/**
 * Reads /bot/moo_v/<KEY>, on top of the shared /bot/<KEY>.
 * A key without a default is mandatory.
 **/
export const MOO_V_CONFIG = {
  name: 'moo_v_bot',
  prefix: 'moo_v',
  schema: {
    STREAMING_URL: { type: 'string' },
    STREAMING_SECRET_TOKEN: { type: 'string' },
    SQS_QUEUE_URL: { type: 'string' },
    MAX_MOVIE_COUNT: { type: 'number', default: 3 },
    MAX_MOVIE_QUERIES: { type: 'number', default: 50 },
    MAX_COUNT_FOR_SEND_MESSAGE_BATCH_COMMAND: { type: 'number', default: 10 },
    SQS_MESSAGE_DELAY: { type: 'number', default: 0 },
    DONATION_HEADER: { type: 'string' },
    DONATION_HEADER_ERROR: { type: 'string' },
    DONATION_STAR_URL_01: { type: 'string' },
    DONATION_STAR_URL_02: { type: 'string' },
    DONATION_STAR_URL_03: { type: 'string' },
    DONATION_STAR_URL_04: { type: 'string' },
    DONATION_WHOP_URL: { type: 'string' }
  }
} satisfies BotConfigDefinition;

export type MooVConfig = BotConfigOf<typeof MOO_V_CONFIG>;
