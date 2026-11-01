// A collapsed "why it works this way" panel for reviewers. Hidden from learners.

import { DESIGN_NOTES, type NoteId } from '../lib/rationale';
import { useAppState } from '../lib/store';

export function DesignNote({ id }: { id: NoteId }) {
  const app = useAppState();
  if (!app.reviewer) return null;
  return (
    <details class="design-note">
      <summary>
        <span class="design-note-tag">For reviewers</span> Design note: which course principles this page puts into practice
      </summary>
      <ul>
        {DESIGN_NOTES[id].map((n) => (
          <li key={n.principle}>
            <b>{n.principle}.</b> {n.behavior}
          </li>
        ))}
      </ul>
    </details>
  );
}
