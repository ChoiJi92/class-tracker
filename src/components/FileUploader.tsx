import { useCallback, useRef, useState } from "react";

interface Props {
  onFileLoaded: (text: string) => void;
}

export default function FileUploader({ onFileLoaded }: Props) {
  const [isDragging, setIsDragging] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const lastTextRef = useRef<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    (file: File) => {
      setFileName(file.name);
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        lastTextRef.current = text;
        onFileLoaded(text);
      };
      reader.readAsText(file, "UTF-8");
    },
    [onFileLoaded]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file && (file.name.endsWith(".txt") || file.name.endsWith(".csv"))) handleFile(file);
    },
    [handleFile]
  );

  const handleReanalyze = useCallback(() => {
    if (lastTextRef.current) {
      onFileLoaded(lastTextRef.current);
    }
  }, [onFileLoaded]);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const f = e.target.files?.[0];
      if (f) handleFile(f);
      // 같은 파일 다시 선택 가능하도록 초기화
      e.target.value = "";
    },
    [handleFile]
  );

  return (
    <div>
      <div
        onDrop={handleDrop}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        className={`border-2 border-dashed rounded-xl p-6 sm:p-10 text-center cursor-pointer transition-colors ${
          isDragging ? "border-blue-500 bg-blue-50" : "border-gray-300 hover:border-gray-400"
        }`}
      >
        <input ref={inputRef} type="file" accept=".txt,.csv" onChange={handleInputChange} className="hidden" id="file-input" />
        <label htmlFor="file-input" className="cursor-pointer">
          <div className="text-4xl mb-3">📄</div>
          <p className="text-base sm:text-lg font-medium">카카오톡 대화 파일(.txt/.csv)을 드래그하거나 클릭하여 업로드</p>
          <p className="text-xs sm:text-sm text-gray-500 mt-1">PC에서 Ctrl+S로 저장한 파일 또는 모바일 내보내기 파일</p>
          {fileName && <p className="mt-3 text-sm text-blue-600 font-medium">업로드됨: {fileName}</p>}
        </label>
      </div>
      {fileName && (
        <div className="flex gap-2 mt-3 justify-end">
          <button
            onClick={handleReanalyze}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700"
          >
            다시 분석하기
          </button>
          <button
            onClick={() => inputRef.current?.click()}
            className="bg-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-300"
          >
            다른 파일 올리기
          </button>
        </div>
      )}
    </div>
  );
}
