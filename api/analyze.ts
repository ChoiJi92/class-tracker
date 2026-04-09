import type { VercelRequest, VercelResponse } from "@vercel/node";
import { kv } from "@vercel/kv";
import AdmZip from "adm-zip";
import * as XLSX from "xlsx";

// ─── 타입 ────────────────────────────────────
interface ChatMessage {
  date: string;
  time: string;
  sender: string;
  content: string;
}

interface ClassRecord {
  id: string;
  teacher: string;
  student: string;
  date: string;
  startTime: string;
  endTime: string | null;
  durationMinutes: number | null;
}

interface StudentConfig {
  students: string[];
  nicknames: Record<string, string>;
}

// ─── 파서 ────────────────────────────────────
const PC_MESSAGE_REGEX = /^\[(.+?)\] \[(오전|오후) (\d{1,2}):(\d{2})\] (.+)/;
const MOBILE_MESSAGE_REGEX =
  /^(\d{4})\. (\d{1,2})\. (\d{1,2})\. (오전|오후) (\d{1,2}):(\d{2}), (.+?) : (.+)/;
const PC_DATE_REGEX = /^-+ (\d{4})년 (\d{1,2})월 (\d{1,2})일/;
const MOBILE_DATE_REGEX = /^(\d{4})년 (\d{1,2})월 (\d{1,2})일 [월화수목금토일]요일$/;

const SYSTEM_KEYWORDS = [
  "님이 들어왔습니다",
  "님이 나갔습니다",
  "님을 초대했습니다",
  "채팅방을 나갔습니다",
  "파일을 보냈습니다",
];

