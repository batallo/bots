/**
 * Deploy gate: every bot must be able to load its whole config.
 * Runs the real loader, so this check cannot drift from runtime behaviour -
 * if it passes, the Lambdas can resolve every key in their schema.
 *
 * Usage: npm run check:config (after npm run build)
 */
import { MOO_V_CONFIG } from '../../moo_v_bot/config';
import { ROCK_PAPER_SCISSORS_CONFIG } from '../../rock_paper_scissors_bot/config';
import { getBotConfig, type BotConfigDefinition } from './get_bot_config';

const DEFINITIONS: BotConfigDefinition[] = [MOO_V_CONFIG, ROCK_PAPER_SCISSORS_CONFIG];

async function checkConfig() {
  const failures: string[] = [];

  for (const definition of DEFINITIONS) {
    try {
      const config = await getBotConfig(definition);
      console.log(`OK ${definition.name}: ${Object.keys(config).length} keys resolved from /bot/${definition.prefix}`);
    } catch (err) {
      failures.push((err as Error).message);
    }
  }

  if (failures.length) throw new Error(failures.join('\n\n'));
}

checkConfig().catch(err => {
  console.error(`\n${err.message}\n\nCreate the parameters above before deploying.`);
  process.exit(1);
});
