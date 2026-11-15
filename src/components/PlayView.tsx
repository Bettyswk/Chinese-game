import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Award,
  Bell,
  BellOff,
  CheckCircle2,
  KeyRound,
  Lock,
  RotateCcw,
  Volume2,
  XCircle,
} from 'lucide-react';
import type {
  ClassroomState,
  QuestionItem,
  TeamStatus,
  VocabItem,
} from '../types/game.ts';
import {
  playDeskBell,
  playVictoryChord,
  playWrongBuzz,
  speakChinese,
} from '../utils/audio.ts';
import { formatDurationMs } from './LeaderboardView.tsx';

const LOBBY_IMAGE = '/src/assets/images/hotel_concierge_lobby_1794721823040.jpg';
const KEYCARD_IMAGE = '/src/assets/images/hotel_brass_keycard_1794721823288.jpg';

type LocalStage = 'SELECT_GROUP' | 'READY' | 'PLAYING' | 'FINISHED';

interface PlayViewProps {
  state: ClassroomState;
  onUpdateTeam: (payload: {
    groupId: number;
    status: TeamStatus;
    currentQ: number;
    totalQ: number;
    wrongCount: number;
    elapsedMs: number | null;
    penaltyMs: number;
    finalMs: number | null;
  }) => Promise<void>;
  onOpenLeaderboard: () => void;
}

function shuffleArray<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function renderSentenceWithBlank(
  template: string,
  filledText: string | null,
  isPinyin = false
) {
  const parts = template.split('____');
  if (parts.length === 1) {
    return <span>{template}</span>;
  }

  return (
    <>
      {parts.map((part, idx) => (
        <span key={idx}>
          <span>{part}</span>
          {idx < parts.length - 1 && (
            <span
              className={`mx-1.5 inline-block min-w-[4.5rem] border-b-2 px-2 py-0.5 text-center transition-colors ${
                filledText
                  ? 'border-[#15803D] bg-[#DCFCE7]/80 font-bold text-[#15803D] dark:border-[#34D399] dark:bg-[#0D2E22] dark:text-[#6EE7B7]'
                  : 'border-[#B08D57] bg-[#F5F5F0] text-[#B08D57] dark:border-[#D4AF67] dark:bg-[#172B24] dark:text-[#D4AF67]'
              } ${isPinyin ? 'rounded text-base sm:text-lg' : 'rounded-md'}`}
            >
              {filledText ?? '____'}
            </span>
          )}
        </span>
      ))}
    </>
  );
}