function convertTo24Hour(period: string, hour: number, minute: number): string {
  let h = hour;
  if (period === "오후" && h !== 12) h += 12;
  if (period === "오전" && h === 12) h = 0;
  return `${String(h).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function toDateStr(year: string, month: string, day: string): string {
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

function parseKakaoChat(text: string): ChatMessage[] {
  const lines = text.split("\n");
  const messages: ChatMessage[] = [];
  let currentDate = "";

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (trimmed.includes("지난 대화 보기")) continue;

    const pcDate = trimmed.match(PC_DATE_REGEX);
    if (pcDate) {
      currentDate = toDateStr(pcDate[1], pcDate[2], pcDate[3]);
      continue;
    }

    const mobileDate = trimmed.match(MOBILE_DATE_REGEX);
    if (mobileDate) {
      currentDate = toDateStr(mobileDate[1], mobileDate[2], mobileDate[3]);
      continue;
    }

    const pcMsg = trimmed.match(PC_MESSAGE_REGEX);
    if (pcMsg) {
      const [, sender, period, hourStr, minuteStr, content] = pcMsg;
      if (SYSTEM_KEYWORDS.some((kw) => content.includes(kw))) continue;
      const time = convertTo24Hour(period, parseInt(hourStr), parseInt(minuteStr));
      messages.push({ date: currentDate, time, sender, content });
      continue;
    }

    const mobileMsg = trimmed.match(MOBILE_MESSAGE_REGEX);
    if (mobileMsg) {
      const [, year, month, day, period, hourStr, minuteStr, sender, content] = mobileMsg;
      if (SYSTEM_KEYWORDS.some((kw) => content.includes(kw))) continue;
      const date = toDateStr(year, month, day);
      const time = convertTo24Hour(period, parseInt(hourStr), parseInt(minuteStr));
      messages.push({ date, time, sender: sender.trim(), content: content.trim() });
    }
  }

  return messages;
}

// ─── 분석기 ────────────────────────────────────
const START_KEYWORDS = ["시작", "들어갑", "입장", "시작합"];
const END_KEYWORDS = ["종료", "끝", "마침", "퇴장", "끝났", "마쳤"];

const EXCLUDE_PATTERNS = [
  "종료예정", "종료일", "종료까지", "종료일자",
  "시작예정", "시작일", "시작일자",
  "보고드립니다", "보고합니다", "예정입니다", "대상자",
];

function isExcludedMessage(content: string): boolean {
  const noSpace = content.replace(/\s/g, "");
  return EXCLUDE_PATTERNS.some((p) => noSpace.includes(p.replace(/\s/g, "")));
}

function isStartMessage(content: string): boolean {
  if (isExcludedMessage(content)) return false;
  return START_KEYWORDS.some((kw) => content.includes(kw));
}

function isEndMessage(content: string): boolean {
  if (isExcludedMessage(content)) return false;
  return END_KEYWORDS.some((kw) => content.includes(kw));
}

function findStudentInMessage(content: string, config: StudentConfig): string | null {
  const noSpace = content.replace(/\s/g, "");
  for (const name of config.students) {
    if (content.includes(name) || noSpace.includes(name.replace(/\s/g, ""))) return name;
  }
  for (const [nickname, realName] of Object.entries(config.nicknames)) {
    if (content.includes(nickname) || noSpace.includes(nickname.replace(/\s/g, ""))) return realName;
  }
  return null;
}

function calcDuration(start: string, end: string): number {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  return eh * 60 + em - (sh * 60 + sm);
}

let idCounter = 0;
function genId(): string {
  return `r-${Date.now()}-${idCounter++}`;
}

function analyzeMessages(messages: ChatMessage[], config: StudentConfig) {
  const records: ClassRecord[] = [];
  const pendingStarts = new Map<string, ClassRecord>();
  let unclassifiedCount = 0;

  for (const msg of messages) {
    const isStart = isStartMessage(msg.content);
    const isEnd = isEndMessage(msg.content);
    if (!isStart && !isEnd) continue;

    const student = findStudentInMessage(msg.content, config);
    if (!student) { unclassifiedCount++; continue; }

    const key = `${msg.sender}|${student}|${msg.date}`;

    if (isStart) {
      pendingStarts.set(key, {
        id: genId(), teacher: msg.sender, student, date: msg.date,
        startTime: msg.time, endTime: null, durationMinutes: null,
      });
    } else if (isEnd) {
      const pending = pendingStarts.get(key);
      if (pending) {
        pending.endTime = msg.time;
        pending.durationMinutes = calcDuration(pending.startTime, msg.time);
        records.push(pending);
        pendingStarts.delete(key);
      } else {
        records.push({
          id: genId(), teacher: msg.sender, student, date: msg.date,
          startTime: "", endTime: msg.time, durationMinutes: null,
        });
      }
    }
  }

  for (const pending of pendingStarts.values()) records.push(pending);
  records.sort((a, b) => a.date !== b.date ? a.date.localeCompare(b.date) : a.startTime.localeCompare(b.startTime));

  return { records, unclassifiedCount, totalMessages: messages.length };
}

// ─── 엑셀 생성 ────────────────────────────────
function generateExcel(records: ClassRecord[]): Buffer {
  const wb = XLSX.utils.book_new();
  const map = new Map<string, { teacher: string; student: string; sessions: string[] }>();

  for (const r of records) {
    const key = `${r.teacher}|${r.student}`;
    const row = map.get(key) || {
      teacher: r.teacher.replace(/^방문\s*/, "").replace(/t$/, "").trim(),
      student: r.student, sessions: [],
    };
    const start = r.startTime || "??:??";
    const end = r.endTime || "??:??";
    row.sessions.push(`${r.date}(${start}~${end})`);
    map.set(key, row);
  }

  const grouped = [...map.values()];
  const maxSessions = Math.max(0, ...grouped.map((r) => r.sessions.length));

  const headers = ["지도사명", "이용자명", "활동 횟수"];
  for (let i = 0; i < maxSessions; i++) headers.push("활동일자(시간)");

  const rows = grouped.map((row) => {
    const cells: (string | number)[] = [row.teacher, row.student, row.sessions.length];
    for (let i = 0; i < maxSessions; i++) cells.push(row.sessions[i] || "");
    return cells;
  });

  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  const cols = [{ wch: 12 }, { wch: 12 }, { wch: 10 }];
  for (let i = 0; i < maxSessions; i++) cols.push({ wch: 28 });
  ws["!cols"] = cols;

  XLSX.utils.book_append_sheet(wb, ws, "수업 기록");
  return Buffer.from(XLSX.write(wb, { type: "array", bookType: "xlsx" }) as Uint8Array);
}

// ─── zip에서 텍스트 추출 ──────────────────────
function extractTextFromZip(base64Data: string): string | null {
  try {
    const buffer = Buffer.from(base64Data, "base64");
    const zip = new AdmZip(buffer);
    const entries = zip.getEntries();
    const txtEntry = entries.find((e) => e.entryName.endsWith(".txt") || e.entryName.endsWith(".csv"));
    if (!txtEntry) return null;
    return txtEntry.getData().toString("utf-8");
  } catch {
    return null;
  }
}

// ─── 핸들러 ────────────────────────────────────
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "POST만 지원합니다" });
  }

  try {
    const { text, configId, month, file } = req.body;

    if (!configId) {
      return res.status(400).json({ error: "configId가 필요합니다" });
    }

    // text 또는 file(base64 zip) 중 하나 필요
    let chatText = text;
    if (!chatText && file) {
      chatText = extractTextFromZip(file);
      if (!chatText) {
        return res.status(400).json({ error: "zip에서 텍스트 파일을 찾을 수 없습니다" });
      }
    }

    if (!chatText) {
      return res.status(400).json({ error: "text 또는 file(base64)이 필요합니다" });
    }

    const config = await kv.get<StudentConfig>(`config:${configId}`);
    if (!config) {
      return res.status(404).json({ error: "학생 설정을 찾을 수 없습니다. 웹에서 먼저 설정해주세요." });
    }

    const messages = parseKakaoChat(chatText);
    if (messages.length === 0) {
      return res.status(400).json({ error: "메시지를 파싱할 수 없습니다" });
    }

    const filtered = month ? messages.filter((m) => m.date.startsWith(month)) : messages;
    const result = analyzeMessages(filtered, config);

    if (result.records.length === 0) {
      return res.status(200).json({
        message: "수업 기록을 찾을 수 없습니다",
        totalMessages: result.totalMessages,
        unclassifiedCount: result.unclassifiedCount,
      });
    }

    const buffer = generateExcel(result.records);
    const dateStr = new Date().toISOString().slice(0, 10);

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename=class-record-${dateStr}.xlsx`);
    res.setHeader("X-Total-Messages", String(result.totalMessages));
    res.setHeader("X-Records-Count", String(result.records.length));
    res.setHeader("X-Unclassified-Count", String(result.unclassifiedCount));

    return res.send(buffer);
  } catch (err) {
    console.error("analyze error:", err);
    return res.status(500).json({ error: "서버 오류가 발생했습니다" });
  }
}
