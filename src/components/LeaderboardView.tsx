import { useEffect, useState } from 'react';
import { Award, CheckCircle2, Clock, Play, RotateCcw, Users } from 'lucide-react';
import type { ClassroomState, TeamProgress } from '../types/game.ts';

interface LeaderboardViewProps {
  state: ClassroomState;
  connected: boolean;
  onStartCountdown: (sec: number) => void;
  onResetBoard: () => void;
}

export function formatDurationMs(ms: number | null): string {
  if (ms === null || ms < 0) return '—';
  const totalTenths = Math.floor(ms / 100);
  const tenths = totalTenths % 10;
  const totalSec = Math.floor(totalTenths / 10);
  const sec = totalSec % 60;
  const min = Math.floor(totalSec / 60);
  return `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}.${tenths}`;
}

function getStatusLabel(team: TeamProgress): {
  label: string;
  tone: 'idle' | 'ready' | 'playing' | 'finished';
} {
  switch (team.status) {
    case 'FINISHED':
      return { label: 'เสร็จสิ้น', tone: 'finished' };
    case 'PLAYING':
      return { label: `กำลังทำข้อ ${team.currentQ}/${team.totalQ}`, tone: 'playing' };
    case 'READY':
      return { label: 'เตรียมพร้อม', tone: 'ready' };
    default:
      return { label: 'ยังไม่เข้ากลุ่ม', tone: 'idle' };
  }
}

