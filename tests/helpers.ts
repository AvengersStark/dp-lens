import { randomInstance } from '../src/lib/knapsack';
import { mulberry32 } from '../src/lib/rng';

export * from '../src/lib/knapsack';

/** A tiny random instance, small enough for exhaustive search. */
export function mulberry32Instance(seed: number) {
  return randomInstance(mulberry32(seed), { n: [1, 4], W: [0, 8], w: [1, 4], v: [1, 9] });
}
