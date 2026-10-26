"use client";

import {
  type FormEvent,
  type KeyboardEvent,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { Button } from "@/components/ui/button";

const MAX_EDITOR_HEIGHT = 320;

function fitToContent(textarea: HTMLTextAreaElement) {
  textarea.style.height = "auto";
  textarea.style.height = `${Math.min(textarea.scrollHeight, MAX_EDITOR_HEIGHT)}px`;
}

export function MessageEditor({
  initialText,
  onCancel,
  onSubmit,
}: {
  initialText: string;
  onCancel: () => void;
  onSubmit: (text: string) => void;
}) {
  const [text, setText] = useState(initialText);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const canSubmit = text.trim().length > 0;

  useLayoutEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) {
      return;
    }
    fitToContent(textarea);
    textarea.focus();
    textarea.setSelectionRange(textarea.value.length, textarea.value.length);
  }, []);

  const submit = () => {
    if (canSubmit) {
      onSubmit(text);
    }
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    submit();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.nativeEvent.isComposing) {
      return;
    }
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      submit();
    } else if (event.key === "Escape") {
      event.preventDefault();
      onCancel();
    }
  };

  return (
    <form
      className="flex w-full flex-col gap-2 rounded-[18px] border border-transparent bg-secondary px-2 pt-1.5 pb-2 transition-colors focus-within:border-primary"
      onSubmit={handleSubmit}
    >
      <textarea
        aria-label="Edit message"
        className="block w-full resize-none border-0 bg-transparent px-2 pt-[7px] text-base text-foreground leading-[1.6] outline-hidden md:text-[15px]"
        onChange={(event) => {
          setText(event.target.value);
          fitToContent(event.target);
        }}
        onKeyDown={handleKeyDown}
        ref={textareaRef}
        rows={1}
        value={text}
      />
      <div className="flex justify-end gap-1.5">
        <Button
          className="rounded-[10px]"
          onClick={onCancel}
          size="sm"
          type="button"
          variant="ghost"
        >
          Cancel
        </Button>
        <Button
          className="rounded-[10px]"
          disabled={!canSubmit}
          size="sm"
          type="submit"
        >
          Send
        </Button>
      </div>
    </form>
  );
}
