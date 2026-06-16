"use client";

import { KeyboardEvent, ClipboardEvent, ChangeEvent, useCallback, useEffect, useRef, useState } from "react";
import { CornerDownLeft, Mic, Plus } from "lucide-react";

/** mac/iOS → ⌘k, everything else → ctrl+k. SSR defaults to mac; the hint
 *  is suppressHydrationWarning'd so other platforms correct on hydration. */
function detectMacPlatform(): boolean {
  if (typeof navigator === "undefined") return true;
  return /mac|iphone|ipad|ipod/i.test(navigator.platform || navigator.userAgent || "");
}

type BrowserSpeechRecognitionEvent = {
  resultIndex: number;
  results: ArrayLike<ArrayLike<{ transcript: string }>>;
};

type BrowserSpeechRecognition = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  onresult: ((event: BrowserSpeechRecognitionEvent) => void) | null;
  start: () => void;
  stop: () => void;
};

type BrowserSpeechRecognitionConstructor = new () => BrowserSpeechRecognition;

function getSpeechRecognition(): BrowserSpeechRecognitionConstructor | null {
  if (typeof window === "undefined") return null;
  const speechWindow = window as typeof window & {
    SpeechRecognition?: BrowserSpeechRecognitionConstructor;
    webkitSpeechRecognition?: BrowserSpeechRecognitionConstructor;
  };
  return speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition ?? null;
}

interface TerminalInputProps {
  input: string;
  setInput: (v: string) => void;
  isThinking: boolean;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  onKeyDown: (e: KeyboardEvent<HTMLTextAreaElement>) => void;
  onSend: () => void;
  /** Called when an image is pasted — receives the data URL */
  onImagePaste?: (dataUrl: string) => void;
  /** Opens the command palette (cmd+k hint on desktop, /help chip on mobile) */
  onOpenPalette?: () => void;
}

