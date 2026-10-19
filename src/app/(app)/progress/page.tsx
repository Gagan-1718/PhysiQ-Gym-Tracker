'use client';

import { useState } from 'react';
import { Segmented } from '@/components/ui/Segmented';
import { Overview } from '@/components/progress/Overview';
import { Strength } from '@/components/progress/Strength';
import { Body } from '@/components/progress/Body';

type Tab = 'overview' | 'strength' | 'body';

export default function ProgressPage() {
  const [tab, setTab] = useState<Tab>('overview');
  return (
    <>
      <header className="pb-4 pt-4">
        <h1 className="text-large-title">Progress</h1>
      </header>
      <Segmented
        label="Progress view"
        value={tab}
        onChange={setTab}
        className="mb-5"
        options={[
          { value: 'overview', label: 'Overview' },
          { value: 'strength', label: 'Strength' },
          { value: 'body', label: 'Body' },
        ]}
      />
      {tab === 'overview' && <Overview />}
      {tab === 'strength' && <Strength />}
      {tab === 'body' && <Body />}
    </>
  );
}
