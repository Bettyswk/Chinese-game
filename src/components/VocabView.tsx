import { useState } from 'react';
import { Eye, EyeOff, Volume2 } from 'lucide-react';
import type { VocabItem } from '../types/game.ts';
import { speakChinese } from '../utils/audio.ts';

interface VocabViewProps {
  vocab: VocabItem[];
}

export function VocabView({ vocab }: VocabViewProps) {
  const [hideThai, setHideThai] = useState(false);
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const [revealedIds, setRevealedIds] = useState<Record<string, boolean>>({});
  const [ttsWarning, setTtsWarning] = useState(false);

  const handleSpeak = (item: VocabItem) => {
    setTtsWarning(false);
    speakChinese(
      item.zh,
      () => setSpeakingId(item.id),
      () => setSpeakingId((curr) => (curr === item.id ? null : curr)),
      () => setTtsWarning(true)
    );
  };

  const toggleRevealCard = (id: string) => {
    if (!hideThai) return;
    setRevealedIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <section className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      <div className="flex flex-col gap-4 border-b border-[#D6DBD4] pb-6 sm:flex-row sm:items-end sm:justify-between dark:border-[#233B32]">
        <div>
          <p className="text-xs font-medium text-[#54665E] dark:text-[#9CB0A6]">
            บทที่ 2 งานต้อนรับส่วนหน้า · คำศัพท์หลักประจำเกม ({vocab.length} คำ)
          </p>
          <h1 className="mt-1.5 text-2xl font-bold tracking-tight text-[#14201B] sm:text-3xl dark:text-[#ECF1EE]">
            คลังคำศัพท์งานบริการโรงแรม
          </h1>
        </div>

        <button
          type="button"
          onClick={() => {
            setHideThai((v) => !v);
            setRevealedIds({});
          }}
          className="inline-flex items-center gap-2 self-start rounded-lg border border-[#D6DBD4] bg-white px-4 py-2 text-sm font-medium text-[#14201B] transition-colors hover:bg-[#EAECE8] dark:border-[#233B32] dark:bg-[#11221C] dark:text-[#ECF1EE] dark:hover:bg-[#172B24] whitespace-nowrap shrink-0 cursor-pointer"
        >
          {hideThai ? <Eye className="h-4 w-4 text-[#0F3D2E] dark:text-[#D4AF67]" /> : <EyeOff className="h-4 w-4 text-[#54665E] dark:text-[#9CB0A6]" />}
          <span>{hideThai ? 'แสดงคำแปลไทยทั้งหมด' : 'ซ่อนคำแปลเพื่อฝึกจำ'}</span>
        </button>
      </div>

      {ttsWarning && (
        <div className="mt-4 rounded-lg border border-[#D97706]/40 bg-[#FEF3C7] px-4 py-3 text-sm text-[#92400E] dark:border-[#F59E0B]/30 dark:bg-[#2A200D] dark:text-[#FCD34D]">
          อุปกรณ์นี้ยังไม่ได้ติดตั้งเสียงอ่านภาษาจีน (zh-CN) กรุณาตรวจสอบการตั้งค่าเสียงของระบบปฏิบัติการ
        </div>
      )}

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {vocab.map((item, idx) => {
          const isSpeaking = speakingId === item.id;
          const isThaiVisible = !hideThai || revealedIds[item.id];
          return (
            <div
              key={item.id}
              onClick={() => toggleRevealCard(item.id)}
              className={`group flex flex-col justify-between rounded-xl border border-[#D6DBD4] bg-white p-5 transition-colors dark:border-[#233B32] dark:bg-[#11221C] ${
                hideThai ? 'cursor-pointer hover:border-[#B08D57]' : ''
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono-num text-xs text-[#54665E] dark:text-[#9CB0A6]">
                    {String(idx + 1).padStart(2, '0')}
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSpeak(item);
                    }}
                    aria-label={`ฟังเสียงคำว่า ${item.zh}`}
                    className={`inline-flex h-9 w-9 items-center justify-center rounded-lg border transition-colors cursor-pointer ${
                      isSpeaking
                        ? 'border-[#0F3D2E] bg-[#0F3D2E] text-white dark:border-[#D4AF67] dark:bg-[#D4AF67] dark:text-[#0A1612]'
                        : 'border-[#D6DBD4] bg-[#F5F5F0] text-[#0F3D2E] hover:bg-[#EAECE8] dark:border-[#233B32] dark:bg-[#172B24] dark:text-[#D4AF67] dark:hover:bg-[#1E362D]'
                    }`}
                  >
                    <Volume2 className="h-4 w-4" />
                  </button>
                </div>

                <div className="mt-4">
                  <p className="font-cn text-2xl font-bold text-[#14201B] dark:text-[#ECF1EE]">
                    {item.zh}
                  </p>
                  <p className="mt-1 text-sm font-medium text-[#B08D57] dark:text-[#D4AF67]">
                    {item.pinyin}
                  </p>
                </div>
              </div>

              <div className="mt-4 border-t border-[#EAECE8] pt-3 dark:border-[#1E362D]">
                {isThaiVisible ? (
                  <p className="text-sm text-[#3B4B44] dark:text-[#CBD5D0]">{item.th}</p>
                ) : (
                  <p className="text-xs text-[#70827A] dark:text-[#789085]">
                    แตะการ์ดเพื่อดูคำแปล
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
