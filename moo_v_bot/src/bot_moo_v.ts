import { BaseBot } from '../../common/bot_base';

export class MooVBot extends BaseBot {
  constructor(token: string) {
    super('moo_v_bot', token);
  }
}