export function PlayView({
  state,
  onUpdateTeam,
  onOpenLeaderboard,
}: PlayViewProps) {
  const [stage, setStage] = useState<LocalStage>('SELECT_GROUP');
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);
  const [questionIdx, setQuestionIdx] = useState(0);
  const [shuffledVocab, setShuffledVocab] = useState<VocabItem[]>([]);
  const [wrongIds, setWrongIds] = useState<string[]>([]);
  const [shakeId, setShakeId] = useState<string | null>(null);
  const [solvedVocab, setSolvedVocab] = useState<VocabItem | null>(null);

  const [lockUntil, setLockUntil] = useState<number | null>(null);
  const [lockRemainingMs, setLockRemainingMs] = useState(0);

  const [elapsedMs, setElapsedMs] = useState(0);
  const [wrongCount, setWrongCount] = useState(0);
  const [finalBaseMs, setFinalBaseMs] = useState<number | null>(null);

  const [sfxEnabled, setSfxEnabled] = useState(true);
  const [speakingKey, setSpeakingKey] = useState<string | null>(null);
  const [ttsNotice, setTtsNotice] = useState(false);
  const [lobbyImgError, setLobbyImgError] = useState(false);
  const [keycardImgError, setKeycardImgError] = useState(false);
  const [countdownNow, setCountdownNow] = useState(Date.now());

  const startTimestampRef = useRef<number | null>(null);
  const advanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastAutoStartRef = useRef<number | null>(null);
  const groupGridRef = useRef<HTMLDivElement | null>(null);

  const activeGroup = useMemo(
    () =>
      state.groups.find((g) => g.groupId === selectedGroupId) ??
      state.groups[0],
    [state.groups, selectedGroupId]
  );

  const questions: QuestionItem[] = activeGroup?.questions ?? [];
  const currentQuestion = questions[questionIdx] ?? questions[0];

  // Clear timers on unmount
  useEffect(() => {
    return () => {
      if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
    };
  }, []);

  // Re-shuffle vocabulary cards whenever question changes
  useEffect(() => {
    if (stage === 'PLAYING') {
      setShuffledVocab(shuffleArray(state.vocab));
      setWrongIds([]);
      setSolvedVocab(null);
      setShakeId(null);
    }
  }, [stage, questionIdx, state.vocab]);

  // Stopwatch loop while playing
  useEffect(() => {
    if (stage !== 'PLAYING' || startTimestampRef.current === null) return;
    const id = setInterval(() => {
      if (startTimestampRef.current !== null) {
        setElapsedMs(Date.now() - startTimestampRef.current);
      }
    }, 50);
    return () => clearInterval(id);
  }, [stage]);

  // Lockout countdown loop
  useEffect(() => {
    if (!lockUntil) {
      setLockRemainingMs(0);
      return;
    }
    const update = () => {
      const rem = lockUntil - Date.now();
      if (rem <= 0) {
        setLockUntil(null);
        setLockRemainingMs(0);
      } else {
        setLockRemainingMs(rem);
      }
    };
    update();
    const id = setInterval(update, 50);
    return () => clearInterval(id);
  }, [lockUntil]);

  // Countdown tick while on READY screen if teacher triggered countdown
  useEffect(() => {
    if (stage !== 'READY' || state.session.phase !== 'COUNTDOWN') return;
    const id = setInterval(() => setCountdownNow(Date.now()), 80);
    return () => clearInterval(id);
  }, [stage, state.session.phase]);

  const startPlayNow = useCallback(
    (groupId: number, totalQ: number) => {
      if (advanceTimerRef.current) {
        clearTimeout(advanceTimerRef.current);
        advanceTimerRef.current = null;
      }
      const now = Date.now();
      startTimestampRef.current = now;
      setElapsedMs(0);
      setFinalBaseMs(null);
      setWrongCount(0);
      setQuestionIdx(0);
      setWrongIds([]);
      setSolvedVocab(null);
      setLockUntil(null);
      setShuffledVocab(shuffleArray(state.vocab));
      setStage('PLAYING');

      void onUpdateTeam({
        groupId,
        status: 'PLAYING',
        currentQ: 1,
        totalQ,
        wrongCount: 0,
        elapsedMs: null,
        penaltyMs: 0,
        finalMs: null,
      });
    },
    [onUpdateTeam, state.vocab]
  );

  // Automatically enter PLAYING when teacher's synchronized round turns ACTIVE
  useEffect(() => {
    if (
      stage === 'READY' &&
      selectedGroupId !== null &&
      state.session.phase === 'ACTIVE' &&
      state.session.startedAt &&
      lastAutoStartRef.current !== state.session.startedAt
    ) {
      lastAutoStartRef.current = state.session.startedAt;
      startPlayNow(selectedGroupId, questions.length);
    }
  }, [
    stage,
    selectedGroupId,
    state.session.phase,
    state.session.startedAt,
    questions.length,
    startPlayNow,
  ]);

  const handleSelectGroup = (groupId: number) => {
    setSelectedGroupId(groupId);
    setStage('READY');
    const qCount =
      state.groups.find((g) => g.groupId === groupId)?.questions.length ?? 3;
    void onUpdateTeam({
      groupId,
      status: 'READY',
      currentQ: 0,
      totalQ: qCount,
      wrongCount: 0,
      elapsedMs: null,
      penaltyMs: 0,
      finalMs: null,
    });
  };

  const handleBackToSelect = () => {
    if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
    if (selectedGroupId !== null && stage !== 'FINISHED') {
      const qCount = questions.length || 3;
      void onUpdateTeam({
        groupId: selectedGroupId,
        status: 'IDLE',
        currentQ: 0,
        totalQ: qCount,
        wrongCount: 0,
        elapsedMs: null,
        penaltyMs: 0,
        finalMs: null,
      });
    }
    setStage('SELECT_GROUP');
  };

  const handleSpeakQuestion = (q: QuestionItem, key: string, forceFilled = false) => {
    setTtsNotice(false);
    const replacement =
      forceFilled || solvedVocab?.zh === q.answerZh ? q.answerZh : '，';
    const text = q.template.replaceAll('____', replacement);
    speakChinese(
      text,
      () => setSpeakingKey(key),
      () => setSpeakingKey((curr) => (curr === key ? null : curr)),
      () => setTtsNotice(true)
    );
  };

  const handlePickVocab = (item: VocabItem) => {
    if (
      stage !== 'PLAYING' ||
      !currentQuestion ||
      solvedVocab !== null ||
      lockRemainingMs > 0 ||
      wrongIds.includes(item.id) ||
      selectedGroupId === null
    ) {
      return;
    }

    const isCorrect = item.zh === currentQuestion.answerZh;

    if (isCorrect) {
      setSolvedVocab(item);
      const isLast = questionIdx >= questions.length - 1;
      if (isLast) {
        playVictoryChord(sfxEnabled);
        const nowElapsed =
          startTimestampRef.current !== null
            ? Date.now() - startTimestampRef.current
            : elapsedMs;
        const penaltyMs = wrongCount * state.settings.penaltySeconds * 1000;
        const totalFinalMs = nowElapsed + penaltyMs;
        setFinalBaseMs(nowElapsed);
        setElapsedMs(nowElapsed);

        advanceTimerRef.current = setTimeout(() => {
          setStage('FINISHED');
          void onUpdateTeam({
            groupId: selectedGroupId,
            status: 'FINISHED',
            currentQ: questions.length,
            totalQ: questions.length,
            wrongCount,
            elapsedMs: nowElapsed,
            penaltyMs,
            finalMs: totalFinalMs,
          });
        }, state.settings.revealDelayMs);
      } else {
        playDeskBell(sfxEnabled);
        const nextQIdx = questionIdx + 1;
        advanceTimerRef.current = setTimeout(() => {
          setQuestionIdx(nextQIdx);
          void onUpdateTeam({
            groupId: selectedGroupId,
            status: 'PLAYING',
            currentQ: nextQIdx + 1,
            totalQ: questions.length,
            wrongCount,
            elapsedMs: null,
            penaltyMs: wrongCount * state.settings.penaltySeconds * 1000,
            finalMs: null,
          });
        }, state.settings.revealDelayMs);
      }
    } else {
      playWrongBuzz(sfxEnabled);
      const nextWrong = wrongCount + 1;
      setWrongCount(nextWrong);
      setWrongIds((prev) => [...prev, item.id]);
      setShakeId(item.id);
      setTimeout(() => {
        setShakeId((curr) => (curr === item.id ? null : curr));
      }, 420);

      if (state.settings.lockSeconds > 0) {
        setLockUntil(Date.now() + state.settings.lockSeconds * 1000);
      }

      void onUpdateTeam({
        groupId: selectedGroupId,
        status: 'PLAYING',
        currentQ: questionIdx + 1,
        totalQ: questions.length,
        wrongCount: nextWrong,
        elapsedMs: null,
        penaltyMs: nextWrong * state.settings.penaltySeconds * 1000,
        finalMs: null,
      });
    }
  };

  // Compute live rank for finished screen
  const finishedRank = useMemo(() => {
    if (selectedGroupId === null) return null;
    const finished = Object.values(state.session.teams)
      .filter((t) => t.status === 'FINISHED')
      .sort((a, b) => (a.finalMs ?? 0) - (b.finalMs ?? 0));
    const idx = finished.findIndex((t) => t.groupId === selectedGroupId);
    return idx >= 0 ? idx + 1 : null;
  }, [state.session.teams, selectedGroupId]);

  if (stage === 'SELECT_GROUP') {
    return (
      <section className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
        {/* Hero Split */}
        <div className="grid grid-cols-1 items-stretch gap-8 lg:grid-cols-12">
          <div className="flex flex-col justify-between lg:col-span-7">
            <div>
              <p className="text-xs font-medium text-[#54665E] dark:text-[#9CB0A6]">
                บทที่ 2 งานต้อนรับส่วนหน้า · 会话1 จองห้อง · 会话2 เช็คอิน · 会话3 เช็คเอาท์
              </p>
              <h1 className="mt-2 text-balance text-3xl font-bold tracking-tight text-[#14201B] sm:text-4xl dark:text-[#ECF1EE]">
                <span className="font-cn text-[#0F3D2E] dark:text-[#D4AF67]">
                  入住速递
                </span>{' '}
                · เช็คอินด่วนทันใจ
              </h1>
              <p className="mt-3 max-w-2xl text-base leading-relaxed text-[#3B4B44] dark:text-[#CBD5D0]">
                เกมแข่งขันภาษาจีนธุรกิจงานบริการโรงแรมสำหรับ 8 กลุ่ม ช่วยกันอ่านโจทย์และเลือกการ์ดคำศัพท์ 10 ใบมาเติมให้ครบ 3 ข้อเร็วที่สุด
              </p>

              <div className="mt-6 grid grid-cols-1 gap-4 border-t border-[#D6DBD4] pt-5 sm:grid-cols-3 dark:border-[#233B32]">
                <div>
                  <p className="font-mono-num text-xs font-semibold text-[#B08D57] dark:text-[#D4AF67]">
                    01. เตรียมพร้อม
                  </p>
                  <p className="mt-1 text-sm text-[#3B4B44] dark:text-[#CBD5D0]">
                    เลือกหมายเลขกลุ่ม 1–8 แล้วรอสัญญาณ <span className="font-cn font-semibold">开始</span> พร้อมกัน
                  </p>
                </div>
                <div>
                  <p className="font-mono-num text-xs font-semibold text-[#B08D57] dark:text-[#D4AF67]">
                    02. เติมคำศัพท์
                  </p>
                  <p className="mt-1 text-sm text-[#3B4B44] dark:text-[#CBD5D0]">
                    เลือกคำจาก {state.vocab.length} การ์ด ตอบผิดล็อกปุ่ม {state.settings.lockSeconds} วิ
                  </p>
                </div>
                <div>
                  <p className="font-mono-num text-xs font-semibold text-[#B08D57] dark:text-[#D4AF67]">
                    03. ตะโกนคว้าชัย
                  </p>
                  <p className="mt-1 text-sm text-[#3B4B44] dark:text-[#CBD5D0]">
                    ครบ 3 ข้อแล้วยกมือพร้อมกันทั้งกลุ่มแล้วตะโกนว่า{' '}
                    <span className="font-cn font-semibold">{state.settings.shoutWord}</span>
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-7 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() =>
                  groupGridRef.current?.scrollIntoView({ behavior: 'smooth' })
                }
                className="inline-flex items-center gap-2 rounded-lg bg-[#0F3D2E] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#14523E] dark:bg-[#D4AF67] dark:text-[#0A1612] dark:hover:bg-[#E2C281] cursor-pointer"
              >
                <span>เลือกกลุ่มเข้าแข่งขัน</span>
                <ArrowRight className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={onOpenLeaderboard}
                className="inline-flex items-center gap-2 rounded-lg border border-[#D6DBD4] bg-white px-4 py-2.5 text-sm font-medium text-[#14201B] transition-colors hover:bg-[#EAECE8] dark:border-[#233B32] dark:bg-[#11221C] dark:text-[#ECF1EE] dark:hover:bg-[#172B24] cursor-pointer"
              >
                <span>เปิดกระดานอันดับกลาง</span>
              </button>
            </div>
          </div>

          <div className="relative min-h-[220px] overflow-hidden rounded-xl border border-[#D6DBD4] bg-[#0F3D2E] lg:col-span-5 dark:border-[#233B32]">
            {!lobbyImgError ? (
              <img
                src={LOBBY_IMAGE}
                alt="เคาน์เตอร์ต้อนรับส่วนหน้าโรงแรมสไตล์เอเมอรัลด์และทองเหลือง"
                referrerPolicy="no-referrer"
                onError={() => setLobbyImgError(true)}
                className="h-full w-full object-cover lg:h-full"
              />
            ) : (
              <div className="flex h-full flex-col items-center justify-center bg-gradient-to-br from-[#0F3D2E] to-[#081F17] p-8 text-center text-white">
                <KeyRound className="h-10 w-10 text-[#D4AF67]" />
                <p className="font-cn mt-3 text-xl font-bold">曼谷酒店 · 前台接待</p>
              </div>
            )}
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 p-5 text-white">
              <p className="font-cn text-lg font-semibold text-[#D4AF67]">
                曼谷酒店 · 前台接待
              </p>
              <p className="mt-0.5 text-xs text-white/85">
                เคาน์เตอร์ต้อนรับส่วนหน้า · การจองห้องพัก เช็คอิน และเช็คเอาท์
              </p>
            </div>
          </div>
        </div>

        {/* Group 1-8 Grid */}
        <div ref={groupGridRef} className="mt-10 border-t border-[#D6DBD4] pt-8 dark:border-[#233B32]">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
            <h2 className="text-xl font-bold text-[#14201B] dark:text-[#ECF1EE]">
              เลือกหมายเลขกลุ่มของคุณ (กลุ่ม 1 – 8)
            </h2>
            <p className="text-xs text-[#54665E] dark:text-[#9CB0A6]">
              แต่ละกลุ่มใช้ 1 อุปกรณ์ร่วมกัน · โจทย์ชุดเฉพาะกลุ่มไม่ซ้ำกัน
            </p>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
            {state.groups.map((group) => {
              const team = state.session.teams[group.groupId];
              const statusText =
                team?.status === 'FINISHED'
                  ? `เสร็จสิ้น (${formatDurationMs(team.finalMs)})`
                  : team?.status === 'PLAYING'
                    ? `กำลังแข่ง ข้อ ${team.currentQ}/${team.totalQ}`
                    : team?.status === 'READY'
                      ? 'รอเริ่มเกม'
                      : 'พร้อมเลือก';

              return (
                <button
                  key={group.groupId}
                  type="button"
                  onClick={() => handleSelectGroup(group.groupId)}
                  className="group flex flex-col justify-between rounded-xl border border-[#D6DBD4] bg-white p-5 text-left transition-all duration-150 hover:-translate-y-0.5 hover:border-[#0F3D2E] focus-visible:outline-2 focus-visible:outline-[#B08D57] dark:border-[#233B32] dark:bg-[#11221C] dark:hover:border-[#D4AF67] cursor-pointer"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono-num text-xs font-semibold text-[#B08D57] dark:text-[#D4AF67]">
                      TEAM 0{group.groupId}
                    </span>
                    <KeyRound className="h-4 w-4 text-[#70827A] transition-colors group-hover:text-[#0F3D2E] dark:text-[#789085] dark:group-hover:text-[#D4AF67]" />
                  </div>

                  <div className="mt-4">
                    <p className="text-xl font-bold text-[#14201B] dark:text-[#ECF1EE]">
                      กลุ่ม {group.groupId}
                    </p>
                    <p className="mt-1 text-xs text-[#54665E] dark:text-[#9CB0A6]">
                      โจทย์ {group.questions.length} ข้อ · {statusText}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </section>
    );
  }

  if (stage === 'READY' && selectedGroupId !== null) {
    const countdownSec =
      state.session.phase === 'COUNTDOWN' && state.session.countdownEndsAt
        ? Math.max(0, Math.ceil((state.session.countdownEndsAt - countdownNow) / 1000))
        : null;

    return (
      <section className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
        <button
          type="button"
          onClick={handleBackToSelect}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-[#54665E] hover:text-[#14201B] dark:text-[#9CB0A6] dark:hover:text-[#ECF1EE] cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>กลับไปเลือกกลุ่มอื่น</span>
        </button>

        <div className="mt-5 overflow-hidden rounded-xl border border-[#D6DBD4] bg-white dark:border-[#233B32] dark:bg-[#11221C]">
          <div className="grid grid-cols-1 items-stretch sm:grid-cols-12">
            <div className="relative min-h-[180px] bg-[#0F3D2E] sm:col-span-5">
              {!keycardImgError ? (
                <img
                  src={KEYCARD_IMAGE}
                  alt="คีย์การ์ดและกระดิ่งต้อนรับโรงแรม"
                  referrerPolicy="no-referrer"
                  onError={() => setKeycardImgError(true)}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full items-center justify-center p-6 text-[#D4AF67]">
                  <KeyRound className="h-12 w-12" />
                </div>
              )}
            </div>

            <div className="flex flex-col justify-between p-6 sm:col-span-7 sm:p-8">
              <div>
                <p className="text-xs font-medium text-[#B08D57] dark:text-[#D4AF67]">
                  ห้องเตรียมพร้อม · กลุ่ม {selectedGroupId}
                </p>
                <h1 className="mt-1.5 text-2xl font-bold text-[#14201B] dark:text-[#ECF1EE]">
                  พร้อมเช็คอินแล้วหรือยัง?
                </h1>
                <p className="mt-2 text-sm leading-relaxed text-[#54665E] dark:text-[#9CB0A6]">
                  รอสัญญาณจากผู้สอนหน้าชั้นเรียน หรือกดปุ่ม{' '}
                  <strong className="font-cn text-[#0F3D2E] dark:text-[#D4AF67]">
                    开始
                  </strong>{' '}
                  พร้อมกันทุกกลุ่มเพื่อเริ่มจับเวลา
                </p>

                <div className="mt-5 space-y-1.5 border-t border-[#EAECE8] pt-4 text-xs text-[#54665E] dark:border-[#1E362D] dark:text-[#9CB0A6]">
                  <p>· จำนวนโจทย์: {questions.length} ข้อ (การ์ดตัวเลือก {state.vocab.length} คำ)</p>
                  <p>
                    · ตอบผิด: ล็อกปุ่ม {state.settings.lockSeconds} วินาที
                    {state.settings.penaltySeconds > 0
                      ? ` และบวกเวลา +${state.settings.penaltySeconds} วินาที/ครั้ง`
                      : ' (เวลายังเดินต่อเนื่อง)'}
                  </p>
                  <p>
                    · คำตะโกนเมื่อครบ: <span className="font-cn font-semibold text-[#14201B] dark:text-[#ECF1EE]">{state.settings.shoutWord}</span>
                  </p>
                </div>
              </div>

              {countdownSec !== null ? (
                <div className="mt-6 rounded-lg bg-[#0F3D2E] p-4 text-center text-white dark:bg-[#172B24]">
                  <p className="text-xs text-[#D4AF67]">ผู้สอนกำลังนับถอยหลังเริ่มพร้อมกัน...</p>
                  <p className="font-display mt-1 text-4xl font-bold tabular-nums">
                    {countdownSec > 0 ? countdownSec : '开始!'}
                  </p>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => startPlayNow(selectedGroupId, questions.length)}
                  className="mt-6 w-full rounded-lg bg-[#0F3D2E] px-6 py-3.5 text-base font-bold text-white transition-colors hover:bg-[#14523E] dark:bg-[#D4AF67] dark:text-[#0A1612] dark:hover:bg-[#E2C281] cursor-pointer"
                >
                  <span className="font-cn mr-2 text-lg">开始</span>
                  <span>เริ่มจับเวลา!</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </section>
    );
  }

  if (stage === 'PLAYING' && currentQuestion && selectedGroupId !== null) {
    const isLocked = lockRemainingMs > 0;
    const isSolved = solvedVocab !== null;
    const penaltyMs = wrongCount * state.settings.penaltySeconds * 1000;

    return (
      <section className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
        {/* Compact Game HUD */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#D6DBD4] pb-4 dark:border-[#233B32]">
          <div className="flex items-center gap-3 text-sm">
            <span className="font-bold text-[#0F3D2E] dark:text-[#D4AF67]">
              กลุ่ม {selectedGroupId}
            </span>
            <span aria-hidden="true" className="text-[#70827A]">·</span>
            <span className="font-mono-num font-semibold text-[#14201B] dark:text-[#ECF1EE]">
              ข้อ {questionIdx + 1} / {questions.length}
            </span>
          </div>

          {/* 3-step Progress Track */}
          <div className="flex flex-1 items-center justify-center gap-2 max-w-xs">
            {questions.map((q, idx) => {
              const done = idx < questionIdx || (idx === questionIdx && isSolved);
              const active = idx === questionIdx && !isSolved;
              return (
                <div
                  key={q.id}
                  className={`h-2 flex-1 rounded-full transition-colors ${
                    done
                      ? 'bg-[#15803D] dark:bg-[#34D399]'
                      : active
                        ? 'bg-[#B08D57] dark:bg-[#D4AF67]'
                        : 'bg-[#D6DBD4] dark:bg-[#233B32]'
                  }`}
                />
              );
            })}
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right">
              <span className="font-mono-num text-xl font-bold text-[#14201B] dark:text-[#ECF1EE]">
                {formatDurationMs(elapsedMs)}
              </span>
              {penaltyMs > 0 && (
                <span className="font-mono-num ml-2 text-xs font-semibold text-[#B91C1C] dark:text-[#F87171]">
                  +{penaltyMs / 1000}s
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={() => setSfxEnabled((v) => !v)}
              aria-label={sfxEnabled ? 'ปิดเสียงเอฟเฟกต์' : 'เปิดเสียงเอฟเฟกต์'}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#D6DBD4] bg-white text-[#54665E] hover:bg-[#EAECE8] dark:border-[#233B32] dark:bg-[#11221C] dark:text-[#9CB0A6] cursor-pointer"
            >
              {sfxEnabled ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {/* Question Stage (Focal Anchor) */}
        <div className="mt-6 rounded-xl border border-[#D6DBD4] bg-white p-6 sm:p-8 dark:border-[#233B32] dark:bg-[#11221C]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs font-medium text-[#54665E] dark:text-[#9CB0A6]">
              {currentQuestion.session} · {currentQuestion.sessionTh}
              {state.settings.showContextHints && currentQuestion.contextHint
                ? ` · คำใบ้: ${currentQuestion.contextHint}`
                : ''}
            </p>

            <button
              type="button"
              onClick={() => handleSpeakQuestion(currentQuestion, currentQuestion.id)}
              className={`inline-flex items-center gap-2 rounded-lg border px-3.5 py-2 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                speakingKey === currentQuestion.id
                  ? 'border-[#0F3D2E] bg-[#0F3D2E] text-white dark:border-[#D4AF67] dark:bg-[#D4AF67] dark:text-[#0A1612]'
                  : 'border-[#D6DBD4] bg-[#F5F5F0] text-[#0F3D2E] hover:bg-[#EAECE8] dark:border-[#233B32] dark:bg-[#172B24] dark:text-[#D4AF67] dark:hover:bg-[#1E362D]'
              }`}
            >
              <Volume2 className="h-4 w-4" />
              <span>ฟังเสียงประโยค</span>
            </button>
          </div>

          <div className="mt-5">
            <p className="font-cn text-2xl font-bold leading-relaxed text-[#14201B] sm:text-3xl dark:text-[#ECF1EE]">
              {renderSentenceWithBlank(
                currentQuestion.template,
                solvedVocab ? solvedVocab.zh : null
              )}
            </p>
            <p className="mt-2.5 text-base font-medium text-[#54665E] sm:text-lg dark:text-[#9CB0A6]">
              {renderSentenceWithBlank(
                currentQuestion.pinyinTemplate,
                solvedVocab ? solvedVocab.pinyin : null,
                true
              )}
            </p>
          </div>

          {ttsNotice && (
            <p className="mt-3 text-xs text-[#D97706] dark:text-[#FBBF24]">
              อุปกรณ์นี้ไม่มีเสียงอ่านภาษาจีนติดตั้งไว้ สามารถอ่านจากตัวอักษรจีนและพินอินด้านบนได้
            </p>
          )}

          {/* Lockout or Correct Reveal Feedback */}
          {isLocked && (
            <div className="mt-5 flex items-center gap-2.5 rounded-lg border border-[#B91C1C]/30 bg-[#FEE2E2] px-4 py-3 text-sm font-semibold text-[#991B1B] dark:border-[#F87171]/30 dark:bg-[#3B1212] dark:text-[#FCA5A5]">
              <Lock className="h-4 w-4 shrink-0" />
              <span className="font-mono-num">
                ตอบผิด · ล็อกปุ่มชั่วคราว {(lockRemainingMs / 1000).toFixed(1)} วินาที
                {state.settings.penaltySeconds > 0
                  ? ` (+${state.settings.penaltySeconds} วิ)`
                  : ' (เวลายังเดินต่อ)'}
              </span>
            </div>
          )}

          {isSolved && solvedVocab && (
            <div className="mt-5 flex flex-col gap-1 rounded-lg border border-[#15803D]/30 bg-[#DCFCE7] px-4 py-3.5 text-[#166534] dark:border-[#34D399]/30 dark:bg-[#0D2E22] dark:text-[#6EE7B7]">
              <div className="flex items-center gap-2 text-sm font-bold">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span>
                  ถูกต้อง! {solvedVocab.zh} ({solvedVocab.pinyin}) = {solvedVocab.th}
                </span>
              </div>
              <p className="text-sm">{currentQuestion.thTranslation}</p>
            </div>
          )}
        </div>

        {/* 10 Vocabulary Keycard Grid */}
        <div className="mt-6">
          <div className="mb-3 flex items-center justify-between text-xs text-[#54665E] dark:text-[#9CB0A6]">
            <span>เลือกการ์ดคำศัพท์ที่ถูกต้องมาเติมลงในช่องว่าง (สลับตำแหน่งทุกข้อ)</span>
            <span>ตอบผิดสะสม {wrongCount} ครั้ง</span>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
            {shuffledVocab.map((item) => {
              const isWrongDisabled = wrongIds.includes(item.id);
              const isThisSolved = solvedVocab?.id === item.id;
              const isShaking = shakeId === item.id;
              const disabled = isLocked || isSolved || isWrongDisabled;

              return (
                <button
                  key={item.id}
                  type="button"
                  disabled={disabled}
                  onClick={() => handlePickVocab(item)}
                  className={`flex min-h-[82px] flex-col items-center justify-center rounded-xl border px-3 py-3 text-center transition-all duration-150 ${
                    isShaking ? 'animate-card-shake' : ''
                  } ${
                    isThisSolved
                      ? 'border-[#15803D] bg-[#DCFCE7] text-[#14532D] dark:border-[#34D399] dark:bg-[#0D2E22] dark:text-[#ECF1EE]'
                      : isWrongDisabled
                        ? 'border-[#B91C1C]/40 bg-[#FEE2E2]/60 text-[#991B1B]/70 opacity-60 dark:border-[#F87171]/30 dark:bg-[#2C1010] dark:text-[#FCA5A5]/60 cursor-not-allowed'
                        : isLocked
                          ? 'border-[#D6DBD4] bg-[#EAECE8] text-[#70827A] opacity-65 dark:border-[#233B32] dark:bg-[#172B24] dark:text-[#789085] cursor-not-allowed'
                          : 'border-[#D6DBD4] bg-white text-[#14201B] hover:-translate-y-0.5 hover:border-[#0F3D2E] active:translate-y-0 dark:border-[#233B32] dark:bg-[#11221C] dark:text-[#ECF1EE] dark:hover:border-[#D4AF67] cursor-pointer'
                  }`}
                >
                  <span className="font-cn text-xl font-bold sm:text-2xl">
                    {item.zh}
                  </span>
                  <span className="mt-1 text-xs font-medium text-[#B08D57] dark:text-[#D4AF67]">
                    {item.pinyin}
                  </span>

                  {isWrongDisabled && (
                    <span className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-semibold text-[#B91C1C] dark:text-[#F87171]">
                      <XCircle className="h-3 w-3" />
                      <span>ไม่ใช่คำนี้</span>
                    </span>
                  )}

                  {isThisSolved && (
                    <span className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-semibold text-[#15803D] dark:text-[#34D399]">
                      <CheckCircle2 className="h-3 w-3" />
                      <span>{item.th}</span>
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </section>
    );
  }

  // FINISHED STAGE
  const baseMs = finalBaseMs ?? elapsedMs;
  const penaltyMs = wrongCount * state.settings.penaltySeconds * 1000;
  const totalFinalMs = baseMs + penaltyMs;

  return (
    <section className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-10">
      <div className="rounded-xl border border-[#B08D57] bg-[#0F3D2E] p-7 text-center text-white sm:p-10 dark:border-[#D4AF67] dark:bg-[#11221C]">
        <p className="text-xs font-semibold text-[#D4AF67]">
          กลุ่ม {selectedGroupId} เสร็จสิ้นครบทั้ง {questions.length} ข้อแล้ว!
        </p>
        <p className="font-cn mt-3 text-5xl font-bold tracking-wide text-white sm:text-6xl">
          {state.settings.shoutWord}
        </p>
        <p className="mt-4 text-base font-medium text-white/90">
          ยกมือขึ้นพร้อมกันทั้งกลุ่ม แล้วตะโกนดังๆ ว่า{' '}
          <span className="font-cn font-bold text-[#D4AF67]">
            「{state.settings.shoutWord}」
          </span>
        </p>

        <div className="mt-7 grid grid-cols-2 gap-4 border-t border-white/15 pt-6 text-left sm:grid-cols-4">
          <div>
            <p className="text-xs text-white/70">เวลารวมสุทธิ</p>
            <p className="font-mono-num mt-1 text-2xl font-bold text-[#D4AF67]">
              {formatDurationMs(totalFinalMs)}
            </p>
          </div>
          <div>
            <p className="text-xs text-white/70">เวลาจริง / โทษเวลา</p>
            <p className="font-mono-num mt-1 text-lg font-semibold text-white">
              {formatDurationMs(baseMs)}
              {penaltyMs > 0 ? ` +${penaltyMs / 1000}s` : ''}
            </p>
          </div>
          <div>
            <p className="text-xs text-white/70">ตอบผิด</p>
            <p className="font-mono-num mt-1 text-lg font-semibold text-white">
              {wrongCount} ครั้ง
            </p>
          </div>
          <div>
            <p className="text-xs text-white/70">อันดับบนกระดาน</p>
            <p className="font-mono-num mt-1 flex items-center gap-1.5 text-lg font-semibold text-[#D4AF67]">
              <Award className="h-4 w-4" />
              <span>{finishedRank ? `อันดับที่ ${finishedRank}` : 'กำลังอัปเดต'}</span>
            </p>
          </div>
        </div>
      </div>

      {/* Review 3 Sentences */}
      <div className="mt-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-bold text-[#14201B] dark:text-[#ECF1EE]">
            ทบทวนประโยคและคำศัพท์ของกลุ่ม {selectedGroupId}
          </h2>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onOpenLeaderboard}
              className="rounded-lg border border-[#D6DBD4] bg-white px-4 py-2 text-sm font-medium text-[#14201B] hover:bg-[#EAECE8] dark:border-[#233B32] dark:bg-[#11221C] dark:text-[#ECF1EE] cursor-pointer"
            >
              ดูกระดานอันดับรวม
            </button>
            <button
              type="button"
              onClick={() => {
                if (selectedGroupId !== null) {
                  setStage('READY');
                  void onUpdateTeam({
                    groupId: selectedGroupId,
                    status: 'READY',
                    currentQ: 0,
                    totalQ: questions.length,
                    wrongCount: 0,
                    elapsedMs: null,
                    penaltyMs: 0,
                    finalMs: null,
                  });
                }
              }}
              className="inline-flex items-center gap-2 rounded-lg bg-[#0F3D2E] px-4 py-2 text-sm font-semibold text-white hover:bg-[#14523E] dark:bg-[#D4AF67] dark:text-[#0A1612] cursor-pointer"
            >
              <RotateCcw className="h-4 w-4" />
              <span>เล่นอีกครั้ง</span>
            </button>
          </div>
        </div>

        <div className="mt-4 space-y-4">
          {questions.map((q, idx) => {
            const matchedVocab = state.vocab.find((v) => v.zh === q.answerZh);
            const reviewKey = `review-${q.id}`;
            return (
              <div
                key={q.id}
                className="rounded-xl border border-[#D6DBD4] bg-white p-5 dark:border-[#233B32] dark:bg-[#11221C]"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-medium text-[#54665E] dark:text-[#9CB0A6]">
                      ข้อที่ {idx + 1} · {q.session} · {q.sessionTh}
                    </p>
                    <p className="font-cn mt-2 text-xl font-bold text-[#14201B] sm:text-2xl dark:text-[#ECF1EE]">
                      {renderSentenceWithBlank(q.template, q.answerZh)}
                    </p>
                    <p className="mt-1.5 text-sm font-medium text-[#B08D57] dark:text-[#D4AF67]">
                      {renderSentenceWithBlank(
                        q.pinyinTemplate,
                        matchedVocab?.pinyin ?? q.answerZh,
                        true
                      )}
                    </p>
                    <p className="mt-2 text-sm text-[#3B4B44] dark:text-[#CBD5D0]">
                      {q.thTranslation}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleSpeakQuestion(q, reviewKey, true)}
                    aria-label={`ฟังเสียงข้อ ${idx + 1}`}
                    className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border transition-colors cursor-pointer ${
                      speakingKey === reviewKey
                        ? 'border-[#0F3D2E] bg-[#0F3D2E] text-white dark:border-[#D4AF67] dark:bg-[#D4AF67] dark:text-[#0A1612]'
                        : 'border-[#D6DBD4] bg-[#F5F5F0] text-[#0F3D2E] hover:bg-[#EAECE8] dark:border-[#233B32] dark:bg-[#172B24] dark:text-[#D4AF67]'
                    }`}
                  >
                    <Volume2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={handleBackToSelect}
            className="text-sm font-medium text-[#54665E] underline-offset-4 hover:text-[#14201B] hover:underline dark:text-[#9CB0A6] dark:hover:text-[#ECF1EE] cursor-pointer"
          >
            เปลี่ยนหมายเลขกลุ่ม
          </button>
        </div>
      </div>
    </section>
  );
}