export function TerminalInput({
  input,
  setInput,
  textareaRef,
  onKeyDown,
  onSend,
  onImagePaste,
  onOpenPalette,
}: TerminalInputProps) {
  const [pastedImage, setPastedImage] = useState<string | null>(null);
  const [voiceState, setVoiceState] = useState<"idle" | "listening" | "unsupported">("idle");
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const isMac = detectMacPlatform();

  const handlePaste = useCallback((e: ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (const item of Array.from(items)) {
      if (item.type.startsWith("image/")) {
        e.preventDefault();
        const file = item.getAsFile();
        if (!file) continue;

        const reader = new FileReader();
        reader.onload = () => {
          const dataUrl = reader.result as string;
          setPastedImage(dataUrl);
          onImagePaste?.(dataUrl);
        };
        reader.readAsDataURL(file);
        return;
      }
    }
  }, [onImagePaste]);

  const clearImage = useCallback(() => {
    setPastedImage(null);
  }, []);

  const attachImage = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setPastedImage(dataUrl);
      onImagePaste?.(dataUrl);
    };
    reader.readAsDataURL(file);
  }, [onImagePaste]);

  const attachTextFile = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? "").slice(0, 20000);
      const fenced = `\n\n[attached file: ${file.name}]\n\`\`\`\n${text}\n\`\`\``;
      setInput(`${input.trimEnd()}${fenced}`);
      requestAnimationFrame(() => textareaRef.current?.focus());
    };
    reader.readAsText(file);
  }, [input, setInput, textareaRef]);

  const handleFileAttach = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (file.type.startsWith("image/")) {
      attachImage(file);
      return;
    }
    attachTextFile(file);
  }, [attachImage, attachTextFile]);

  const startVoiceMode = useCallback(() => {
    const Recognition = getSpeechRecognition();
    if (!Recognition) {
      setVoiceState("unsupported");
      setInput(input.trim() ? `${input.trimEnd()} /voice ` : "/voice ");
      requestAnimationFrame(() => textareaRef.current?.focus());
      return;
    }

    recognitionRef.current?.stop();
    const recognition = new Recognition();
    const baseInput = input.trimEnd();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    recognition.onresult = (event) => {
      let transcript = "";
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        transcript += event.results[index][0]?.transcript ?? "";
      }
      setInput(`${baseInput}${baseInput && transcript ? " " : ""}${transcript}`.trimStart());
    };
    recognition.onerror = () => setVoiceState("idle");
    recognition.onend = () => setVoiceState("idle");
    recognitionRef.current = recognition;
    setVoiceState("listening");
    recognition.start();
  }, [input, setInput, textareaRef]);

  useEffect(() => {
    const handleShortcut = (event: globalThis.KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key.toLowerCase() === "m") {
        event.preventDefault();
        startVoiceMode();
      }
    };
    window.addEventListener("keydown", handleShortcut);
    return () => {
      window.removeEventListener("keydown", handleShortcut);
      recognitionRef.current?.stop();
    };
  }, [startVoiceMode]);

  return (
    <div className="shrink-0 border-t border-[hsl(var(--border))]/70 terminal-input-sticky bg-[hsl(var(--bg-raised))] pb-[env(safe-area-inset-bottom)] outline outline-1 -outline-offset-1 outline-transparent transition-[border-color,outline-color] focus-within:border-[hsl(var(--accent))]/70 focus-within:outline-[hsl(var(--accent))]">
      {/* Pasted image preview */}
      {pastedImage && (
        <div className="mx-4 mt-3 flex items-start gap-2 bg-[hsl(var(--bg))] p-2" style={{ borderRadius: "var(--radius)" }}>
          <div className="overflow-hidden shrink-0" style={{ borderRadius: "var(--radius)" }}>
            {/* eslint-disable-next-line @next/next/no-img-element -- pasted data URLs are local previews, not optimizable assets */}
            <img
              src={pastedImage}
              alt="pasted"
              className="w-16 h-16 object-cover"
            />
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-mono text-[hsl(var(--text-secondary))] opacity-40">
              image attached
            </span>
            <button
              onClick={clearImage}
              className="text-[10px] font-mono text-[hsl(var(--accent))] opacity-60 hover:opacity-100 transition-opacity text-left"
            >
              remove
            </button>
          </div>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        className="sr-only"
        accept="image/*,.txt,.md,.markdown,.json,.jsonl,.csv,.ts,.tsx,.js,.jsx,.py,.html,.css,.xml,.yaml,.yml"
        onChange={handleFileAttach}
        aria-label="Attach image or text file"
      />

      <div className="bg-[hsl(var(--bg-raised))] transition-colors focus-within:bg-[hsl(var(--bg))]">
        <div className="flex items-end gap-2 px-5 py-3">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            onPaste={handlePaste}
            placeholder={pastedImage ? "add a message with this image..." : "ask anything, or type /help for commands"}
            aria-label="chat message"
            name="chat-message"
            rows={1}
            autoComplete="off"
            spellCheck={false}
            enterKeyHint="send"
            className="min-h-11 flex-1 resize-none border-0 bg-transparent px-0 py-3 font-mono text-[13px] leading-5 text-foreground outline-none ring-0 caret-accent placeholder:text-muted-foreground/30 focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0"
            style={{ maxHeight: "160px" }}
          />
          <button
            type="button"
            onClick={() => {
              onSend();
              setPastedImage(null);
            }}
            disabled={!input.trim() && !pastedImage}
            className="mb-1 flex h-9 w-9 shrink-0 items-center justify-center bg-[hsl(var(--accent))] text-white transition-[background,color,opacity] hover:bg-[hsl(var(--accent-dark))] disabled:cursor-not-allowed disabled:bg-transparent disabled:text-[hsl(var(--text-secondary))] disabled:opacity-35"
            style={{ borderRadius: "var(--radius)" }}
            aria-label="Send"
          >
            <CornerDownLeft size={15} strokeWidth={2} aria-hidden="true" />
          </button>
        </div>
        <div className="flex items-center gap-3 px-5 pb-3">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            aria-label="Attach image or text file"
            title="Attach image or text file"
            className="flex h-7 w-7 cursor-pointer items-center justify-center text-[hsl(var(--text-secondary))] opacity-45 transition-[background,color,opacity] hover:bg-[hsl(var(--bg))] hover:text-[hsl(var(--text-primary))] hover:opacity-90"
            style={{ borderRadius: "var(--radius)" }}
          >
            <Plus size={14} strokeWidth={1.8} aria-hidden="true" />
          </button>
          <span className="hidden sm:inline text-[10px] font-mono text-[hsl(var(--text-secondary))] opacity-25">
            enter to send
          </span>
          <span className="hidden sm:inline text-[hsl(var(--text-secondary))] opacity-10">|</span>
          {/* Mobile: tappable /help chip — opens the command palette */}
          <button
            type="button"
            onClick={onOpenPalette}
            aria-label="show commands"
            className="sm:hidden text-[10px] font-mono text-[hsl(var(--text-secondary))] opacity-55 active:opacity-85 transition-opacity py-2 -my-2 px-1.5 -mx-1.5"
          >
            /help
          </button>
          {/* Desktop: platform-aware shortcut hint — clicking also opens the palette */}
          <button
            type="button"
            onClick={onOpenPalette}
            aria-label="open command palette"
            className="hidden sm:inline text-[10px] font-mono text-[hsl(var(--text-secondary))] opacity-45 hover:opacity-70 transition-opacity"
            suppressHydrationWarning
          >
            {isMac ? "cmd k" : "ctrl k"} commands
          </button>
          <span className="text-[hsl(var(--text-secondary))] opacity-10">|</span>
          <span className="text-[10px] font-mono text-[hsl(var(--text-secondary))] opacity-25">
            paste or attach
          </span>
          <span className="hidden sm:inline text-[hsl(var(--text-secondary))] opacity-10">|</span>
          <button
            type="button"
            onClick={startVoiceMode}
            aria-label="Start voice mode"
            title={voiceState === "unsupported" ? "Voice mode needs browser speech support; Whisper backend next" : "Start voice mode"}
            className={[
              "hidden cursor-pointer items-center gap-1.5 font-mono text-[10px] transition-[color,opacity] sm:inline-flex",
              voiceState === "listening"
                ? "text-[hsl(var(--accent))] opacity-85"
                : "text-[hsl(var(--text-secondary))] opacity-35 hover:text-[hsl(var(--text-primary))] hover:opacity-75",
            ].join(" ")}
            suppressHydrationWarning
          >
            <Mic size={12} strokeWidth={1.8} aria-hidden="true" />
            {isMac ? "cmd shift m" : "ctrl shift m"} voice
          </button>
        </div>
      </div>
    </div>
  );
}
