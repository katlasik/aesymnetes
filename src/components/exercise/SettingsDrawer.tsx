import type { ReactNode } from 'react';
import { Button, Drawer } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';

/** Settings in a side panel (from the bottom on phones), with the exercise's instructions on top. */
export default function SettingsDrawer(p: {
  opened: boolean;
  onClose: () => void;
  intro: string;
  best?: string;
  children: ReactNode;
}) {
  const isNarrow = useMediaQuery('(max-width: 899px)') ?? false;
  return (
    <Drawer
      opened={p.opened}
      onClose={p.onClose}
      position={isNarrow ? 'bottom' : 'right'}
      size={isNarrow ? '90%' : 'md'}
      title="Settings"
      classNames={{ title: 'ex-drawer-title' }}
    >
      <div className="ex-drawer-body">
        <p className="ex-lead">{p.intro}</p>
        {p.children}
        {p.best && <p className="ex-best">{p.best}</p>}
        <Button fullWidth onClick={p.onClose}>
          Done
        </Button>
      </div>
    </Drawer>
  );
}
