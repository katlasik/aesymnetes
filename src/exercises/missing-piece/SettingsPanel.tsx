import { RangeSlider, SegmentedControl, Slider, Switch } from '@mantine/core';
import Field from '../../components/exercise/SettingsField';
import type { Removable } from '../../lib/positions';
import { LIMITS, PRESETS, matchPreset, type PresetName, type Settings, type Side } from './settings';

export default function SettingsPanel(p: { settings: Settings; onChange: (s: Settings) => void }) {
  const s = p.settings;
  const set = (patch: Partial<Settings>) => p.onChange({ ...s, ...patch });
  const preset = matchPreset(s);

  return (
    <div className="ex-settings">
      <SegmentedControl
        fullWidth
        aria-label="Preset"
        value={preset}
        onChange={(v) => v !== 'custom' && p.onChange(PRESETS[v as PresetName])}
        data={[
          { value: 'easy', label: 'Easy' },
          { value: 'medium', label: 'Medium' },
          { value: 'hard', label: 'Hard' },
          { value: 'custom', label: 'Custom', disabled: preset !== 'custom' },
        ]}
      />

      <Field
        label="Pieces on the board"
        value={s.minPieces === s.maxPieces ? `${s.minPieces}` : `${s.minPieces} to ${s.maxPieces}`}
      >
        <RangeSlider
          aria-label="Pieces on the board"
          min={LIMITS.pieces[0]}
          max={LIMITS.pieces[1]}
          minRange={0}
          label={null}
          value={[s.minPieces, s.maxPieces]}
          onChange={([minPieces, maxPieces]) => set({ minPieces, maxPieces })}
        />
      </Field>

      <Field label="Time to memorise" value={`${s.memoriseSeconds} s`}>
        <Slider
          aria-label="Seconds to memorise"
          min={LIMITS.memoriseSeconds[0]}
          max={LIMITS.memoriseSeconds[1]}
          label={null}
          value={s.memoriseSeconds}
          onChange={(memoriseSeconds) => set({ memoriseSeconds })}
        />
      </Field>

      <Field label="Time to find the square" value={`${s.guessSeconds} s`}>
        <Slider
          aria-label="Seconds to find the square"
          min={LIMITS.guessSeconds[0]}
          max={LIMITS.guessSeconds[1]}
          label={null}
          value={s.guessSeconds}
          onChange={(guessSeconds) => set({ guessSeconds })}
        />
      </Field>

      <Field label="Board hidden before guessing" value={`${(s.maskMs / 1000).toFixed(1)} s`}>
        <Slider
          aria-label="Seconds the board is hidden"
          min={LIMITS.maskMs[0]}
          max={LIMITS.maskMs[1]}
          step={500}
          label={null}
          value={s.maskMs}
          onChange={(maskMs) => set({ maskMs })}
        />
      </Field>

      <Field label="Piece that can go missing">
        <SegmentedControl
          fullWidth
          size="xs"
          aria-label="Piece that can go missing"
          value={s.removable}
          onChange={(v) => set({ removable: v as Removable })}
          data={[
            { value: 'any', label: 'Any' },
            { value: 'pieces', label: 'No pawns' },
            { value: 'pawns', label: 'Pawns only' },
          ]}
        />
      </Field>

      <Field label="Side at the bottom">
        <SegmentedControl
          fullWidth
          size="xs"
          aria-label="Side at the bottom"
          value={s.side}
          onChange={(v) => set({ side: v as Side })}
          data={[
            { value: 'white', label: 'White' },
            { value: 'black', label: 'Black' },
            { value: 'random', label: 'Random' },
          ]}
        />
      </Field>

      <Field label="Tries at the square" value={`${s.attempts}`}>
        <Slider
          aria-label="Tries at the square"
          min={LIMITS.attempts[0]}
          max={LIMITS.attempts[1]}
          label={null}
          value={s.attempts}
          onChange={(attempts) => set({ attempts })}
        />
      </Field>

      <Field label="Positions per session" value={`${s.rounds}`}>
        <Slider
          aria-label="Positions per session"
          min={LIMITS.rounds[0]}
          max={LIMITS.rounds[1]}
          step={5}
          label={null}
          value={s.rounds}
          onChange={(rounds) => set({ rounds })}
        />
      </Field>

      <div className="ex-switches">
        <Switch
          label="Show coordinates"
          checked={s.coordinates}
          onChange={(e) => set({ coordinates: e.currentTarget.checked })}
        />
      </div>
    </div>
  );
}
