import { Moon, Sun } from 'lucide-react';

export type AppTab = 'play' | 'leaderboard' | 'vocab' | 'teacher';

interface TopBarProps {
  activeTab: AppTab;
  onSelectTab: (tab: AppTab) => void;
  isDark: boolean;
  onToggleTheme: () => void;
}

const NAV_ITEMS: { id: AppTab; label: string }[] = [
  { id: 'play', label: 'หน้าเล่นเกม' },
  { id: 'leaderboard', label: 'กระดานอันดับ' },
  { id: 'vocab', label: 'คลังคำศัพท์' },
  { id: 'teacher', label: 'ตั้งค่าผู้สอน' },
];

export function TopBar({
  activeTab,
  onSelectTab,
  isDark,
  onToggleTheme,
}: TopBarProps) {
  return (
    <header className="sticky top-0 z-30 border-b border-[#D6DBD4] bg-[#F5F5F0]/95 backdrop-blur-sm dark:border-[#233B32] dark:bg-[#0A1612]/95">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-8 px-4 py-3.5 sm:px-6">
        <button
          type="button"
          onClick={() => onSelectTab('play')}
          className="font-cn text-lg font-bold tracking-tight text-[#0F3D2E] transition-opacity hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#B08D57] dark:text-[#D4AF67] whitespace-nowrap shrink-0 cursor-pointer"
        >
          入住速递
        </button>

        <nav
          aria-label="เมนูหลัก"
          className="flex items-center gap-4 overflow-x-auto sm:gap-7"
        >
          {NAV_ITEMS.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectTab(item.id)}
                className={`relative py-1 text-sm font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#B08D57] ${
                  isActive
                    ? 'text-[#0F3D2E] dark:text-[#D4AF67]'
                    : 'text-[#54665E] hover:text-[#14201B] dark:text-[#9CB0A6] dark:hover:text-[#ECF1EE]'
                }`}
              >
                {item.label}
                {isActive && (
                  <span
                    aria-hidden="true"
                    className="absolute inset-x-0 -bottom-0.5 h-0.5 bg-[#0F3D2E] dark:bg-[#D4AF67]"
                  />
                )}
              </button>
            );
          })}
        </nav>

        <div className="shrink-0">
          <button
            type="button"
            onClick={onToggleTheme}
            aria-label={isDark ? 'เปลี่ยนเป็นโหมดสว่าง' : 'เปลี่ยนเป็นโหมดมืด'}
            className="inline-flex items-center gap-2 rounded-lg border border-[#D6DBD4] bg-white px-3.5 py-2 text-xs font-medium text-[#14201B] transition-colors hover:bg-[#EAECE8] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#B08D57] dark:border-[#233B32] dark:bg-[#11221C] dark:text-[#ECF1EE] dark:hover:bg-[#172B24] whitespace-nowrap shrink-0 cursor-pointer"
          >
            {isDark ? <Sun className="h-3.5 w-3.5 text-[#D4AF67]" /> : <Moon className="h-3.5 w-3.5 text-[#0F3D2E]" />}
            <span className="hidden sm:inline">{isDark ? 'โหมดสว่าง' : 'โหมดมืด'}</span>
          </button>
        </div>
      </div>
    </header>
  );
}
