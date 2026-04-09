import type { VercelRequest, VercelResponse } from "@vercel/node";
import { kv } from "@vercel/kv";
import { parseKakaoChat } from "../src/lib/parser";
import { analyzeMessages } from "../src/lib/analyzer";
import { generateExcelBuffer } from "../src/lib/excelExporter";
import type { StudentConfig } from "../src/lib/types";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "POST만 지원합니다" });
  }

  const { text, configId, month } = req.body;

  if (!text || !configId) {
    return res.status(400).json({ error: "text와 configId가 필요합니다" });
  }

  // KV에서 학생 설정 가져오기
  const config = await kv.get<StudentConfig>(`config:${configId}`);
  if (!config) {
    return res.status(404).json({ error: "학생 설정을 찾을 수 없습니다. 웹에서 먼저 설정해주세요." });
  }

  // 파싱
  const messages = parseKakaoChat(text);
  if (messages.length === 0) {
    return res.status(400).json({ error: "메시지를 파싱할 수 없습니다. 카카오톡 내보내기 파일인지 확인하세요." });
  }

  // 월 필터링 (선택)
  const filtered = month
    ? messages.filter((m) => m.date.startsWith(month))
    : messages;

  // 분석
  const result = analyzeMessages(filtered, config);

  if (result.records.length === 0) {
    return res.status(200).json({
      message: "수업 기록을 찾을 수 없습니다",
      totalMessages: result.totalMessages,
      unclassifiedCount: result.unclassified.length,
    });
  }

  // 엑셀 생성 및 반환
  const arr = generateExcelBuffer(result.records);
  const buffer = Buffer.from(arr);
  const dateStr = new Date().toISOString().slice(0, 10);

  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  );
  res.setHeader(
    "Content-Disposition",
    `attachment; filename=class-record-${dateStr}.xlsx`
  );
  res.setHeader("X-Total-Messages", String(result.totalMessages));
  res.setHeader("X-Records-Count", String(result.records.length));
  res.setHeader("X-Unclassified-Count", String(result.unclassified.length));

  return res.send(buffer);
}
