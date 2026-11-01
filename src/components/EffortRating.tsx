// The one-item mental effort rating (Paas, 1992) the evaluation plan collects after
// each mode. Optional and non-blocking.

import { useState } from 'preact/hooks';
import { logEvent } from '../lib/log';

export function EffortRating({ step }: { step: string }) {
  const [rating, setRating] = useState<number | null>(null);
  return (
    <div class="effort" role="group" aria-label="Mental effort rating">
      <p class="effort-q">How much mental effort did this step take you?</p>
      <div class="effort-scale">
        <span class="small muted">very, very low</span>
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((x) => (
          <button
            key={x}
            class={`effort-btn${rating === x ? ' on' : ''}`}
            aria-pressed={rating === x}
            onClick={() => {
              setRating(x);
              logEvent('effort', step, { rating: x });
            }}
          >
            {x}
          </button>
        ))}
        <span class="small muted">very, very high</span>
      </div>
      {rating !== null && <p class="small muted">Saved: {rating} of 9. Thank you.</p>}
    </div>
  );
}
