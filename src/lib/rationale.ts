// Design notes for reviewers: on each page, which course principle the page enacts and
// where to see it happen. Shown only with the reviewer pass on, so learners never see them.

export type NoteId = 'home' | 'watch' | 'predict' | 'predictArray' | 'build' | 'explain' | 'write' | 'reflect' | 'check' | 'teacher' | 'lesson';

export interface Note {
  /** The principle, with its source. */
  principle: string;
  /** What the page does because of it — something a reviewer can try. */
  behavior: string;
}

export const DESIGN_NOTES: Record<NoteId, Note[]> = {
  home: [
    {
      principle: 'Cognitive apprenticeship (Collins, Brown & Newman, 1989)',
      behavior: 'The path runs modeling (Watch), coaching and scaffolding (Predict, Build), fading (Write), articulation (Explain your spec card) and reflection (Reflect).',
    },
    {
      principle: 'Fading worked-example support (Renkl & Atkinson, 2003)',
      behavior: 'Each mode gives less: Watch shows every step, Predict hides one cell, Build hides the card, Write hides the rule. The dots on each step show the level.',
    },
    {
      principle: 'Distributed classroom (Joyner & Isbell, 2021)',
      behavior: 'Viewing happens before class, where replay helps; live time goes to pair prediction and debate, which need people.',
    },
  ],
  watch: [
    { principle: 'Worked examples (Sweller, van Merriënboer & Paas, 1998)', behavior: 'A solved table comes first, before any problem solving.' },
    { principle: 'Segmenting (Mayer, 2009)', behavior: 'One learner-paced cell per step: Back, Next, Play, and three speeds.' },
    { principle: 'Signaling (Mayer, 2009)', behavior: 'The cells a step reads are outlined and joined by “skip” and “take” arrows; the slot in use lights up on the spec card.' },
    { principle: 'Subgoal labels (Margulieux, Guzdial & Catrambone, 2012)', behavior: 'Every step carries the badge of its spec-card slot.' },
    { principle: 'Self-explanation (Chi et al., 1989)', behavior: 'Six pauses ask why a step works. Wrong reasons are coded and sent to the error board.' },
    { principle: 'Expertise reversal (Kalyuga et al., 2003)', behavior: 'A pretest Trace score of 3 or 4 offers to skip this step.' },
    { principle: 'Multiple representations (CAST, 2018)', behavior: 'Each step is shown as a table, a formula with numbers, and a plain sentence; key terms have hover definitions.' },
  ],
  predict: [
    { principle: 'Step-based tutoring (VanLehn, 2011)', behavior: 'The learner’s step is checked, not only an answer: the value and the dependency cells are judged separately.' },
    { principle: 'Predict before you see (Hundhausen, Douglas & Stasko, 2002)', behavior: 'The learner commits to a number before the cell is revealed, which brings the misconception out.' },
    { principle: 'Elaborated, error-specific feedback (Shute, 2008)', behavior: 'A wrong value is matched to a known error (current row, no weight subtracted, greedy, …) and explained in one or two sentences.' },
    { principle: 'Hints that fade', behavior: 'Hint 1 names the slot, hint 2 points at the cells, hint 3 gives the worked step; after hint 3 the cell does not count toward mastery.' },
    { principle: 'Mastery gate', behavior: 'Three cells in a row right on the first try, one of them a “take” cell, so always copying the cell above cannot pass.' },
    { principle: 'Engagement taxonomy (Naps et al., 2003)', behavior: 'This is the “responding” level: the learner answers questions about the visualization.' },
  ],
  predictArray: [
    { principle: 'Same as Predict, one array', behavior: 'The line under each cell lists the items that built its value, so the one-array state stays readable.' },
    { principle: 'Cognitive conflict through prediction (Hundhausen et al., 2002)', behavior: 'The experiment asks where the forward loop first reuses an item before it runs, then flags the reused item in red (1×2).' },
    { principle: 'Concept inventory target (Ferland et al., 2025)', behavior: 'The one-array form breaks three beliefs at once: a DP needs a 2D table, fills from the top left, and is just nested loops.' },
  ],
  build: [
    { principle: 'Parsons problems (Ericson, Margulieux & Rick, 2017)', behavior: 'The card is assembled from shuffled blocks; the distractors are real misconceptions, not random noise.' },
    { principle: 'Subgoal labels (Margulieux et al., 2012)', behavior: 'Each slot asks its own question; a block in the wrong slot is caught before anything runs.' },
    { principle: 'Judged by running, not by a key', behavior: 'The card runs on 66 instances. Valid alternatives pass (right-to-left rows, column order, an “exactly j” state), which targets the belief that tables fill from the top left (Ferland et al., 2025).' },
    { principle: 'Small counterexamples', behavior: 'The smallest failing instance is shown first, so the learner can check it by hand.' },
  ],
  explain: [
    { principle: 'Articulation (Collins et al., 1989)', behavior: 'The learner states each slot in words before seeing the reference card. In class this is said aloud.' },
    { principle: 'Self-assessment and metacognitive monitoring', behavior: 'After the reveal, the learner rates each slot against the reference; the ratings are logged.' },
  ],
  write: [
    { principle: 'Constructionism (Papert, 1980)', behavior: 'The learner builds a rule that actually runs, and debugs it against the table.' },
    { principle: 'Fading (Renkl & Atkinson, 2003)', behavior: 'State, base case and answer are given; only the transition and the order are the learner’s.' },
    { principle: 'Construct-irrelevant variance (Messick, 1995)', behavior: 'A small language-neutral notation keeps C++ and Java syntax errors out of the way; the palette inserts tokens.' },
    { principle: 'Feedback on the step that failed', behavior: 'From the wrong answer, the trace walks back to the first wrong cell whose inputs were all right, and names its slot.' },
  ],
  reflect: [
    { principle: 'Reflection (Collins et al., 1989)', behavior: 'The learner sees their own coded errors by slot before writing, so the reflection is grounded in evidence.' },
    { principle: 'Open learner model', behavior: 'The record shows the same codes the teacher sees on the error board.' },
  ],
  check: [
    { principle: 'Constructive alignment (Biggs, 1996)', behavior: 'All four parts use the spec card that the practice modes use.' },
    { principle: 'Revised taxonomy (Anderson & Krathwohl, 2001); trace–explain–write (Lopez et al., 2008)', behavior: 'Trace (Apply), Explain (Understand), Debug (Analyze), Design (Create).' },
    { principle: 'Validity (Messick, 1995)', behavior: 'An unseen problem in Design; answers in notation, pseudocode or prose, so recall and reading load do not decide the score.' },
    { principle: 'Reliability', behavior: 'Parallel forms A and B, counterbalanced by nickname across pretest and posttest; no feedback during the test.' },
  ],
  teacher: [
    { principle: 'Formative assessment (Black & Wiliam, 1998)', behavior: 'Coded errors from every mode are ranked, and the top three become the opening debrief.' },
    { principle: 'Teaching presence (Garrison, Anderson & Archer, 2000)', behavior: 'The board turns “I cannot see scratch work over video” into a concrete plan for the first ten minutes.' },
    { principle: 'Evaluation data (Paas, 1992)', behavior: 'The mental effort ratings collected after each mode are summarized here.' },
  ],
  lesson: [
    { principle: 'Cognitive apprenticeship (Collins et al., 1989)', behavior: 'Modeling at home, coaching in class, fading after class, with articulation and reflection built in.' },
    { principle: 'Zone of proximal development (Vygotsky, 1978)', behavior: 'Coaching is live because a partner or the teacher can answer the questions a rule-based tutor cannot.' },
    { principle: 'Community of inquiry (Garrison et al., 2000)', behavior: 'Cognitive presence in the loop-direction debate, social presence in the pair rule, teaching presence in the error-board debrief.' },
  ],
};
