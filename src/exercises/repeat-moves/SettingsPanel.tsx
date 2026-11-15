import { RangeSlider, SegmentedControl, Slider, Switch } from '@mantine/core';
import Field from '../../components/exercise/SettingsField';
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

      <Field label="Moves per side" value={`${s.movesPerSide} (${s.movesPerSide * 2} in total)`}>
        <Slider
          aria-label="Moves per side"
          min={LIMITS.movesPerSide[0]}
          max={LIMITS.movesPerSide[1]}
          label={null}
          value={s.movesPerSide}
          onChange={(movesPerSide) => set({ movesPerSide })}
        />
      </Field>

      <Field label="Time to look before the moves" value={`${s.lookSeconds} s`}>
        <Slider
          aria-label="Seconds to look before the moves"
          min={LIMITS.lookSeconds[0]}
          max={LIMITS.lookSeconds[1]}
          label={null}
          value={s.lookSeconds}
          onChange={(lookSeconds) => set({ lookSeconds })}
        />
      </Field>

      <Field label="Time between moves" value={`${(s.moveMs / 1000).toFixed(2).replace(/0$/, '')} s`}>
        <Slider
          aria-label="Time between moves"
          min={LIMITS.moveMs[0]}
          max={LIMITS.moveMs[1]}
          step={250}
          label={null}
          value={s.moveMs}
          onChange={(moveMs) => set({ moveMs })}
        />
      </Field>

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

      <Field label="Side at the bottom">
        <SegmentedControl
          fullWidth
          size="xs"
          aria-label="Side at the bottom"
          value={s.side}
          onChange={(v) => set({ side: v as Side })}
          data={[
            { value: 'toMove', label: 'To move' },
            { value: 'white', label: 'White' },
            { value: 'black', label: 'Black' },
            { value: 'random', label: 'Random' },
          ]}
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
