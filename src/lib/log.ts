// The event log: every self-explanation answer, prediction, card run and formula run,
// tagged with misconception codes. It stays in this browser until the learner exports
// it as a JSON file; the teacher page merges those files into the error board.

import type { Code } from './codes';
import { getState } from './store';

export type EventType =
  | 'session_start'
  | 'watch_step'
  | 'self_explain'
  | 'predict_submit'
  | 'predict_hint'
  | 'predict_mastery'
  | 'forward_predict'
  | 'build_run'
  | 'build_hint'
  | 'write_run'
  | 'write_hint'
  | 'test_submit'
  | 'effort'
  | 'articulate'
  | 'reflection'
  | 'step_done';

export interface LogEvent {
  t: number;
  type: EventType;
  step: string;
  codes: Code[];
  data: Record<string, unknown>;
}

export interface LogFile {
  app: 'dp-lens';
  version: 1;
  nickname: string;
  sessionId: string;
  exportedAt: string;
  demo?: boolean;
  events: LogEvent[];
}

const KEY = 'dplens.log.v1';
const MAX_EVENTS = 5000;

export function readLog(): LogEvent[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as LogEvent[]) : [];
  } catch {
    return [];
  }
}

export function logEvent(type: EventType, step: string, data: Record<string, unknown>, codes: Code[] = []): void {
  const events = readLog();
  events.push({ t: Date.now(), type, step, codes, data });
  try {
    localStorage.setItem(KEY, JSON.stringify(events.slice(-MAX_EVENTS)));
  } catch {
    // Storage full or blocked: the event is dropped, the lesson goes on.
  }
}

export function clearLog(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Nothing to clear.
  }
}

export function buildLogFile(): LogFile {
  const s = getState();
  return { app: 'dp-lens', version: 1, nickname: s.nickname, sessionId: s.sessionId, exportedAt: new Date().toISOString(), events: readLog() };
}

export function downloadLog(): void {
  const file = buildLogFile();
  const blob = new Blob([JSON.stringify(file, null, 1)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  const who = (file.nickname || 'learner').replace(/[^A-Za-z0-9_-]+/g, '_');
  a.download = `dplens-${who}-${file.exportedAt.slice(0, 10)}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export function parseLogFile(text: string): LogFile {
  const data = JSON.parse(text) as Partial<LogFile>;
  if (data.app !== 'dp-lens' || !Array.isArray(data.events)) throw new Error('This file is not a DP Lens log.');
  return {
    app: 'dp-lens',
    version: 1,
    nickname: String(data.nickname ?? 'unknown'),
    sessionId: String(data.sessionId ?? ''),
    exportedAt: String(data.exportedAt ?? ''),
    demo: !!data.demo,
    events: data.events as LogEvent[],
  };
}
