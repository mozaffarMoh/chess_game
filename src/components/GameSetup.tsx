import type { Color } from '../types/chess';
import type { Difficulty } from '../engine/ai';
import type { Mode } from '../hooks/useChessGame';

interface GameSetupProps {
  mode: Mode;
  difficulty: Difficulty;
  humanColor: Color;
  /** Changing any of these restarts the game, so warn once a game is underway. */
  dirty: boolean;
  onMode: (mode: Mode) => void;
  onDifficulty: (difficulty: Difficulty) => void;
  onColor: (color: Color) => void;
}

const DIFFICULTIES: { value: Difficulty; label: string; hint: string }[] = [
  { value: 'easy', label: 'Easy', hint: 'Looks one move ahead and often errs' },
  { value: 'medium', label: 'Medium', hint: 'Looks three moves ahead' },
  { value: 'hard', label: 'Hard', hint: 'Looks four moves ahead, plays its best' },
];

const COLORS: { value: Color; label: string }[] = [
  { value: 'w', label: 'White' },
  { value: 'b', label: 'Black' },
];

/** One row of the settings panel: a label beside a segmented control. */
interface RowProps<T extends string> {
  label: string;
  value: T;
  options: { value: T; label: string; hint?: string }[];
  onChange: (value: T) => void;
}

function SegmentedRow<T extends string>({ label, value, options, onChange }: RowProps<T>) {
  return (
    <div className="setup-row">
      <span className="setup-label" id={`setup-${label}`}>
        {label}
      </span>
      <div className="segmented" role="group" aria-labelledby={`setup-${label}`}>
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            title={option.hint}
            className={`segmented__item ${
              value === option.value ? 'segmented__item--on' : ''
            }`}
            aria-pressed={value === option.value}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function GameSetup({
  mode,
  difficulty,
  humanColor,
  dirty,
  onMode,
  onDifficulty,
  onColor,
}: GameSetupProps) {
  return (
    <div className="panel">
      <div className="panel__header">Opponent</div>

      <div className="flex flex-col gap-2.5 p-3">
        <SegmentedRow
          label="Play"
          value={mode}
          options={[
            { value: 'human', label: 'A friend' },
            { value: 'computer', label: 'Computer' },
          ]}
          onChange={onMode}
        />

        {mode === 'computer' && (
          <>
            <SegmentedRow
              label="Level"
              value={difficulty}
              options={DIFFICULTIES}
              onChange={onDifficulty}
            />
            <SegmentedRow
              label="You play"
              value={humanColor}
              options={COLORS}
              onChange={onColor}
            />
          </>
        )}

        {mode === 'computer' && dirty && (
          <p className="setup-note">Changing these starts a new game.</p>
        )}
      </div>
    </div>
  );
}
