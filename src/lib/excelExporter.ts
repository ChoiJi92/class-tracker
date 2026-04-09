import * as XLSX from "xlsx";
import type { ClassRecord } from "./types";

function cleanTeacherName(name: string): string {
  return name.replace(/^방문\s*/, "").replace(/t$/, "").trim();
}

function formatSession(r: ClassRecord): string {
  const start = r.startTime || "??:??";
  const end = r.endTime || "??:??";
  return `${r.date}(${start}~${end})`;
}

export function buildWorkbook(records: ClassRecord[]): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();

  // 선생님+학생별 그룹화
  const map = new Map<string, { teacher: string; student: string; sessions: string[] }>();
  for (const r of records) {
    const key = `${r.teacher}|${r.student}`;
    const row = map.get(key) || {
      teacher: cleanTeacherName(r.teacher),
      student: r.student,
      sessions: [],
    };
    row.sessions.push(formatSession(r));
    map.set(key, row);
  }

  const grouped = [...map.values()];
  const maxSessions = Math.max(0, ...grouped.map((r) => r.sessions.length));

  // 헤더 생성
  const headers = ["지도사명", "이용자명", "활동 횟수"];
  for (let i = 0; i < maxSessions; i++) {
    headers.push("활동일자(시간)");
  }

  // 데이터 행 생성
  const rows = grouped.map((row) => {
    const cells: (string | number)[] = [row.teacher, row.student, row.sessions.length];
    for (let i = 0; i < maxSessions; i++) {
      cells.push(row.sessions[i] || "");
    }
    return cells;
  });

  const wsData = [headers, ...rows];
  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // 열 너비 설정
  const cols = [{ wch: 12 }, { wch: 12 }, { wch: 10 }];
  for (let i = 0; i < maxSessions; i++) {
    cols.push({ wch: 28 });
  }
  ws["!cols"] = cols;

  XLSX.utils.book_append_sheet(wb, ws, "수업 기록");

  return wb;
}

export function exportToExcel(records: ClassRecord[]) {
  const wb = buildWorkbook(records);
  XLSX.writeFile(wb, `수업기록_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

export function generateExcelBuffer(records: ClassRecord[]): Uint8Array {
  const wb = buildWorkbook(records);
  return XLSX.write(wb, { type: "array", bookType: "xlsx" }) as Uint8Array;
}
