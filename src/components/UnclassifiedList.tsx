import { useState, useMemo } from "react";
import type { UnclassifiedMessage, StudentConfig, ClassRecord } from "@/lib/types";

interface Props {
  items: UnclassifiedMessage[];
  studentConfig: StudentConfig;
  onResolve: (id: string, record: ClassRecord) => void;
  onDismiss: (id: string) => void;
  onAddStudent: (name: string) => void;
}

const NOISE_WORDS = /\d+월|\d+일|\d+시|\d+분|월요일|화요일|수요일|목요일|금요일|토요일|일요일|보충|연장|마지막|첫|회기|어머니|아버지|부모|저는|이번주|다음주|모레|오늘|내일|어제/;

function extractName(content: string): string | null {
  // "김하늘 아동 수업 시작합니다" → "김하늘"
  // "타키 모모에 씨 수업 끝났습니다" → "타키 모모에"
  // "최지한 수업 시작합니다" → "최지한"

  // 1) "이름 + 아동/학생/씨" 패턴
  const withSuffix = content.match(/^(.+?)\s+(?:아동|학생|씨|어린이)\b/);
  if (withSuffix) {
    const name = withSuffix[1].trim();
    if (!NOISE_WORDS.test(name) && name.length >= 2) return name;
  }

  // 2) "이름 + 수업" 패턴 (아동/학생 없이)
  const beforeClass = content.match(/^(.+?)\s+수업/);
  if (beforeClass) {
    const name = beforeClass[1].trim();
    if (!NOISE_WORDS.test(name) && name.length >= 2 && !/^\d/.test(name)) return name;
  }

  return null;
}

let resolveCounter = 0;

export default function UnclassifiedList({ items, studentConfig, onResolve, onDismiss, onAddStudent }: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedStudent, setSelectedStudent] = useState("");
  const [selectedType, setSelectedType] = useState<"start" | "end">("start");

  // 미분류 메시지에서 학생 이름 후보 추출 + 공백 무시 병합
  const nameSummary = useMemo(() => {
    const raw = new Map<string, { display: string; count: number }>();
    for (const item of items) {
      const name = extractName(item.message.content);
      if (!name) continue;
      const key = name.replace(/\s/g, ""); // 공백 제거로 병합
      const existing = raw.get(key);
      if (existing) {
        existing.count++;
      } else {
        raw.set(key, { display: name, count: 1 });
      }
    }
    // 건수 내림차순 정렬
    return [...raw.values()].sort((a, b) => b.count - a.count);
  }, [items]);

  if (items.length === 0) return null;

  const handleResolve = (item: UnclassifiedMessage) => {
    if (!selectedStudent) return;
    onResolve(item.id, {
      id: `manual-${Date.now()}-${resolveCounter++}`,
      teacher: item.message.sender,
      student: selectedStudent,
      date: item.message.date,
      startTime: selectedType === "start" ? item.message.time : "",
      endTime: selectedType === "end" ? item.message.time : null,
      durationMinutes: null,
    });
    setEditingId(null);
    setSelectedStudent("");
  };

  return (
    <div className="bg-white rounded-xl border">
      <div className="p-5 border-b">
        <h2 className="text-lg font-bold">
          미분류 메시지 <span className="text-sm font-normal text-orange-600">({items.length}건)</span>
        </h2>
        {nameSummary.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-3">
            {nameSummary.map(({ display, count }) => (
              <button
                key={display}
                onClick={() => onAddStudent(display.replace(/\s/g, ""))}
                className="inline-flex items-center gap-1 bg-orange-50 text-orange-700 px-3 py-1 rounded-full text-sm hover:bg-orange-100 transition-colors"
              >
                {display} ({count}건)
                <span className="text-orange-400 text-xs ml-1">+ 등록</span>
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="divide-y max-h-96 overflow-y-auto">
        {items.map((item) => (
          <div key={item.id} className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm">
                  <span className="font-medium">[{item.message.sender}]</span>{" "}
                  <span className="text-gray-500">{item.message.date} {item.message.time}</span>
                </p>
                <p className="text-sm mt-1">{item.message.content}</p>
                <p className="text-xs text-orange-500 mt-1">{item.reason}</p>
              </div>
              <div className="flex gap-2 shrink-0">
                <button onClick={() => setEditingId(editingId === item.id ? null : item.id)} className="text-sm text-blue-600 hover:text-blue-800">처리</button>
                <button onClick={() => onDismiss(item.id)} className="text-sm text-gray-400 hover:text-red-500">무시</button>
              </div>
            </div>
            {editingId === item.id && (
              <div className="mt-3 flex flex-wrap gap-2 items-center">
                <select value={selectedStudent} onChange={(e) => setSelectedStudent(e.target.value)} className="flex-1 min-w-[120px] border rounded-lg px-2 py-2 text-sm">
                  <option value="">학생 선택</option>
                  {studentConfig.students.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
                <select value={selectedType} onChange={(e) => setSelectedType(e.target.value as "start" | "end")} className="border rounded-lg px-2 py-2 text-sm">
                  <option value="start">수업 시작</option>
                  <option value="end">수업 종료</option>
                </select>
                <button onClick={() => handleResolve(item)} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700">확인</button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
