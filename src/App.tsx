/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState } from 'react';
import { LeaderboardView } from './components/LeaderboardView.tsx';
import { PlayView } from './components/PlayView.tsx';
import { TeacherSettingsView } from './components/TeacherSettingsView.tsx';
import { TopBar, type AppTab } from './components/TopBar.tsx';
import { VocabView } from './components/VocabView.tsx';
import { useClassroomSync } from './hooks/useClassroomSync.ts';

export default function App() {
  const [activeTab, setActiveTab] = useState<AppTab>('play');
  const [isDark, setIsDark] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('ruzhu-theme') === 'dark';
  });

  const {
    state,
    connected,
    updateTeam,
    triggerTeacherStart,
    triggerTeacherReset,
    updateSettings,
    updateContent,
  } = useClassroomSync();

  useEffect(() => {
    const root = document.documentElement;
    if (isDark) {
      root.classList.add('dark');
      localStorage.setItem('ruzhu-theme', 'dark');
    } else {
      root.classList.remove('dark');
      localStorage.setItem('ruzhu-theme', 'light');
    }
  }, [isDark]);

  return (
    <div className="flex min-h-screen flex-col bg-[#F5F5F0] text-[#14201B] transition-colors dark:bg-[#0A1612] dark:text-[#ECF1EE]">
      <TopBar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        isDark={isDark}
        onToggleTheme={() => setIsDark((prev) => !prev)}
      />

      <main className="flex-1">
        {activeTab === 'play' && (
          <PlayView
            state={state}
            onUpdateTeam={updateTeam}
            onOpenLeaderboard={() => setActiveTab('leaderboard')}
          />
        )}

        {activeTab === 'leaderboard' && (
          <LeaderboardView
            state={state}
            connected={connected}
            onStartCountdown={triggerTeacherStart}
            onResetBoard={triggerTeacherReset}
          />
        )}

        {activeTab === 'vocab' && <VocabView vocab={state.vocab} />}

        {activeTab === 'teacher' && (
          <TeacherSettingsView
            state={state}
            onUpdateSettings={updateSettings}
            onUpdateContent={updateContent}
          />
        )}
      </main>

      <footer className="border-t border-[#D6DBD4] bg-[#F5F5F0] py-5 text-center text-xs text-[#54665E] dark:border-[#233B32] dark:bg-[#0A1612] dark:text-[#9CB0A6]">
        <div className="mx-auto max-w-6xl px-4">
          <span className="font-cn font-semibold">《入住速递》</span> · เช็คอินด่วนทันใจ · บทที่ 2 งานต้อนรับส่วนหน้า (ภาษาจีนธุรกิจงานบริการโรงแรม)
        </div>
      </footer>
    </div>
  );
}
