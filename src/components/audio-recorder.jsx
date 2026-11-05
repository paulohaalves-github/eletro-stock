"use client";
"use no memo";

import { useEffect, useRef, useState } from "react";
import { Mic, Square, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui";

const MAX_SECONDS = 120;

function pickRecorderMime() {
  if (typeof MediaRecorder === "undefined") return "";
  const types = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus", "audio/mp4"];
  return types.find((type) => MediaRecorder.isTypeSupported(type)) || "";
}

function extensionForMime(mime) {
  const base = String(mime || "").toLowerCase().split(";")[0].trim();
  if (base.includes("ogg")) return ".ogg";
  if (base.includes("mp4") || base.includes("aac")) return ".m4a";
  return ".webm";
}

function formatTimer(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

export function AudioRecorder({ disabled, onRecorded }) {
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const mediaRef = useRef(null);
  const chunksRef = useRef([]);
  const streamRef = useRef(null);
  const startedAtRef = useRef(0);
  const timerRef = useRef(null);

  function cleanupStream() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }

  function stopTimer() {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }

  useEffect(() => () => {
    try {
      if (mediaRef.current?.state === "recording") {
        mediaRef.current.onstop = null;
        mediaRef.current.stop();
      }
    } catch {
      // ignore
    }
    cleanupStream();
    stopTimer();
  }, []);

  useEffect(() => {
    if (!disabled) return;
    try {
      if (mediaRef.current?.state === "recording") {
        mediaRef.current.onstop = null;
        mediaRef.current.stop();
      }
    } catch {
      // ignore
    }
    chunksRef.current = [];
    mediaRef.current = null;
    cleanupStream();
    stopTimer();
    setRecording(false);
    setElapsed(0);
  }, [disabled]);

  function cancelRecording() {
    try {
      if (mediaRef.current && mediaRef.current.state !== "inactive") {
        mediaRef.current.onstop = null;
        mediaRef.current.stop();
      }
    } catch {
      // ignore
    }
    chunksRef.current = [];
    mediaRef.current = null;
    cleanupStream();
    stopTimer();
    setRecording(false);
    setElapsed(0);
  }

  async function startRecording() {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      toast.error("Seu navegador não grava áudio. Use HTTPS ou anexe um arquivo.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mime = pickRecorderMime();
      const recorder = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data?.size) chunksRef.current.push(event.data);
      };
      const recordedMime = recorder.mimeType || mime || "audio/webm";
      recorder.onstop = () => {
        const fileType = recordedMime || "audio/webm";
        const blob = new Blob(chunksRef.current, { type: fileType });
        chunksRef.current = [];
        mediaRef.current = null;
        cleanupStream();
        stopTimer();
        setRecording(false);
        setElapsed(0);
        if (!blob.size) {
          toast.error("Não foi possível gravar o áudio.");
          return;
        }
        const fileName = `audio${extensionForMime(fileType)}`;
        let file;
        try {
          file = new File([blob], fileName, { type: fileType });
        } catch {
          file = new File([blob], fileName, { type: fileType.split(";")[0] || "audio/webm" });
        }
        onRecorded?.(file);
      };
      mediaRef.current = recorder;
      recorder.start();
      startedAtRef.current = Date.now();
      setElapsed(0);
      setRecording(true);
      timerRef.current = setInterval(() => {
        const seconds = Math.floor((Date.now() - startedAtRef.current) / 1000);
        setElapsed(seconds);
        if (seconds >= MAX_SECONDS) stopRecording();
      }, 250);
    } catch {
      cleanupStream();
      toast.error("Não foi possível acessar o microfone. Permita o acesso no navegador.");
    }
  }

  function stopRecording() {
    stopTimer();
    try {
      if (mediaRef.current && mediaRef.current.state === "recording") {
        mediaRef.current.stop();
        return;
      }
    } catch {
      // ignore
    }
    cancelRecording();
  }

  if (recording) {
    return (
      <div className="inline-flex items-center gap-2 rounded-xl bg-rose-500/10 px-2 py-1 text-xs text-rose-200">
        <span className="h-2 w-2 animate-pulse rounded-full bg-rose-400" />
        <span className="tabular-nums font-medium">{formatTimer(elapsed)}</span>
        <button type="button" className="rounded-full p-1 hover:bg-rose-500/20" onClick={cancelRecording} aria-label="Cancelar gravação">
          <X size={14} />
        </button>
        <Button type="button" variant="ghost" className="px-2 py-1 text-xs" onClick={stopRecording}>
          <Square size={12} />
          Parar
        </Button>
      </div>
    );
  }

  return (
    <Button type="button" variant="ghost" className="px-2 py-1.5" disabled={disabled} onClick={startRecording}>
      <Mic size={16} />
      Gravar
    </Button>
  );
}
