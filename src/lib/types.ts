export interface ChatMessage {
  date: string;
  time: string;
  sender: string;
  content: string;
}

export interface ClassRecord {
  id: string;
  teacher: string;
  student: string;
  date: string;
  startTime: string;
  endTime: string | null;
  durationMinutes: number | null;
}

export interface StudentConfig {
  students: string[];
  nicknames: Record<string, string>;
}

export interface UnclassifiedMessage {
  id: string;
  message: ChatMessage;
  reason: string;
}

export interface ParseResult {
  records: ClassRecord[];
  unclassified: UnclassifiedMessage[];
  totalMessages: number;
}
