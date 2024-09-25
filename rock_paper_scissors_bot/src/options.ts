import { RollOptions } from '../types';

export const rollOptions = ['Rock', 'Paper', 'Scissors'] as const;

export const iconMapper: Record<RollOptions, string> = {
  Rock: '🪨',
  Paper: '📔',
  Scissors: '✂️'
};
