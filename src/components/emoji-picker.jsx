"use client";

import { useEffect, useRef, useState } from "react";
import { Smile } from "lucide-react";
import { Button } from "@/components/ui";
import { cn } from "@/lib/format";

const GROUPS = [
  {
    id: "smileys",
    label: "Sorrisos",
    items: ["😀", "😃", "😄", "😁", "😆", "😅", "😂", "🤣", "😊", "😇", "🙂", "😉", "😍", "🥰", "😘", "😋", "😜", "🤪", "🤗", "🤔", "😐", "🙄", "😏", "😔", "😪", "😴", "😷", "🤒", "🤕", "🥳", "😎", "🤓", "🥺", "😢", "😭", "😤", "😡", "🤬"],
  },
  {
    id: "gestures",
    label: "Gestos",
    items: ["👍", "👎", "👌", "✌️", "🤞", "🤟", "🤘", "🤙", "👋", "✋", "👏", "🙌", "🤝", "🙏", "💪", "🫶", "❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍", "💔", "✨", "⭐", "🔥", "💯"],
  },
  {
    id: "objects",
    label: "Atendimento",
    items: ["✅", "❌", "⚠️", "💡", "📝", "📅", "⏰", "📞", "💬", "📦", "🚚", "🏠", "🛍️", "🎁", "🎉", "💰", "💳", "🧾", "🔧", "🛠️", "❄️", "🌡️", "📺"],
  },
];

export function insertEmoji(textarea, value, emoji, onChange) {
  const current = String(value || "");
  const start = textarea && typeof textarea.selectionStart === "number" ? textarea.selectionStart : current.length;
  const end = textarea && typeof textarea.selectionEnd === "number" ? textarea.selectionEnd : current.length;
  const next = `${current.slice(0, start)}${emoji}${current.slice(end)}`;
  onChange(next);
  requestAnimationFrame(() => {
    if (!textarea) return;
    textarea.focus();
    const pos = start + emoji.length;
    textarea.setSelectionRange(pos, pos);
  });
}

export function EmojiPicker({ disabled, onSelect, className }) {
  const [open, setOpen] = useState(false);
  const [groupId, setGroupId] = useState(GROUPS[0].id);
  const [pos, setPos] = useState(null);
  const rootRef = useRef(null);
  const buttonRef = useRef(null);
  const group = GROUPS.find((item) => item.id === groupId) || GROUPS[0];

  useEffect(() => {
    if (disabled) setOpen(false);
  }, [disabled]);

  useEffect(() => {
    if (!open) {
      setPos(null);
      return undefined;
    }
    function place() {
      const rect = buttonRef.current?.getBoundingClientRect();
      if (!rect) return;
      const width = Math.min(320, window.innerWidth - 24);
      const left = Math.min(Math.max(12, rect.left), window.innerWidth - width - 12);
      setPos({
        left,
        bottom: window.innerHeight - rect.top + 8,
        width,
      });
    }
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    function onPointerDown(event) {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    }
    function onKeyDown(event) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <div ref={buttonRef} className="inline-flex">
        <Button
          type="button"
          variant="ghost"
          className="px-2 py-1.5"
          disabled={disabled}
          aria-expanded={open}
          aria-haspopup="dialog"
          onClick={(event) => {
            const rect = event.currentTarget.getBoundingClientRect();
            const width = Math.min(320, window.innerWidth - 24);
            const left = Math.min(Math.max(12, rect.left), window.innerWidth - width - 12);
            setPos({
              left,
              bottom: window.innerHeight - rect.top + 8,
              width,
            });
            setOpen((current) => !current);
          }}
        >
          <Smile size={16} />
          Emoji
        </Button>
      </div>
      {open ? (
        <div
          role="dialog"
          aria-label="Emoticons"
          className="fixed z-50 rounded-2xl border border-border bg-surface p-2 shadow-xl"
          style={{
            left: pos?.left ?? 12,
            bottom: pos?.bottom ?? 96,
            width: pos?.width ?? 320,
          }}
        >
          <div className="mb-2 flex gap-1">
            {GROUPS.map((item) => (
              <button
                key={item.id}
                type="button"
                className={cn(
                  "rounded-lg px-2 py-1 text-[11px] font-medium",
                  item.id === groupId ? "bg-accent/15 text-text" : "text-muted hover:bg-bg hover:text-text",
                )}
                onClick={() => setGroupId(item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>
          <div className="grid max-h-40 grid-cols-8 gap-0.5 overflow-y-auto">
            {group.items.map((emoji) => (
              <button
                key={emoji}
                type="button"
                className="rounded-lg px-1 py-1 text-lg leading-none hover:bg-bg"
                onClick={() => onSelect(emoji)}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
