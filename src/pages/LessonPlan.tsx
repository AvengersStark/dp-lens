// The lesson plan for the one-week flipped unit: what happens before, during and after
// the live class, which DP Lens step each part uses, and what a reviewer does alone.

import { DesignNote } from '../components/DesignNote';
import { PageHead } from '../components/ui';
import { STAGE } from '../lib/stage';

interface Row {
  opensIn?: number;
  time: string;
  activity: string;
  app?: { label: string; href: string };
  teacher: string;
  alone: string;
}

const PHASES: { title: string; note: string; rows: Row[] }[] = [
  {
    title: 'Before class',
    note: 'At home, about 30 minutes.',
    rows: [
      {
        opensIn: 3,
        time: '20 min',
        activity: 'Unit Check pretest (form A or B)',
        app: { label: 'Pretest', href: '#/check/pre' },
        teacher: 'Nothing; the test gives no feedback.',
        alone: 'Take it, or skip it with the reviewer pass.',
      },
      {
        time: '10 min',
        activity: 'Watch the worked example and answer the six self-explanation questions',
        app: { label: 'Watch', href: '#/watch' },
        teacher: 'Discusses exported logs with learners; the error board opens in Milestone 3.',
        alone: 'Press Play; answer at least one question wrong on purpose.',
      },
    ],
  },
  {
    title: 'In class',
    note: 'Live 90-minute video class, small group.',
    rows: [
      {
        opensIn: 3,
        time: '0–10',
        activity: 'Argue about the most-missed self-explanation answers',
        app: { label: 'Teacher view', href: '#/teacher' },
        teacher: 'Shares the error board and the debrief plan; asks students to defend one choice.',
        alone: 'Open Teacher view, load the demo data, read the debrief plan.',
      },
      {
        time: '10–35',
        activity: 'Predict in pairs, in breakout rooms: one predicts, the other explains the reason before each Check; switch every cell',
        app: { label: 'Predict cells', href: '#/predict/table' },
        teacher: 'Visits rooms and listens for reasons, not numbers.',
        alone: 'Say your reason out loud before each Check. Make one mistake on purpose to see the feedback.',
      },
      {
        time: '35–50',
        activity: 'Forward-loop demo: everyone predicts in the chat which cell first reuses an item, then the loop runs',
        app: { label: 'Predict in one array', href: '#/predict/array' },
        teacher: 'Shares the screen and holds the reveal until every prediction is in.',
        alone: 'Do the experiment at the end of the step and predict before it runs.',
      },
      {
        time: '50–75',
        activity: 'Build the spec card alone',
        app: { label: 'Build', href: '#/build/table' },
        teacher: 'Asks learners to share their screen or export a log; joins students who are stuck. Logs are not streamed live.',
        alone: 'Put in at least one trap block on purpose and read where the card fails.',
      },
      {
        time: '75–90',
        activity: 'Each student states the spec card aloud, one sentence per slot',
        app: { label: 'Explain your spec card', href: '#/explain' },
        teacher: 'Calls on each student; asks “what does one cell mean?” when a sentence is vague.',
        alone: 'Write one sentence per slot, then compare with the reference card.',
      },
    ],
  },
  {
    title: 'After class',
    note: STAGE < 3 ? 'Milestone 2: about 50 minutes, including the optional contest problem.' : 'Homework, about 65 minutes.',
    rows: [
      {
        time: STAGE < 3 ? '20 min' : '35 min',
        activity: STAGE < 3 ? 'Write the table and one-array 0/1 versions. Complete knapsack opens in Milestone 3.' : 'Write the table version, the one-array version, then Build and Write the complete knapsack',
        app: { label: 'Write', href: '#/write/table' },
        teacher: 'Reads the Write runs that needed hint 3.',
        alone: 'In the one-array Write, try the forward loop first.',
      },
      {
        time: '25 min',
        activity: 'Solve Fruit Feast (USACO 2015 December, Gold) on the official judge, starting from a spec card',
        teacher: 'Collects judge verdicts.',
        alone: 'Optional; the problem link is on the unit path.',
      },
      {
        time: '5 min',
        activity: 'Three-sentence reflection on the hardest slot',
        app: { label: 'Reflect', href: '#/reflect' },
        teacher: 'Reads which slot each learner picked.',
        alone: 'Look at your own record, then write the three sentences.',
      },
    ],
  },
  {
    title: 'Later',
    note: 'No feedback.',
    rows: [
      {
        opensIn: 3,
        time: '20 min',
        activity: 'Unit Check posttest, the other form',
        app: { label: 'Posttest', href: '#/check/post' },
        teacher: 'Scores Explain, Debug and Design with the rubric on the teacher page; a second rater scores 30%.',
        alone: 'Take it to see the parallel form.',
      },
      {
        time: '2 weeks',
        activity: 'Delayed check: a new Design item and an unpublished USACO-style problem on hidden tests',
        teacher: 'Runs the delayed check.',
        alone: 'Not part of the prototype.',
      },
    ],
  },
];

export function LessonPlan() {
  return (
    <div class="page">
      <PageHead kicker="Learning experience" title="Lesson plan: a one-week flipped unit">
        Goal: the learner can formulate a knapsack-style DP for an unfamiliar problem and justify its evaluation order. Viewing happens at home; live time goes to prediction in pairs,
        debate and articulation; construction happens after class. The last column says what to do if you go through the unit alone, as a reviewer.
      </PageHead>
      <DesignNote id="lesson" />
      {STAGE === 2 && (
        <section class="card">
          <h2 class="card-title">Milestone 2: try the learning experience</h2>
          <p>Before class: Watch. In class: Predict, Build, and Explain. After class: Write and Reflect.</p>
          <p class="small">The full lesson below also shows the planned assessments. Pretest, posttest, complete knapsack, and Teacher view open in Milestone 3. For the first ten minutes of class now, discuss a learner’s Watch answer by screen sharing.</p>
          <p class="small">Reviewing alone? Turn on the reviewer pass on the Unit path to visit the released activities in any order. Try a wrong rule, repair it, then explain what changed.</p>
        </section>
      )}
      {PHASES.map((ph) => (
        <section key={ph.title} class="card lesson-phase">
          <div class="phase-head">
            <h2 class="card-title">{ph.title}</h2>
            <span class="small muted">{ph.note}</span>
          </div>
          <div class="svg-scroll">
            <table class="data lesson">
              <thead>
                <tr>
                  <th scope="col">Time</th>
                  <th scope="col">Learners</th>
                  <th scope="col">In DP Lens</th>
                  <th scope="col">Teacher</th>
                  <th scope="col">On your own</th>
                </tr>
              </thead>
              <tbody>
                {ph.rows.map((r) => (
                  <tr key={r.activity}>
                    <td class="nowrap">{r.time}</td>
                    <td>{r.activity}</td>
                    <td>{r.opensIn && r.opensIn > STAGE ? <span class="badge">Opens in Milestone {r.opensIn}</span> : r.app ? <a href={r.app.href}>{r.app.label}</a> : <span class="muted">—</span>}</td>
                    <td>{r.teacher}</td>
                    <td>{r.alone}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </div>
  );
}
