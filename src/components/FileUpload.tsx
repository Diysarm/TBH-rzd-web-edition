import { useCallback, useState } from "react";
import { DEFAULT_PASSWORD } from "../core/es3";
import { cn } from "../lib/cn";

const PASSWORD_STORAGE_KEY = "tbh-web-es3-password";

export function loadStoredPassword(): string {
  return localStorage.getItem(PASSWORD_STORAGE_KEY) ?? DEFAULT_PASSWORD;
}

export function storePassword(password: string): void {
  if (password === DEFAULT_PASSWORD) {
    localStorage.removeItem(PASSWORD_STORAGE_KEY);
  } else {
    localStorage.setItem(PASSWORD_STORAGE_KEY, password);
  }
}

export function FileUpload({
  onFile,
  busy,
  error,
  password,
  onPasswordChange,
}: {
  onFile: (file: File) => void;
  busy: boolean;
  error: string | null;
  password: string;
  onPasswordChange: (password: string) => void;
}) {
  const [dragOver, setDragOver] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(password !== DEFAULT_PASSWORD);

  const handleFiles = useCallback(
    (files: FileList | null) => {
      if (!files?.length || busy) return;
      const file = files[0];
      if (!file.name.toLowerCase().endsWith(".es3")) {
        return;
      }
      onFile(file);
    },
    [busy, onFile],
  );

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-4">
      <div
        className={cn(
          "flex flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-12 text-center transition-colors",
          dragOver ? "border-accent bg-accent/5" : "border-border bg-panel/50",
          busy && "pointer-events-none opacity-60",
        )}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          handleFiles(e.dataTransfer.files);
        }}
      >
        <div className="text-4xl">📁</div>
        <h2 className="mt-3 text-lg font-semibold">Upload save file</h2>
        <p className="mt-1 max-w-sm text-sm text-muted">
          Drop your <code className="text-accent">SaveFile_Live.es3</code> here or browse. File stays
          in your browser — nothing is uploaded to a server.
        </p>
        <label className="mt-4 cursor-pointer rounded-lg bg-accent px-4 py-2 text-sm font-medium text-bg hover:opacity-90">
          {busy ? "Processing…" : "Choose file"}
          <input
            type="file"
            accept=".es3"
            className="hidden"
            disabled={busy}
            onChange={(e) => handleFiles(e.target.files)}
          />
        </label>
        <p className="mt-3 text-xs text-muted">
          Default path:{" "}
          <code className="text-[11px]">
            %USERPROFILE%\AppData\LocalLow\TesseractStudio\TaskbarHero\SaveFile_Live.es3
          </code>
        </p>
      </div>

      <div className="rounded-lg border border-border bg-panel px-4 py-3 text-sm">
        <button
          type="button"
          className="text-muted hover:text-fg"
          onClick={() => setShowAdvanced((v) => !v)}
        >
          {showAdvanced ? "▾" : "▸"} Advanced: ES3 password
        </button>
        {showAdvanced && (
          <div className="mt-2 flex flex-col gap-1.5">
            <label className="text-xs text-muted">
              Only change this if decryption fails after a game update. Default password is pre-filled.
            </label>
            <input
              type="text"
              value={password}
              onChange={(e) => {
                onPasswordChange(e.target.value);
                storePassword(e.target.value);
              }}
              spellCheck={false}
              autoComplete="off"
              className="rounded-md border border-border bg-bg px-2.5 py-1.5 font-mono text-xs outline-none focus:border-accent"
            />
            <a
              href="https://taskbarhero.wiki/save-inspector"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-accent hover:underline"
            >
              Check current password on TaskbarHero Save Inspector →
            </a>
          </div>
        )}
      </div>

      {error && (
        <div className="rounded-lg border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
          {error.includes("wrong password") && (
            <p className="mt-2 text-xs text-muted">
              Tip: close the game before copying the save (avoid mid-write files). If the game was
              recently updated, open Advanced above and paste the new password from the Save Inspector.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
