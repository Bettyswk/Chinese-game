import { useEffect, useState } from 'react';
import { Check, Plus, RotateCcw, Save, Trash2 } from 'lucide-react';
import type {
  ClassroomState,
  GameSettings,
  GroupDeck,
  QuestionItem,
  VocabItem,
} from '../types/game.ts';

interface TeacherSettingsViewProps {
  state: ClassroomState;
  onUpdateSettings: (settings: Partial<GameSettings>) => Promise<void>;
  onUpdateContent: (payload: {
    vocab?: VocabItem[];
    groups?: GroupDeck[];
    resetToDefaults?: boolean;
  }) => Promise<void>;
}

const SHOUT_PRESETS = ['入住！', '退房成功！', '办理完成！', '欢迎光临！'];

export function TeacherSettingsView({
  state,
  onUpdateSettings,
  onUpdateContent,
}: TeacherSettingsViewProps) {
  const [settingsForm, setSettingsForm] = useState<GameSettings>(state.settings);
  const [vocabDraft, setVocabDraft] = useState<VocabItem[]>(state.vocab);
  const [groupsDraft, setGroupsDraft] = useState<GroupDeck[]>(state.groups);
  const [activeGroupId, setActiveGroupId] = useState<number>(1);
  const [editorTab, setEditorTab] = useState<'rules' | 'vocab' | 'questions'>('rules');
  const [savedNotice, setSavedNotice] = useState<string | null>(null);

  useEffect(() => {
    setSettingsForm(state.settings);
    setVocabDraft(state.vocab);
    setGroupsDraft(state.groups);
  }, [state.settings, state.vocab, state.groups]);

  const showNotice = (msg: string) => {
    setSavedNotice(msg);
    setTimeout(() => setSavedNotice(null), 2600);
  };

  const handleSaveRules = async () => {
    await onUpdateSettings(settingsForm);
    showNotice('บันทึกกติกาและเวลาลงโทษเรียบร้อยแล้ว');
  };

  const handleSaveContent = async () => {
    await onUpdateContent({ vocab: vocabDraft, groups: groupsDraft });
    showNotice('บันทึกคำศัพท์และคลังโจทย์เรียบร้อยแล้ว');
  };

  const handleResetDefaults = async () => {
    await onUpdateContent({ resetToDefaults: true });
    showNotice('คืนค่าคำศัพท์และโจทย์ต้นฉบับทั้ง 8 กลุ่มแล้ว');
  };

  const updateVocabField = (
    idx: number,
    field: keyof VocabItem,
    value: string
  ) => {
    setVocabDraft((prev) =>
      prev.map((item, i) => (i === idx ? { ...item, [field]: value } : item))
    );
  };

  const addVocabItem = () => {
    const nextId = `v${Date.now()}`;
    setVocabDraft((prev) => [
      ...prev,
      { id: nextId, zh: '新词', pinyin: 'xīncí', th: 'คำศัพท์ใหม่' },
    ]);
  };

  const removeVocabItem = (idx: number) => {
    if (vocabDraft.length <= 4) return;
    setVocabDraft((prev) => prev.filter((_, i) => i !== idx));
  };

  const currentGroup = groupsDraft.find((g) => g.groupId === activeGroupId) ?? groupsDraft[0];

  const updateQuestionField = (
    qIdx: number,
    field: keyof QuestionItem,
    value: string
  ) => {
    setGroupsDraft((prev) =>
      prev.map((g) => {
        if (g.groupId !== activeGroupId) return g;
        return {
          ...g,
          questions: g.questions.map((q, idx) =>
            idx === qIdx ? { ...q, [field]: value } : q
          ),
        };
      })
    );
  };

  const addQuestionToGroup = () => {
    const firstVocab = vocabDraft[0]?.zh ?? '入住';
    setGroupsDraft((prev) =>
      prev.map((g) => {
        if (g.groupId !== activeGroupId) return g;
        return {
          ...g,
          questions: [
            ...g.questions,
            {
              id: `g${activeGroupId}-${Date.now()}`,
              session: '会话2',
              sessionTh: 'เช็คอิน',
              template: '我想办理____。',
              pinyinTemplate: 'Wǒ xiǎng bànlǐ ____.',
              thTranslation: 'ฉันต้องการติดต่อดำเนินการ____',
              answerZh: firstVocab,
              contextHint: '',
            },
          ],
        };
      })
    );
  };

  const removeQuestionFromGroup = (qIdx: number) => {
    if (!currentGroup || currentGroup.questions.length <= 1) return;
    setGroupsDraft((prev) =>
      prev.map((g) => {
        if (g.groupId !== activeGroupId) return g;
        return {
          ...g,
          questions: g.questions.filter((_, idx) => idx !== qIdx),
        };
      })
    );
  };

  return (
    <section className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      <div className="flex flex-col gap-4 border-b border-[#D6DBD4] pb-6 sm:flex-row sm:items-end sm:justify-between dark:border-[#233B32]">
        <div>
          <p className="text-xs font-medium text-[#54665E] dark:text-[#9CB0A6]">
            ปรับแต่งกติกาห้องเรียน · แก้ไขโจทย์ · เพิ่มคำศัพท์
          </p>
          <h1 className="mt-1.5 text-2xl font-bold tracking-tight text-[#14201B] sm:text-3xl dark:text-[#ECF1EE]">
            ตั้งค่าสำหรับผู้สอน
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2 rounded-lg bg-[#EAECE8] p-1 dark:bg-[#172B24]">
          {(
            [
              { id: 'rules', label: 'กติกาและเวลา' },
              { id: 'vocab', label: 'การ์ดคำศัพท์' },
              { id: 'questions', label: 'โจทย์ 8 กลุ่ม' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setEditorTab(tab.id)}
              className={`rounded-md px-3.5 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                editorTab === tab.id
                  ? 'bg-white text-[#0F3D2E] shadow-xs dark:bg-[#11221C] dark:text-[#D4AF67]'
                  : 'text-[#54665E] hover:text-[#14201B] dark:text-[#9CB0A6] dark:hover:text-[#ECF1EE]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {savedNotice && (
        <div className="mt-5 flex items-center gap-2 rounded-lg border border-[#15803D]/30 bg-[#DCFCE7] px-4 py-3 text-sm font-medium text-[#166534] dark:border-[#34D399]/30 dark:bg-[#0D2E22] dark:text-[#6EE7B7]">
          <Check className="h-4 w-4 shrink-0" />
          <span>{savedNotice}</span>
        </div>
      )}

      {editorTab === 'rules' && (
        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="rounded-xl border border-[#D6DBD4] bg-white p-6 dark:border-[#233B32] dark:bg-[#11221C]">
            <h2 className="text-lg font-bold text-[#14201B] dark:text-[#ECF1EE]">
              บทลงโทษและจังหวะเวลา
            </h2>
            <p className="mt-1 text-sm text-[#54665E] dark:text-[#9CB0A6]">
              ปรับสมดุลความยากและป้องกันการเดาสุ่มของผู้เรียนทุกกลุ่ม
            </p>

            <div className="mt-6 space-y-6">
              <div>
                <div className="flex items-center justify-between text-sm">
                  <label htmlFor="lock-slider" className="font-medium text-[#14201B] dark:text-[#ECF1EE]">
                    เวลาล็อกปุ่มเมื่อตอบผิด
                  </label>
                  <span className="font-mono-num font-semibold text-[#0F3D2E] dark:text-[#D4AF67]">
                    {settingsForm.lockSeconds} วินาที
                  </span>
                </div>
                <input
                  id="lock-slider"
                  type="range"
                  min={0}
                  max={10}
                  step={1}
                  value={settingsForm.lockSeconds}
                  onChange={(e) =>
                    setSettingsForm((prev) => ({
                      ...prev,
                      lockSeconds: Number(e.target.value),
                    }))
                  }
                  className="mt-2 w-full accent-[#0F3D2E] dark:accent-[#D4AF67]"
                />
                <div className="mt-1 flex justify-between text-xs text-[#70827A] dark:text-[#789085]">
                  <span>0 วิ (ไม่ล็อก)</span>
                  <span>3 วิ (ค่าเริ่มต้น)</span>
                  <span>10 วิ</span>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between text-sm">
                  <label htmlFor="penalty-slider" className="font-medium text-[#14201B] dark:text-[#ECF1EE]">
                    บวกโทษเวลาเพิ่มเมื่อตอบผิด (ต่อครั้ง)
                  </label>
                  <span className="font-mono-num font-semibold text-[#0F3D2E] dark:text-[#D4AF67]">
                    +{settingsForm.penaltySeconds} วินาที
                  </span>
                </div>
                <input
                  id="penalty-slider"
                  type="range"
                  min={0}
                  max={10}
                  step={1}
                  value={settingsForm.penaltySeconds}
                  onChange={(e) =>
                    setSettingsForm((prev) => ({
                      ...prev,
                      penaltySeconds: Number(e.target.value),
                    }))
                  }
                  className="mt-2 w-full accent-[#0F3D2E] dark:accent-[#D4AF67]"
                />
                <div className="mt-1 flex justify-between text-xs text-[#70827A] dark:text-[#789085]">
                  <span>+0 วิ (ค่าเริ่มต้น)</span>
                  <span>+5 วิ</span>
                  <span>+10 วิ</span>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between text-sm">
                  <label htmlFor="reveal-slider" className="font-medium text-[#14201B] dark:text-[#ECF1EE]">
                    ระยะเวลาโชว์เฉลยก่อนไปข้อถัดไป
                  </label>
                  <span className="font-mono-num font-semibold text-[#0F3D2E] dark:text-[#D4AF67]">
                    {(settingsForm.revealDelayMs / 1000).toFixed(1)} วินาที
                  </span>
                </div>
                <input
                  id="reveal-slider"
                  type="range"
                  min={600}
                  max={3000}
                  step={100}
                  value={settingsForm.revealDelayMs}
                  onChange={(e) =>
                    setSettingsForm((prev) => ({
                      ...prev,
                      revealDelayMs: Number(e.target.value),
                    }))
                  }
                  className="mt-2 w-full accent-[#0F3D2E] dark:accent-[#D4AF67]"
                />
                <div className="mt-1 flex justify-between text-xs text-[#70827A] dark:text-[#789085]">
                  <span>0.6 วิ</span>
                  <span>1.3 วิ (ค่าเริ่มต้น)</span>
                  <span>3.0 วิ</span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col justify-between rounded-xl border border-[#D6DBD4] bg-white p-6 dark:border-[#233B32] dark:bg-[#11221C]">
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-bold text-[#14201B] dark:text-[#ECF1EE]">
                  คำตะโกนจบเกมและความชัดเจนของโจทย์
                </h2>
                <p className="mt-1 text-sm text-[#54665E] dark:text-[#9CB0A6]">
                  เปลี่ยนคำตะโกนได้หากต้องการเลี่ยงความสับสนกับคำตอบ "入住" ในข้อโจทย์
                </p>

                <label
                  htmlFor="shout-input"
                  className="mt-5 block text-sm font-medium text-[#14201B] dark:text-[#ECF1EE]"
                >
                  คำตะโกนเมื่อทำครบทุกข้อ
                </label>
                <input
                  id="shout-input"
                  type="text"
                  value={settingsForm.shoutWord}
                  onChange={(e) =>
                    setSettingsForm((prev) => ({ ...prev, shoutWord: e.target.value }))
                  }
                  className="font-cn mt-2 w-full rounded-lg border border-[#D6DBD4] bg-[#F5F5F0] px-3.5 py-2.5 text-lg font-semibold text-[#14201B] focus:border-[#0F3D2E] focus:outline-none dark:border-[#233B32] dark:bg-[#172B24] dark:text-[#ECF1EE] dark:focus:border-[#D4AF67]"
                />

                <div className="mt-3 flex flex-wrap gap-2">
                  {SHOUT_PRESETS.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() =>
                        setSettingsForm((prev) => ({ ...prev, shoutWord: preset }))
                      }
                      className={`font-cn rounded-lg border px-3 py-1.5 text-sm transition-colors cursor-pointer ${
                        settingsForm.shoutWord === preset
                          ? 'border-[#0F3D2E] bg-[#0F3D2E] text-white dark:border-[#D4AF67] dark:bg-[#D4AF67] dark:text-[#0A1612]'
                          : 'border-[#D6DBD4] bg-white text-[#14201B] hover:bg-[#EAECE8] dark:border-[#233B32] dark:bg-[#172B24] dark:text-[#ECF1EE]'
                      }`}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>

              <div className="border-t border-[#EAECE8] pt-5 dark:border-[#1E362D]">
                <label className="flex cursor-pointer items-start gap-3">
                  <input
                    type="checkbox"
                    checked={settingsForm.showContextHints}
                    onChange={(e) =>
                      setSettingsForm((prev) => ({
                        ...prev,
                        showContextHints: e.target.checked,
                      }))
                    }
                    className="mt-1 h-4 w-4 accent-[#0F3D2E] dark:accent-[#D4AF67]"
                  />
                  <div>
                    <span className="block text-sm font-semibold text-[#14201B] dark:text-[#ECF1EE]">
                      แสดงคำใบ้สถานการณ์ภาษาไทยใต้โจทย์
                    </span>
                    <span className="mt-0.5 block text-xs text-[#54665E] dark:text-[#9CB0A6]">
                      ช่วยลดความกำกวมของประโยคสั้นๆ (เช่น ห้องสแตนดาร์ด vs ห้องดีลักซ์) เพื่อให้ทุกกลุ่มมีความยากใกล้เคียงกัน
                    </span>
                  </div>
                </label>
              </div>
            </div>

            <div className="mt-8 flex justify-end">
              <button
                type="button"
                onClick={handleSaveRules}
                className="inline-flex items-center gap-2 rounded-lg bg-[#0F3D2E] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#14523E] dark:bg-[#D4AF67] dark:text-[#0A1612] dark:hover:bg-[#E2C281] cursor-pointer"
              >
                <Save className="h-4 w-4" />
                <span>บันทึกกติกาทั้งหมด</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {editorTab === 'vocab' && (
        <div className="mt-6 rounded-xl border border-[#D6DBD4] bg-white p-6 dark:border-[#233B32] dark:bg-[#11221C]">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-bold text-[#14201B] dark:text-[#ECF1EE]">
                รายการการ์ดคำศัพท์ ({vocabDraft.length} ใบ)
              </h2>
              <p className="text-sm text-[#54665E] dark:text-[#9CB0A6]">
                คำศัพท์เหล่านี้จะถูกสุ่มตำแหน่งเป็นปุ่มตัวเลือกในหน้าเล่นเกมของทุกกลุ่ม
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={addVocabItem}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[#D6DBD4] bg-[#F5F5F0] px-3.5 py-2 text-xs font-semibold text-[#14201B] hover:bg-[#EAECE8] dark:border-[#233B32] dark:bg-[#172B24] dark:text-[#ECF1EE] cursor-pointer"
              >
                <Plus className="h-4 w-4" />
                <span>เพิ่มคำศัพท์</span>
              </button>
              <button
                type="button"
                onClick={handleSaveContent}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#0F3D2E] px-4 py-2 text-xs font-semibold text-white hover:bg-[#14523E] dark:bg-[#D4AF67] dark:text-[#0A1612] cursor-pointer"
              >
                <Save className="h-4 w-4" />
                <span>บันทึกคำศัพท์</span>
              </button>
            </div>
          </div>

          <div className="mt-5 space-y-3">
            {vocabDraft.map((item, idx) => (
              <div
                key={item.id}
                className="grid grid-cols-1 gap-3 rounded-lg border border-[#EAECE8] bg-[#F5F5F0]/50 p-3 sm:grid-cols-12 sm:items-center dark:border-[#1E362D] dark:bg-[#0A1612]/40"
              >
                <span className="font-mono-num text-xs font-semibold text-[#54665E] sm:col-span-1 dark:text-[#9CB0A6]">
                  #{idx + 1}
                </span>
                <input
                  type="text"
                  aria-label="อักษรจีน"
                  value={item.zh}
                  onChange={(e) => updateVocabField(idx, 'zh', e.target.value)}
                  className="font-cn rounded-md border border-[#D6DBD4] bg-white px-3 py-2 text-base font-semibold text-[#14201B] sm:col-span-3 dark:border-[#233B32] dark:bg-[#11221C] dark:text-[#ECF1EE]"
                  placeholder="汉字"
                />
                <input
                  type="text"
                  aria-label="พินอิน"
                  value={item.pinyin}
                  onChange={(e) => updateVocabField(idx, 'pinyin', e.target.value)}
                  className="rounded-md border border-[#D6DBD4] bg-white px-3 py-2 text-sm text-[#14201B] sm:col-span-3 dark:border-[#233B32] dark:bg-[#11221C] dark:text-[#ECF1EE]"
                  placeholder="Pinyin"
                />
                <input
                  type="text"
                  aria-label="ความหมายภาษาไทย"
                  value={item.th}
                  onChange={(e) => updateVocabField(idx, 'th', e.target.value)}
                  className="rounded-md border border-[#D6DBD4] bg-white px-3 py-2 text-sm text-[#14201B] sm:col-span-4 dark:border-[#233B32] dark:bg-[#11221C] dark:text-[#ECF1EE]"
                  placeholder="ความหมายภาษาไทย"
                />
                <div className="flex justify-end sm:col-span-1">
                  <button
                    type="button"
                    disabled={vocabDraft.length <= 4}
                    onClick={() => removeVocabItem(idx)}
                    aria-label="ลบคำศัพท์"
                    className="rounded-md p-2 text-[#B91C1C] hover:bg-[#FEE2E2] disabled:opacity-30 dark:text-[#F87171] dark:hover:bg-[#3B1212] cursor-pointer disabled:cursor-not-allowed"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {editorTab === 'questions' && (
        <div className="mt-6 rounded-xl border border-[#D6DBD4] bg-white p-6 dark:border-[#233B32] dark:bg-[#11221C]">
          <div className="flex flex-col gap-4 border-b border-[#EAECE8] pb-5 sm:flex-row sm:items-center sm:justify-between dark:border-[#1E362D]">
            <div className="flex flex-wrap gap-2">
              {groupsDraft.map((g) => (
                <button
                  key={g.groupId}
                  type="button"
                  onClick={() => setActiveGroupId(g.groupId)}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
                    activeGroupId === g.groupId
                      ? 'border-[#0F3D2E] bg-[#0F3D2E] text-white dark:border-[#D4AF67] dark:bg-[#D4AF67] dark:text-[#0A1612]'
                      : 'border-[#D6DBD4] bg-[#F5F5F0] text-[#14201B] hover:bg-[#EAECE8] dark:border-[#233B32] dark:bg-[#172B24] dark:text-[#ECF1EE]'
                  }`}
                >
                  กลุ่ม {g.groupId}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleResetDefaults}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[#D6DBD4] bg-white px-3 py-2 text-xs font-medium text-[#54665E] hover:bg-[#EAECE8] dark:border-[#233B32] dark:bg-[#172B24] dark:text-[#9CB0A6] cursor-pointer"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>คืนค่าต้นฉบับ</span>
              </button>
              <button
                type="button"
                onClick={addQuestionToGroup}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[#D6DBD4] bg-[#F5F5F0] px-3 py-2 text-xs font-semibold text-[#14201B] hover:bg-[#EAECE8] dark:border-[#233B32] dark:bg-[#172B24] dark:text-[#ECF1EE] cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>เพิ่มข้อ</span>
              </button>
              <button
                type="button"
                onClick={handleSaveContent}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#0F3D2E] px-4 py-2 text-xs font-semibold text-white hover:bg-[#14523E] dark:bg-[#D4AF67] dark:text-[#0A1612] cursor-pointer"
              >
                <Save className="h-3.5 w-3.5" />
                <span>บันทึกโจทย์</span>
              </button>
            </div>
          </div>

          {currentGroup && (
            <div className="mt-5 space-y-5">
              {currentGroup.questions.map((q, qIdx) => (
                <div
                  key={q.id}
                  className="rounded-lg border border-[#EAECE8] bg-[#F5F5F0]/50 p-4 dark:border-[#1E362D] dark:bg-[#0A1612]/40"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-[#0F3D2E] dark:text-[#D4AF67]">
                      กลุ่ม {activeGroupId} · ข้อที่ {qIdx + 1}
                    </span>
                    <button
                      type="button"
                      disabled={currentGroup.questions.length <= 1}
                      onClick={() => removeQuestionFromGroup(qIdx)}
                      className="inline-flex items-center gap-1 text-xs font-medium text-[#B91C1C] hover:underline disabled:opacity-30 dark:text-[#F87171] cursor-pointer disabled:cursor-not-allowed"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span>ลบข้อนี้</span>
                    </button>
                  </div>

                  <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <label className="block text-xs font-medium text-[#54665E] dark:text-[#9CB0A6]">
                        ประโยคภาษาจีน (ใช้ ____ แทนช่องว่าง)
                      </label>
                      <input
                        type="text"
                        value={q.template}
                        onChange={(e) =>
                          updateQuestionField(qIdx, 'template', e.target.value)
                        }
                        className="font-cn mt-1 w-full rounded-md border border-[#D6DBD4] bg-white px-3 py-2 text-base text-[#14201B] dark:border-[#233B32] dark:bg-[#11221C] dark:text-[#ECF1EE]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-[#54665E] dark:text-[#9CB0A6]">
                        พินอิน (ใช้ ____ แทนช่องว่าง)
                      </label>
                      <input
                        type="text"
                        value={q.pinyinTemplate}
                        onChange={(e) =>
                          updateQuestionField(qIdx, 'pinyinTemplate', e.target.value)
                        }
                        className="mt-1 w-full rounded-md border border-[#D6DBD4] bg-white px-3 py-2 text-sm text-[#14201B] dark:border-[#233B32] dark:bg-[#11221C] dark:text-[#ECF1EE]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-[#54665E] dark:text-[#9CB0A6]">
                        คำแปลภาษาไทยเต็มประโยค
                      </label>
                      <input
                        type="text"
                        value={q.thTranslation}
                        onChange={(e) =>
                          updateQuestionField(qIdx, 'thTranslation', e.target.value)
                        }
                        className="mt-1 w-full rounded-md border border-[#D6DBD4] bg-white px-3 py-2 text-sm text-[#14201B] dark:border-[#233B32] dark:bg-[#11221C] dark:text-[#ECF1EE]"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-[#54665E] dark:text-[#9CB0A6]">
                          เฉลยคำศัพท์
                        </label>
                        <select
                          value={q.answerZh}
                          onChange={(e) =>
                            updateQuestionField(qIdx, 'answerZh', e.target.value)
                          }
                          className="font-cn mt-1 w-full rounded-md border border-[#D6DBD4] bg-white px-3 py-2 text-sm text-[#14201B] dark:border-[#233B32] dark:bg-[#11221C] dark:text-[#ECF1EE]"
                        >
                          {vocabDraft.map((v) => (
                            <option key={v.id} value={v.zh}>
                              {v.zh} ({v.th})
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-[#54665E] dark:text-[#9CB0A6]">
                          คำใบ้สถานการณ์ (ตัวเลือก)
                        </label>
                        <input
                          type="text"
                          value={q.contextHint ?? ''}
                          onChange={(e) =>
                            updateQuestionField(qIdx, 'contextHint', e.target.value)
                          }
                          className="mt-1 w-full rounded-md border border-[#D6DBD4] bg-white px-3 py-2 text-sm text-[#14201B] dark:border-[#233B32] dark:bg-[#11221C] dark:text-[#ECF1EE]"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
