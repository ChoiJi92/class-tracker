import type {
  ChatMessage,
  ClassRecord,
  StudentConfig,
  UnclassifiedMessage,
  ParseResult,
} from "./types";

const START_KEYWORDS = ["시작", "들어갑", "입장", "시작합"];
const END_KEYWORDS = ["종료", "끝", "마침", "퇴장", "끝났", "마쳤"];

function isStartMessage(content: string): boolean {
  return START_KEYWORDS.some((kw) => content.includes(kw));
}

function isEndMessage(content: string): boolean {
  return END_KEYWORDS.some((kw) => content.includes(kw));
}

function findStudentInMessage(
  content: string,
  config: StudentConfig
): string | null {
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

export function analyzeMessages(
  messages: ChatMessage[],
  config: StudentConfig
): ParseResult {
  const records: ClassRecord[] = [];
  const unclassified: UnclassifiedMessage[] = [];
  const pendingStarts = new Map<string, ClassRecord>();

  for (const msg of messages) {
    const isStart = isStartMessage(msg.content);
    const isEnd = isEndMessage(msg.content);

    if (!isStart && !isEnd) continue;

    const student = findStudentInMessage(msg.content, config);

    if (!student) {
      unclassified.push({
        id: genId(),
        message: msg,
        reason: "학생 이름을 찾을 수 없습니다",
      });
      continue;
    }

    const key = `${msg.sender}|${student}|${msg.date}`;

    if (isStart) {
      const record: ClassRecord = {
        id: genId(),
        teacher: msg.sender,
        student,
        date: msg.date,
        startTime: msg.time,
        endTime: null,
        durationMinutes: null,
      };
      pendingStarts.set(key, record);
    } else if (isEnd) {
      const pending = pendingStarts.get(key);
      if (pending) {
        pending.endTime = msg.time;
        pending.durationMinutes = calcDuration(pending.startTime, msg.time);
        records.push(pending);
        pendingStarts.delete(key);
      } else {
        records.push({
          id: genId(),
          teacher: msg.sender,
          student,
          date: msg.date,
          startTime: "",
          endTime: msg.time,
          durationMinutes: null,
        });
      }
    }
  }

  for (const pending of pendingStarts.values()) {
    records.push(pending);
  }

  records.sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    return a.startTime.localeCompare(b.startTime);
  });

  return { records, unclassified, totalMessages: messages.length };
}
