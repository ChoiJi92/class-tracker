import { useMemo } from "react";
import type { ClassRecord } from "@/lib/types";

interface Props {
  records: ClassRecord[];
}

interface GroupedRow {
  teacher: string;
  student: string;
  count: number;
  sessions: string[]; // "2026-03-03(13:59~15:45)"
}

function cleanTeacherName(name: string): string {
  return name.replace(/^방문\s*/, "").replace(/t$/, "").trim();
}

function formatSession(r: ClassRecord): string {
  const start = r.startTime || "??:??";
  const end = r.endTime || "??:??";
  return `${r.date}(${start}~${end})`;
}

export default function ResultTable({ records }: Props) {
  const grouped = useMemo(() => {
    const map = new Map<string, GroupedRow>();
    for (const r of records) {
      const key = `${r.teacher}|${r.student}`;
      const row = map.get(key) || {
        teacher: cleanTeacherName(r.teacher),
        student: r.student,
        count: 0,
        sessions: [],
      };
      row.count++;
      row.sessions.push(formatSession(r));
      map.set(key, row);
    }
    return [...map.values()];
  }, [records]);

  const maxSessions = useMemo(
    () => Math.max(0, ...grouped.map((r) => r.sessions.length)),
    [grouped]
  );

  if (records.length === 0) return null;

  return (
    <div className="bg-white rounded-xl border">
      <div className="p-5 border-b">
        <h2 className="text-lg font-bold">수업 기록</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-100 text-gray-700">
            <tr>
              <th className="px-4 py-3 text-left font-bold whitespace-nowrap">지도사명</th>
              <th className="px-4 py-3 text-left font-bold whitespace-nowrap">이용자명</th>
              <th className="px-4 py-3 text-left font-bold whitespace-nowrap">활동 횟수</th>
              {Array.from({ length: maxSessions }, (_, i) => (
                <th key={i} className="px-4 py-3 text-left font-bold whitespace-nowrap">활동일자(시간)</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">
            {grouped.map((row) => (
              <tr key={`${row.teacher}|${row.student}`} className="hover:bg-gray-50">
                <td className="px-4 py-3 whitespace-nowrap">{row.teacher}</td>
                <td className="px-4 py-3 whitespace-nowrap">{row.student}</td>
                <td className="px-4 py-3 text-right">{row.count}</td>
                {Array.from({ length: maxSessions }, (_, i) => (
                  <td key={i} className="px-4 py-3 whitespace-nowrap">{row.sessions[i] || ""}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
