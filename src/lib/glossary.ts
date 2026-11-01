// Short plain-English definitions shown on hover or focus. Learners read the problem
// statements in a second language, so key terms are defined where they appear.

export const GLOSSARY = {
  item: 'One thing you may pack. Item i has a weight w[i] and a value v[i].',
  weight: 'How much room an item takes in the knapsack.',
  value: 'How much an item is worth. We want the largest total value.',
  capacity: 'The most weight the knapsack can hold. The whole problem has capacity W; a cell dp[i][j] uses capacity j.',
  state: 'What one cell means, in words. For example: the best value using items 1..i with weight at most j.',
  base: 'Cells we know without any work, such as “no items, so no value”.',
  transition: 'The rule that builds a cell from cells filled earlier.',
  order: 'The order the loops fill cells in. Every cell a rule reads must already be filled.',
  answer: 'The cell (or cells) that hold the answer to the whole problem.',
  dependency: 'A cell that another cell reads. Arrows in the table show dependencies.',
  zeroOne: '0/1 knapsack: each item is either packed once (1) or not at all (0).',
  complete: 'Complete knapsack: each item may be packed any number of times.',
  oneArray: 'The same DP stored in a single row dp[0..W], overwritten once per item.',
  negInf: '−∞ marks an impossible cell, so that max(…) never picks it.',
} as const;

export type TermKey = keyof typeof GLOSSARY;
