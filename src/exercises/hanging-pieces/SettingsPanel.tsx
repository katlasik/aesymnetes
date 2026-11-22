import { RangeSlider, SegmentedControl, Slider, Switch } from '@mantine/core';
import Field from '../../components/exercise/SettingsField';
import { useT } from '../../i18n/react';
import { LIMITS, PRESETS, matchPreset, type PresetName, type Settings, type Side } from './settings';

export default function SettingsPanel(p: { settings: Settings; onChange: (s: Settings) => void }) {
  const t = useT();
  const s = p.settings;
  const set = (patch: Partial<Settings>) => p.onChange({ ...s, ...patch });
  const preset = matchPreset(s);

  return (
    <div className="ex-settings">
      <SegmentedControl
        fullWidth
        aria-label={t.common.preset}
        value={preset}
        onChange={(v) => v !== 'custom' && p.onChange(PRESETS[v as PresetName])}
        data={[
          { value: 'easy', label: t.common.presets.easy },
          { value: 'medium', label: t.common.presets.medium },
          { value: 'hard', label: t.common.presets.hard },
          { value: 'custom', label: t.common.presets.custom, disabled: preset !== 'custom' },
        ]}
      />

      <Field label={t.hangingPieces.settings.timePerPosition} value={t.common.seconds(s.seconds)}>
        <Slider
          aria-label={t.hangingPieces.settings.secondsPerPosition}
          min={LIMITS.seconds[0]}
          max={LIMITS.seconds[1]}
          step={5}
          label={null}
          value={s.seconds}
          onChange={(seconds) => set({ seconds })}
        />
      </Field>

      <Field label={t.common.piecesOnBoard} value={t.common.range(s.minPieces, s.maxPieces)}>
        <RangeSlider
          aria-label={t.common.piecesOnBoard}
          min={LIMITS.pieces[0]}
          max={LIMITS.pieces[1]}
          minRange={0}
          label={null}
          value={[s.minPieces, s.maxPieces]}
          onChange={([minPieces, maxPieces]) => set({ minPieces, maxPieces })}
        />
      </Field>

      <Field label={t.common.sideAtBottom}>
        <SegmentedControl
          fullWidth
          size="xs"
          aria-label={t.common.sideAtBottom}
          value={s.side}
          onChange={(v) => set({ side: v as Side })}
          data={[
            { value: 'toMove', label: t.hangingPieces.settings.toMove },
            { value: 'white', label: t.common.colors.white },
            { value: 'black', label: t.common.colors.black },
            { value: 'random', label: t.common.random },
          ]}
        />
      </Field>

      <Field label={t.common.positionsPerSession} value={`${s.rounds}`}>
        <Slider
          aria-label={t.common.positionsPerSession}
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
          label={t.common.showCoordinates}
          checked={s.coordinates}
          onChange={(e) => set({ coordinates: e.currentTarget.checked })}
        />
      </div>
    </div>
  );
}
