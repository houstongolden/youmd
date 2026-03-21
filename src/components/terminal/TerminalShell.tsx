"use client";

import { KeyboardEvent, useCallback } from "react";
import type { DisplayMessage, ThinkingCategory } from "@/hooks/useYouAgent";
import { MessageBubble } from "./MessageBubble";
import { ThinkingIndicator } from "./ThinkingIndicator";
import { TerminalInput } from "./TerminalInput";

interface TerminalShellProps {
  displayMessages: DisplayMessage[];
  input: string;
  setInput: (v: string) => void;
  isThinking: boolean;
  thinkingPhrase: string;
  thinkingCategory?: ThinkingCategory;
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  sendMessage: () => void;
  className?: string;
}

export function TerminalShell({
  displayMessages,
  input,
  setInput,
  isThinking,
  thinkingPhrase,
  thinkingCategory,
  messagesEndRef,
  textareaRef,
  sendMessage,
  className = "",
}: TerminalShellProps) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    },
    [sendMessage]
  );

  return (
    <div className={`flex flex-col h-full ${className}`}>
      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-4 py-4 min-h-0">
        <div className="space-y-3">
          {displayMessages.map((msg) => (
            <MessageBubble key={msg.id} message={msg} />
          ))}
          {isThinking && <ThinkingIndicator phrase={thinkingPhrase} category={thinkingCategory} />}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input area */}
      <TerminalInput
        input={input}
        setInput={setInput}
        isThinking={isThinking}
        textareaRef={textareaRef}
        onKeyDown={handleKeyDown}
        onSend={sendMessage}
      />
    </div>
  );
}
