import { useState } from "react";
import type { StudentConfig } from "@/lib/types";

interface Props {
  config: StudentConfig;
  onChange: (config: StudentConfig) => void;
}

export default function StudentManager({ config, onChange }: Props) {
  const [newName, setNewName] = useState("");
  const [nickName, setNickName] = useState("");
  const [nickTarget, setNickTarget] = useState("");

  const addStudent = () => {
    const name = newName.trim();
    if (!name || config.students.includes(name)) return;
    onChange({ ...config, students: [...config.students, name] });
    setNewName("");
  };

  const removeStudent = (name: string) => {
    const students = config.students.filter((s) => s !== name);
    const nicknames = { ...config.nicknames };
    for (const [nick, target] of Object.entries(nicknames)) {
      if (target === name) delete nicknames[nick];
    }
    onChange({ students, nicknames });
  };

  const addNickname = () => {
    const nick = nickName.trim();
    if (!nick || !nickTarget) return;
    onChange({ ...config, nicknames: { ...config.nicknames, [nick]: nickTarget } });
    setNickName("");
    setNickTarget("");
  };

  const removeNickname = (nick: string) => {
    const nicknames = { ...config.nicknames };
    delete nicknames[nick];
    onChange({ ...config, nicknames });
  };

  return (
    <div className="bg-white rounded-xl border p-5">
      <h2 className="text-lg font-bold mb-4">학생 관리</h2>

      <div className="flex gap-2 mb-4">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !e.nativeEvent.isComposing && addStudent()}
          placeholder="학생 이름"
          className="flex-1 border rounded-lg px-3 py-2 text-sm"
        />
        <button onClick={addStudent} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">
          추가
        </button>
      </div>

      {config.students.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-5">
          {config.students.map((name) => (
            <span key={name} className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-sm">
              {name}
              <button onClick={() => removeStudent(name)} className="text-blue-400 hover:text-red-500 ml-1">×</button>
            </span>
          ))}
        </div>
      )}

      <h3 className="text-sm font-semibold mb-2 text-gray-600">별명 등록</h3>
      <div className="flex flex-wrap gap-2 mb-3">
        <input value={nickName} onChange={(e) => setNickName(e.target.value)} placeholder='별명 (예: 길동)' className="flex-1 min-w-[100px] border rounded-lg px-3 py-2 text-sm" />
        <select value={nickTarget} onChange={(e) => setNickTarget(e.target.value)} className="flex-1 min-w-[100px] border rounded-lg px-3 py-2 text-sm">
          <option value="">학생 선택</option>
          {config.students.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <button onClick={addNickname} className="bg-gray-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-700 w-full sm:w-auto">
          등록
        </button>
      </div>

      {Object.keys(config.nicknames).length > 0 && (
        <div className="flex flex-wrap gap-2">
          {Object.entries(config.nicknames).map(([nick, real]) => (
            <span key={nick} className="inline-flex items-center gap-1 bg-gray-100 text-gray-700 px-3 py-1 rounded-full text-sm">
              {nick} → {real}
              <button onClick={() => removeNickname(nick)} className="text-gray-400 hover:text-red-500 ml-1">×</button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
