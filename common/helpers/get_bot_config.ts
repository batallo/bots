import { GetParametersByPathCommand, SSMClient } from '@aws-sdk/client-ssm';

const SHARED_PATH = '/bot';
const MAX_PARAMS_PER_PAGE = 10; // hard API limit of GetParametersByPath

type ParamType = 'string' | 'number' | 'boolean';

/** A key without a default is mandatory, so a resolved config never has holes. */
interface ParamSpec {
  type: ParamType;
  default?: string | number | boolean;
}

type ConfigSchema = Readonly<Record<string, ParamSpec>>;

/**
 * Single source of truth for a bot: its name and where its parameters live.
 * Declare one with `satisfies BotConfigDefinition`, which keeps `type: 'number'`
 * a literal so BotConfigOf can read it - a bare object widens and mistypes every key.
 */
export interface BotConfigDefinition<S extends ConfigSchema = ConfigSchema> {
  /** Telegram @username of the bot, also its DynamoDB table name. */
  name: string;
  /** Path segment under /bot, e.g. 'moo_v' resolves to /bot/moo_v/<KEY>. */
  prefix: string;
  schema: S;
}

/** Keys every bot gets: /bot/MASTER_ID and /bot/<prefix>/BOT_TOKEN. */
const COMMON_SCHEMA = {
  MASTER_ID: { type: 'number' },
  BOT_TOKEN: { type: 'string' }
} as const satisfies ConfigSchema;

type ValueOf<S extends ParamSpec> = S['type'] extends 'number' ? number : S['type'] extends 'boolean' ? boolean : string;
type ConfigOf<S extends ConfigSchema> = { [K in keyof S]: ValueOf<S[K]> };

/** BOT_NAME is the bot's identity, not a stored parameter - it comes from the definition. */
export type BaseBotConfig = { BOT_NAME: string } & ConfigOf<typeof COMMON_SCHEMA>;
export type BotConfigOf<D extends BotConfigDefinition> = BaseBotConfig & ConfigOf<D['schema']>;

type ResolvedConfig = Record<string, string | number | boolean>;

// Module scope, so a warm Lambda container never reads Parameter Store twice
const cachedConfig = new Map<string, ResolvedConfig>();
const ssmClient = new SSMClient({});

function forceType(value: string, type: ParamType) {
  if (type === 'number') {
    const parsed = Number(value);
    if (Number.isNaN(parsed)) throw new Error(`expected a number, got "${value}"`);
    return parsed;
  }

  if (type === 'boolean') {
    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'yes', 'on'].includes(normalized)) return true;
    if (['false', '0', 'no', 'off'].includes(normalized)) return false;
    throw new Error(`expected a boolean, got "${value}"`);
  }

  return value;
}

/** Environment values, e.g. a local .env. coveredByEnv: every mandatory key is present, so the store can be skipped. */
function readEnv(schema: ConfigSchema) {
  const values: Record<string, string> = {};
  let coveredByEnv = true;

  for (const [key, spec] of Object.entries(schema)) {
    const value = process.env[key];
    if (value !== undefined && value !== '') values[key] = value;
    else if (spec.default === undefined) coveredByEnv = false;
  }

  return { values, coveredByEnv };
}

async function fetchPath(path: string) {
  const values: Record<string, string> = {};
  let nextToken: string | undefined;

  do {
    const command = new GetParametersByPathCommand({
      Path: path,
      Recursive: false,
      WithDecryption: true,
      MaxResults: MAX_PARAMS_PER_PAGE,
      NextToken: nextToken
    });
    const response = await ssmClient.send(command);

    for (const parameter of response.Parameters ?? []) {
      const key = parameter.Name?.slice(path.length + 1);
      if (key) values[key] = parameter.Value ?? '';
    }

    nextToken = response.NextToken;
  } while (nextToken);

  return values;
}

function resolve(botPath: string, schema: ConfigSchema, rawValues: Record<string, string>) {
  const config: ResolvedConfig = {};
  const errors: string[] = [];

  for (const [key, spec] of Object.entries(schema)) {
    const rawValue = rawValues[key];

    if (rawValue === undefined || rawValue === '') {
      if (spec.default !== undefined) config[key] = spec.default;
      else errors.push(`${key} was not found in ${botPath}/${key}, ${SHARED_PATH}/${key} or process.env.${key}`);
      continue;
    }

    try {
      config[key] = forceType(rawValue, spec.type);
    } catch (err) {
      errors.push(`${key}: ${(err as Error).message}`);
    }
  }

  if (errors.length) throw new Error(`Invalid configuration for "${botPath}":\n - ${errors.join('\n - ')}`);

  return config;
}

/**
 * Resolves a bot's configuration from SSM Parameter Store,
 * reading /bot for the shared keys and /bot/<prefix> for its own.
 * The environment wins over both, and when it covers every
 * mandatory key Parameter Store is not called at all - that is the local debug path.
 * Cached for the life of the container: only a cold start costs an API call.
 */
export async function getBotConfig<D extends BotConfigDefinition>(definition: D): Promise<BotConfigOf<D>> {
  const cached = cachedConfig.get(definition.prefix);
  if (cached) return cached as BotConfigOf<D>;

  const botPath = `${SHARED_PATH}/${definition.prefix}`;
  const schema: ConfigSchema = { ...COMMON_SCHEMA, ...definition.schema };

  const { values: envValues, coveredByEnv } = readEnv(schema);

  let storeValues: Record<string, string> = {};
  if (!coveredByEnv) {
    const [sharedValues, botValues] = await Promise.all([fetchPath(SHARED_PATH), fetchPath(botPath)]);
    storeValues = { ...sharedValues, ...botValues };
  }

  const values = resolve(botPath, schema, { ...storeValues, ...envValues });
  // Merged in after validation, so the loader never looks for a BOT_NAME parameter
  const config = Object.freeze({ ...values, BOT_NAME: definition.name });
  cachedConfig.set(definition.prefix, config);

  // Key names only - the values include the bot token
  console.log(`[config] loaded ${botPath} from ${coveredByEnv ? 'the environment' : 'Parameter Store'}: ${Object.keys(config).join(', ')}`);
  if (!coveredByEnv && Object.keys(envValues).length) console.log(`[config] overridden by the environment: ${Object.keys(envValues).join(', ')}`);

  return config as BotConfigOf<D>;
}
