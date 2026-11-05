"use client";
"use no memo";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Smile } from "lucide-react";
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

function panelStyle(rect) {
  const width = Math.min(320, window.innerWidth - 24);
  return {
    left: Math.min(Math.max(12, rect.left), window.innerWidth - width - 12),
    bottom: window.innerHeight - rect.top + 8,
    width,
  };
}

export function EmojiPicker({ disabled, onSelect, className }) {
  const [open, setOpen] = useState(false);
  const [groupId, setGroupId] = useState(GROUPS[0].id);
  const [pos, setPos] = useState(null);
  const [mounted, setMounted] = useState(false);
  const buttonRef = useRef(null);
  const dialogRef = useRef(null);
  const group = GROUPS.find((item) => item.id === groupId) || GROUPS[0];

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (disabled) setOpen(false);
  }, [disabled]);

  useEffect(() => {
    if (!open) return undefined;
    function place() {
      const rect = buttonRef.current?.getBoundingClientRect();
      if (!rect) return;
      setPos(panelStyle(rect));
    }
    function onPointerDown(event) {
      if (buttonRef.current?.contains(event.target) || dialogRef.current?.contains(event.target)) return;
      setOpen(false);
    }
    function onKeyDown(event) {
      if (event.key === "Escape") setOpen(false);
    }
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  useEffect(() => () => setOpen(false), []);

  const panel = open && mounted && pos
    ? createPortal(
      <div
        ref={dialogRef}
        role="dialog"
        aria-label="Emoticons"
        className="fixed z-[80] rounded-2xl border border-border bg-surface p-2 shadow-xl"
        style={pos}
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
              onClick={() => {
                onSelect(emoji);
                setOpen(false);
              }}
            >
              {emoji}
            </button>
          ))}
        </div>
      </div>,
      document.body,
    )
    : null;

  return (
    <div className={cn("inline-flex", className)}>
      <button
        ref={buttonRef}
        type="button"
        disabled={disabled}
        aria-expanded={open}
        aria-haspopup="dialog"
        className="inline-flex items-center justify-center gap-2 rounded-xl px-2 py-1.5 text-sm font-semibold text-muted transition hover:bg-surface-2 hover:text-text disabled:pointer-events-none disabled:opacity-50"
        onClick={() => {
          if (disabled) return;
          const rect = buttonRef.current?.getBoundingClientRect();
          if (rect) setPos(panelStyle(rect));
          setOpen((current) => !current);
        }}
      >
        <Smile size={16} />
        Emoji
      </button>
      {panel}
    </div>
  );
}
