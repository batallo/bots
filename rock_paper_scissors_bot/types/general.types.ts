import { rollOptions } from '../src';

export type RollOptions = (typeof rollOptions)[number];

export interface CallbackOption {
  roll: RollOptions;
  prev: number[];
}