export function LeaderboardView({
  state,
  connected,
  onStartCountdown,
  onResetBoard,
}: LeaderboardViewProps) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (state.session.phase !== 'COUNTDOWN') return;
    const id = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(id);
  }, [state.session.phase]);

  const countdownRemaining =
    state.session.phase === 'COUNTDOWN' && state.session.countdownEndsAt
      ? Math.max(0, Math.ceil((state.session.countdownEndsAt - now) / 1000))
      : 0;

  const teams = Object.values(state.session.teams).sort((a, b) => {
    // Finished teams first, sorted by finalMs (including penalty), then finishOrder
    if (a.status === 'FINISHED' && b.status === 'FINISHED') {
      const timeDiff = (a.finalMs ?? 0) - (b.finalMs ?? 0);
      if (timeDiff !== 0) return timeDiff;
      return (a.finishOrder ?? 99) - (b.finishOrder ?? 99);
    }
    if (a.status === 'FINISHED') return -1;
    if (b.status === 'FINISHED') return 1;

    // Playing teams next, sorted by question progress desc, then wrongCount asc
    if (a.status === 'PLAYING' && b.status === 'PLAYING') {
      if (b.currentQ !== a.currentQ) return b.currentQ - a.currentQ;
      return a.wrongCount - b.wrongCount;
    }
    if (a.status === 'PLAYING') return -1;
    if (b.status === 'PLAYING') return 1;

    if (a.status === 'READY' && b.status !== 'READY') return -1;
    if (b.status === 'READY' && a.status !== 'READY') return 1;

    return a.groupId - b.groupId;
  });

  const finishedTeams = teams.filter((t) => t.status === 'FINISHED');
  const readyCount = teams.filter((t) => t.status === 'READY').length;
  const playingCount = teams.filter((t) => t.status === 'PLAYING').length;

  return (
    <section className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      <div className="flex flex-col gap-5 border-b border-[#D6DBD4] pb-6 lg:flex-row lg:items-end lg:justify-between dark:border-[#233B32]">
        <div>
          <p className="text-xs font-medium text-[#54665E] dark:text-[#9CB0A6]">
            กระดานอันดับกลางสำหรับขึ้นจอหน้าห้อง ·{' '}
            {connected ? 'ซิงก์ข้อมูลเรียลไทม์' : 'กำลังเชื่อมต่อเซิร์ฟเวอร์...'}
          </p>
          <h1 className="mt-1.5 text-2xl font-bold tracking-tight text-[#14201B] sm:text-3xl dark:text-[#ECF1EE]">
            ตารางคะแนนสด 7 กลุ่ม (กลุ่ม 3–9) — 《入住速递》
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-[#54665E] dark:text-[#9CB0A6]">
            <span>คำตะโกนจบเกม: <strong className="font-cn text-[#0F3D2E] dark:text-[#D4AF67]">{state.settings.shoutWord}</strong></span>
            <span aria-hidden="true">·</span>
            <span>พร้อม {readyCount} กลุ่ม</span>
            <span aria-hidden="true">·</span>
            <span>กำลังแข่ง {playingCount} กลุ่ม</span>
            <span aria-hidden="true">·</span>
            <span>เสร็จสิ้น {finishedTeams.length} กลุ่ม</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => onStartCountdown(3)}
            className="inline-flex items-center gap-2 rounded-lg bg-[#0F3D2E] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#14523E] dark:bg-[#D4AF67] dark:text-[#0A1612] dark:hover:bg-[#E2C281] whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Play className="h-4 w-4" />
            <span>นับถอยหลัง 3 วิ (开始!)</span>
          </button>

          <button
            type="button"
            onClick={onResetBoard}
            className="inline-flex items-center gap-2 rounded-lg border border-[#D6DBD4] bg-white px-4 py-2.5 text-sm font-medium text-[#14201B] transition-colors hover:bg-[#EAECE8] dark:border-[#233B32] dark:bg-[#11221C] dark:text-[#ECF1EE] dark:hover:bg-[#172B24] whitespace-nowrap shrink-0 cursor-pointer"
          >
            <RotateCcw className="h-4 w-4" />
            <span>รีเซ็ตรอบใหม่</span>
          </button>
        </div>
      </div>

      {state.session.phase === 'COUNTDOWN' && (
        <div className="mt-6 rounded-xl border border-[#B08D57] bg-[#0F3D2E] p-6 text-center text-white dark:bg-[#11221C]">
          <p className="text-sm font-medium text-[#D4AF67]">
            กำลังส่งสัญญาณเริ่มเกมพร้อมกันทุกกลุ่ม...
          </p>
          <p className="font-display mt-1 text-5xl font-bold tabular-nums">
            {countdownRemaining > 0 ? countdownRemaining : '开始!'}
          </p>
        </div>
      )}

      {finishedTeams.length > 0 && (
        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
          {finishedTeams.slice(0, 3).map((team, idx) => {
            const rankNum = idx + 1;
            const rankLabels = ['อันดับ 1 · ชนะเลิศ', 'อันดับ 2 · รองชนะเลิศอันดับ 1', 'อันดับ 3 · รองชนะเลิศอันดับ 2'];
            return (
              <div
                key={team.groupId}
                className={`rounded-xl border p-5 ${
                  rankNum === 1
                    ? 'border-[#B08D57] bg-white dark:border-[#D4AF67] dark:bg-[#11221C]'
                    : 'border-[#D6DBD4] bg-white dark:border-[#233B32] dark:bg-[#11221C]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[#B08D57] dark:text-[#D4AF67]">
                    {rankLabels[idx]}
                  </span>
                  <Award
                    className={`h-5 w-5 ${
                      rankNum === 1
                        ? 'text-[#B08D57] dark:text-[#D4AF67]'
                        : 'text-[#70827A] dark:text-[#9CB0A6]'
                    }`}
                  />
                </div>
                <p className="mt-2 text-xl font-bold text-[#14201B] dark:text-[#ECF1EE]">
                  กลุ่ม {team.groupId}
                </p>
                <div className="mt-3 flex items-baseline justify-between border-t border-[#EAECE8] pt-3 dark:border-[#1E362D]">
                  <span className="font-mono-num text-2xl font-bold text-[#0F3D2E] dark:text-[#D4AF67]">
                    {formatDurationMs(team.finalMs)}
                  </span>
                  <span className="text-xs text-[#54665E] dark:text-[#9CB0A6]">
                    ตอบผิด {team.wrongCount} ครั้ง
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-6 overflow-x-auto rounded-xl border border-[#D6DBD4] bg-white dark:border-[#233B32] dark:bg-[#11221C]">
        <table className="w-full min-w-[640px] border-collapse text-left">
          <thead>
            <tr className="border-b border-[#EAECE8] text-xs font-semibold text-[#54665E] dark:border-[#233B32] dark:text-[#9CB0A6]">
              <th className="px-5 py-3.5">อันดับ</th>
              <th className="px-5 py-3.5">กลุ่ม</th>
              <th className="px-5 py-3.5">สถานะ</th>
              <th className="px-5 py-3.5">ความคืบหน้า</th>
              <th className="px-5 py-3.5">ตอบผิด</th>
              <th className="px-5 py-3.5 text-right">เวลารวม</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#EAECE8] text-sm dark:divide-[#1E362D]">
            {teams.map((team, index) => {
              const info = getStatusLabel(team);
              const finishIndex =
                team.status === 'FINISHED'
                  ? finishedTeams.findIndex((f) => f.groupId === team.groupId) + 1
                  : null;

              return (
                <tr
                  key={team.groupId}
                  className="transition-colors hover:bg-[#F5F5F0]/70 dark:hover:bg-[#172B24]/60"
                >
                  <td className="font-mono-num px-5 py-4 font-semibold text-[#14201B] dark:text-[#ECF1EE]">
                    {finishIndex ? `#${finishIndex}` : `${index + 1}`}
                  </td>
                  <td className="px-5 py-4 font-semibold text-[#14201B] dark:text-[#ECF1EE]">
                    กลุ่ม {team.groupId}
                  </td>
                  <td className="px-5 py-4">
                    <span
                      className={`inline-flex items-center gap-1.5 font-medium ${
                        info.tone === 'finished'
                          ? 'text-[#15803D] dark:text-[#34D399]'
                          : info.tone === 'playing'
                            ? 'text-[#0F3D2E] dark:text-[#D4AF67]'
                            : info.tone === 'ready'
                              ? 'text-[#B08D57] dark:text-[#FBBF24]'
                              : 'text-[#70827A] dark:text-[#789085]'
                      }`}
                    >
                      {info.tone === 'finished' && <CheckCircle2 className="h-4 w-4" />}
                      {info.tone === 'playing' && <Clock className="h-4 w-4" />}
                      {info.tone === 'ready' && <Users className="h-4 w-4" />}
                      <span>{info.label}</span>
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="h-2 w-28 overflow-hidden rounded-full bg-[#EAECE8] dark:bg-[#1E362D]">
                        <div
                          className="h-full bg-[#0F3D2E] transition-all duration-300 dark:bg-[#D4AF67]"
                          style={{
                            width: `${
                              team.status === 'FINISHED'
                                ? 100
                                : team.status === 'PLAYING'
                                  ? Math.round(((team.currentQ - 1) / Math.max(1, team.totalQ)) * 100)
                                  : 0
                            }%`,
                          }}
                        />
                      </div>
                      <span className="font-mono-num text-xs text-[#54665E] dark:text-[#9CB0A6]">
                        {team.status === 'FINISHED'
                          ? `${team.totalQ}/${team.totalQ}`
                          : team.status === 'PLAYING'
                            ? `${team.currentQ}/${team.totalQ}`
                            : `0/${team.totalQ}`}
                      </span>
                    </div>
                  </td>
                  <td className="font-mono-num px-5 py-4 text-[#54665E] dark:text-[#9CB0A6]">
                    {team.wrongCount} ครั้ง
                  </td>
                  <td className="font-mono-num px-5 py-4 text-right font-semibold text-[#14201B] dark:text-[#ECF1EE]">
                    {formatDurationMs(team.finalMs)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
