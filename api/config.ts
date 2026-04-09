import type { VercelRequest, VercelResponse } from "@vercel/node";
import { kv } from "@vercel/kv";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { id } = req.query;

  if (!id || typeof id !== "string") {
    return res.status(400).json({ error: "id 파라미터가 필요합니다" });
  }

  const key = `config:${id}`;

  if (req.method === "GET") {
    const config = await kv.get(key);
    if (!config) return res.status(404).json({ error: "설정을 찾을 수 없습니다" });
    return res.json(config);
  }

  if (req.method === "PUT") {
    const { students, nicknames } = req.body;
    if (!Array.isArray(students)) {
      return res.status(400).json({ error: "students 배열이 필요합니다" });
    }
    const config = { students, nicknames: nicknames || {} };
    await kv.set(key, config);
    return res.json({ ok: true });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
