import { useState, useCallback, useMemo } from "react";
import FileUploader from "./components/FileUploader";
import StudentManager from "./components/StudentManager";
import ResultTable from "./components/ResultTable";
import UnclassifiedList from "./components/UnclassifiedList";
import { parseKakaoChat } from "./lib/parser";
import { analyzeMessages } from "./lib/analyzer";
import { exportToExcel } from "./lib/excelExporter";
import type {
  StudentConfig,
  ClassRecord,
  ChatMessage,
} from "./lib/types";

const STORAGE_KEY = "class-tracker-students";

function loadStudentConfig(): StudentConfig {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return JSON.parse(saved);
  } catch {
    /* ignore */
  }
  return { students: [], nicknames: {} };
}

function getAvailableMonths(messages: ChatMessage[]): string[] {
  const months = new Set<string>();
  for (const msg of messages) {
    if (msg.date) months.add(msg.date.slice(0, 7)); // "2026-03"
  }
  return [...months].sort();
}

function formatMonth(ym: string): string {
  const [year, month] = ym.split("-");
  return `${year}년 ${parseInt(month)}월`;
}

export default function App() {
  const [studentConfig, setStudentConfig] =
    useState<StudentConfig>(loadStudentConfig);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [manualRecords, setManualRecords] = useState<ClassRecord[]>([]);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [selectedMonth, setSelectedMonth] = useState("");

  const availableMonths = useMemo(
    () => getAvailableMonths(messages),
    [messages],
  );

  const filteredMessages = useMemo(() => {
    if (!selectedMonth) return messages;
    return messages.filter((m) => m.date.startsWith(selectedMonth));
  }, [messages, selectedMonth]);

  const handleConfigChange = useCallback((config: StudentConfig) => {
    setStudentConfig(config);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  }, []);

  const analysisResult = useMemo(() => {
    if (filteredMessages.length === 0) return { records: [], unclassified: [], totalMessages: 0 };
    return analyzeMessages(filteredMessages, studentConfig);
  }, [filteredMessages, studentConfig]);

  const records = useMemo(
    () => [...analysisResult.records, ...manualRecords],
    [analysisResult.records, manualRecords],
  );
  const unclassified = useMemo(
    () => analysisResult.unclassified.filter((u) => !dismissedIds.has(u.id)),
    [analysisResult.unclassified, dismissedIds],
  );
  const totalMessages = analysisResult.totalMessages;

  const handleFileLoaded = useCallback((text: string) => {
    const parsed = parseKakaoChat(text);
    setMessages(parsed);
    setSelectedMonth("");
    setManualRecords([]);
    setDismissedIds(new Set());
  }, []);

  const handleResolve = useCallback((id: string, record: ClassRecord) => {
    setManualRecords((prev) => [...prev, record]);
    setDismissedIds((prev) => new Set(prev).add(id));
  }, []);

  const handleDismiss = useCallback((id: string) => {
    setDismissedIds((prev) => new Set(prev).add(id));
  }, []);

  const handleAddStudent = useCallback((name: string) => {
    setStudentConfig((prev) => {
      if (prev.students.includes(name)) return prev;
      const updated = { ...prev, students: [...prev.students, name] };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  return (
    <main className="max-w-4xl mx-auto px-4 py-8">
      <header className="mb-8">
        <h1 className="text-2xl font-bold">수업 관리 트래커</h1>
        <p className="text-gray-500 mt-1">
          카카오톡 대화 파일을 업로드하여 수업 기록을 자동으로 정리합니다
        </p>
      </header>

      <div className="space-y-6">
        <FileUploader onFileLoaded={handleFileLoaded} />
        <StudentManager config={studentConfig} onChange={handleConfigChange} />

        {availableMonths.length > 0 && (
          <div className="flex items-center gap-3 bg-white rounded-xl border p-4">
            <span className="text-sm font-medium text-gray-700">월 선택:</span>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="border rounded-lg px-3 py-1.5 text-sm"
            >
              <option value="">전체 기간</option>
              {availableMonths.map((m) => (
                <option key={m} value={m}>
                  {formatMonth(m)}
                </option>
              ))}
            </select>
            {selectedMonth && (
              <span className="text-xs text-gray-500">
                {filteredMessages.length}건의 메시지
              </span>
            )}
          </div>
        )}

        {totalMessages > 0 && (
          <div className="flex items-center justify-between bg-white rounded-xl border p-4">
            <div className="text-sm text-gray-600">
              전체 메시지 <strong>{totalMessages}</strong>건 중{" "}
              <strong className="text-green-600">{records.length}</strong>건
              분류됨
              {unclassified.length > 0 && (
                <span>
                  ,{" "}
                  <strong className="text-orange-600">
                    {unclassified.length}
                  </strong>
                  건 미분류
                </span>
              )}
            </div>
            <button
              onClick={() => exportToExcel(records)}
              disabled={records.length === 0}
              className="bg-green-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              엑셀 다운로드
            </button>
          </div>
        )}

        <UnclassifiedList
          items={unclassified}
          studentConfig={studentConfig}
          onResolve={handleResolve}
          onDismiss={handleDismiss}
          onAddStudent={handleAddStudent}
        />
        <ResultTable records={records} />
      </div>
    </main>
  );
}
