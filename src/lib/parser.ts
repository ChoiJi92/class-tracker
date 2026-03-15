import type { ChatMessage } from "./types";

// PC 형식: [이름] [오후 2:30] 내용
const PC_MESSAGE_REGEX = /^\[(.+?)\] \[(오전|오후) (\d{1,2}):(\d{2})\] (.+)/;
// 모바일 형식: 2025. 1. 17. 오후 3:41, 이름 : 내용
const MOBILE_MESSAGE_REGEX = /^(\d{4})\. (\d{1,2})\. (\d{1,2})\. (오전|오후) (\d{1,2}):(\d{2}), (.+?) : (.+)/;
// PC 날짜 구분선: --------------- 2026년 3월 15일 일요일 ---------------
const PC_DATE_REGEX = /^-+ (\d{4})년 (\d{1,2})월 (\d{1,2})일/;
// 모바일 날짜 구분선: 2025년 1월 17일 금요일
const MOBILE_DATE_REGEX = /^(\d{4})년 (\d{1,2})월 (\d{1,2})일 [월화수목금토일]요일$/;

const SKIP_LINES = ["지난 대화 보기"];
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

export function parseKakaoChat(text: string): ChatMessage[] {
  const lines = text.split("\n");
  const messages: ChatMessage[] = [];
  let currentDate = "";

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (SKIP_LINES.some((s) => trimmed.includes(s))) continue;

    // PC 날짜 구분선
    const pcDate = trimmed.match(PC_DATE_REGEX);
    if (pcDate) {
      currentDate = toDateStr(pcDate[1], pcDate[2], pcDate[3]);
      continue;
    }

    // 모바일 날짜 구분선
    const mobileDate = trimmed.match(MOBILE_DATE_REGEX);
    if (mobileDate) {
      currentDate = toDateStr(mobileDate[1], mobileDate[2], mobileDate[3]);
      continue;
    }

    // PC 메시지: [이름] [오후 2:30] 내용
    const pcMsg = trimmed.match(PC_MESSAGE_REGEX);
    if (pcMsg) {
      const [, sender, period, hourStr, minuteStr, content] = pcMsg;
      if (SYSTEM_KEYWORDS.some((kw) => content.includes(kw))) continue;
      const time = convertTo24Hour(period, parseInt(hourStr), parseInt(minuteStr));
      messages.push({ date: currentDate, time, sender, content });
      continue;
    }

    // 모바일 메시지: 2025. 1. 17. 오후 3:41, 이름 : 내용
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
