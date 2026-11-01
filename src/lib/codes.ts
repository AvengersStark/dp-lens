// The misconception code book. Every logged error carries one of these codes, and the
// teacher's error board groups by them. Sources: the knapsack-specific errors seen in
// class, plus the DP misconceptions in Zehra et al. (2018) and Ferland et al. (2025).

export type Slot = 'state' | 'base' | 'transition' | 'order' | 'answer';

export const SLOTS: Slot[] = ['state', 'base', 'transition', 'order', 'answer'];

export const SLOT_LABEL: Record<Slot, string> = {
  state: 'State',
  base: 'Base case',
  transition: 'Transition',
  order: 'Evaluation order',
  answer: 'Answer',
};

export const SLOT_QUESTION: Record<Slot, string> = {
  state: 'What does one cell mean?',
  base: 'Which cells are known without any work?',
  transition: 'How is a cell built from earlier cells?',
  order: 'In what order are cells filled?',
  answer: 'Which cell holds the final answer?',
};

export type Code =
  | 'CURRENT_ROW'
  | 'NEG_CAPACITY'
  | 'ALWAYS_TAKE'
  | 'MISSING_TAKE'
  | 'NO_WEIGHT_SUBTRACT'
  | 'NEIGHBOR_COPY'
  | 'GREEDY_RATIO'
  | 'BASE_MISFIT'
  | 'UNSET_BASE'
  | 'READ_BEFORE_WRITE'
  | 'LOOP_FORWARD_01'
  | 'LOOP_BACKWARD_COMPLETE'
  | 'ANSWER_LOCATION'
  | 'STATE_KIND'
  | 'STATE_VAGUE'
  | 'INDEX_RANGE'
  | 'ORDER_TOP_LEFT'
  | 'TEMPLATE_RECALL'
  | 'WRONG_SLOT'
  | 'MISSING_DEP'
  | 'EXTRA_DEP'
  | 'ARITHMETIC'
  | 'OTHER';

export interface CodeInfo {
  label: string;
  slot: Slot | null;
  /** One plain sentence a teacher can read aloud in the debrief. */
  meaning: string;
}

export const CODES: Record<Code, CodeInfo> = {
  CURRENT_ROW: {
    label: 'Reads the current row',
    slot: 'transition',
    meaning: 'Takes item i from dp[i][j − w], which may already contain item i, so the item can be used twice.',
  },
  NEG_CAPACITY: {
    label: 'Negative capacity',
    slot: 'transition',
    meaning: 'Takes an item that does not fit, or reads dp at a capacity below 0.',
  },
  ALWAYS_TAKE: {
    label: 'Always takes the item',
    slot: 'transition',
    meaning: 'Takes the item whenever it fits, even when skipping it is worth more.',
  },
  MISSING_TAKE: {
    label: 'Forgets the take choice',
    slot: 'transition',
    meaning: 'Copies the cell above without checking whether taking the item is better.',
  },
  NO_WEIGHT_SUBTRACT: {
    label: 'Adds value, keeps capacity',
    slot: 'transition',
    meaning: 'Adds v[i] to dp[i − 1][j] without making room for the item’s weight.',
  },
  NEIGHBOR_COPY: {
    label: 'Copies a neighbor cell',
    slot: 'transition',
    meaning: 'Builds the cell from the left or diagonal neighbor, as in other DP templates.',
  },
  GREEDY_RATIO: {
    label: 'Greedy by value per weight',
    slot: 'transition',
    meaning: 'Picks items by best value-to-weight ratio, which fails when items cannot be split.',
  },
  BASE_MISFIT: {
    label: 'Base case does not fit the state',
    slot: 'base',
    meaning: 'The starting values disagree with the state, e.g. zeros for an “exactly j” state.',
  },
  UNSET_BASE: {
    label: 'Base case leaves cells empty',
    slot: 'base',
    meaning: 'A cell the transition needs is never set by the base case.',
  },
  READ_BEFORE_WRITE: {
    label: 'Reads a cell before it is filled',
    slot: 'order',
    meaning: 'The loop order asks for a cell that has not been computed yet.',
  },
  LOOP_FORWARD_01: {
    label: 'Forward loop in one-array 0/1',
    slot: 'order',
    meaning: 'Running j upward reads cells already updated for item i, so item i is reused.',
  },
  LOOP_BACKWARD_COMPLETE: {
    label: 'Backward loop in complete knapsack',
    slot: 'order',
    meaning: 'Running j downward never reads an updated cell, so an item can never be reused.',
  },
  ANSWER_LOCATION: {
    label: 'Answer read from the wrong cell',
    slot: 'answer',
    meaning: 'The final answer is taken from a cell that does not match the whole problem.',
  },
  STATE_KIND: {
    label: 'State allows the wrong reuse',
    slot: 'state',
    meaning: 'The state lets items repeat in a 0/1 problem, or forbids repeats in a complete one.',
  },
  STATE_VAGUE: {
    label: 'State too vague to check',
    slot: 'state',
    meaning: 'The state does not say which items are allowed or what the capacity index means.',
  },
  INDEX_RANGE: {
    label: 'Index out of range',
    slot: 'transition',
    meaning: 'Reads outside the table, for example swapping i and j or using item 0.',
  },
  ORDER_TOP_LEFT: {
    label: '“Tables fill from the top left”',
    slot: 'order',
    meaning: 'Believes a DP table can only be filled left to right, top to bottom.',
  },
  TEMPLATE_RECALL: {
    label: 'Template without meaning',
    slot: 'state',
    meaning: 'Gives a memorized rule (“the answer is bottom-right”) instead of the reason.',
  },
  WRONG_SLOT: {
    label: 'Block in the wrong slot',
    slot: null,
    meaning: 'Places a block in a slot it does not describe, e.g. a transition as a base case.',
  },
  MISSING_DEP: {
    label: 'Misses a dependency',
    slot: 'transition',
    meaning: 'Leaves out one of the cells the value depends on.',
  },
  EXTRA_DEP: {
    label: 'Extra dependency',
    slot: 'transition',
    meaning: 'Marks a cell the value does not depend on.',
  },
  ARITHMETIC: {
    label: 'Arithmetic slip',
    slot: null,
    meaning: 'The right cells, but the numbers do not add up.',
  },
  OTHER: {
    label: 'Unclassified',
    slot: null,
    meaning: 'An error that matches no code yet; worth reading by hand.',
  },
};
