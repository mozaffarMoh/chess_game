import { useState } from 'react';
import { sound } from '../utils/sound';

export default function SoundToggle() {
  const [muted, setMuted] = useState(() => sound.isMuted());

  const toggle = () => {
    const next = !muted;
    sound.setMuted(next);
    setMuted(next);
    // Confirm audibly when switching sound back on.
    if (!next) sound.play('move');
  };

  return (
    <button
      type="button"
      className={`icon-btn ${muted ? 'icon-btn--off' : ''}`}
      aria-pressed={!muted}
      aria-label={muted ? 'Unmute sounds' : 'Mute sounds'}
      title={muted ? 'Sound off' : 'Sound on'}
      onClick={toggle}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M11 5 6 9H2v6h4l5 4V5z" />
        {muted ? (
          <>
            <path d="m23 9-6 6" />
            <path d="m17 9 6 6" />
          </>
        ) : (
          <>
            <path d="M15.5 8.5a5 5 0 0 1 0 7" />
            <path d="M19 5a9 9 0 0 1 0 14" />
          </>
        )}
      </svg>
    </button>
  );
}
