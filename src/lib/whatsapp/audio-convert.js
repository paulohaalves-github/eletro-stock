import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const WHATSAPP_VOICE_MIME = "audio/ogg; codecs=opus";

function resolveFfmpeg() {
  const candidates = [];
  for (const locator of [import.meta.url, path.join(process.cwd(), "package.json")]) {
    try {
      const ffmpegPath = createRequire(locator)("ffmpeg-static");
      if (ffmpegPath) candidates.push(ffmpegPath);
    } catch {
      // ignore
    }
  }
  candidates.push("ffmpeg");
  return candidates.find((candidate) => candidate === "ffmpeg" || fs.existsSync(candidate)) || "ffmpeg";
}

function parseDuration(stderr) {
  const match = String(stderr || "").match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/);
  if (!match) return undefined;
  const seconds = Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]);
  if (!Number.isFinite(seconds) || seconds <= 0) return undefined;
  return Math.max(1, Math.round(seconds));
}

export async function convertToWhatsAppVoice(buffer) {
  if (!buffer?.length) {
    throw new Error("Áudio vazio.");
  }
  const ffmpeg = resolveFfmpeg();
  const id = randomUUID();
  const inputPath = path.join(os.tmpdir(), `wa-audio-in-${id}`);
  const outputPath = path.join(os.tmpdir(), `wa-audio-out-${id}.ogg`);
  await fs.promises.writeFile(inputPath, buffer);
  try {
    const stderr = await new Promise((resolve, reject) => {
      const proc = spawn(
        ffmpeg,
        [
          "-hide_banner",
          "-y",
          "-i",
          inputPath,
          "-vn",
          "-ac",
          "1",
          "-ar",
          "16000",
          "-c:a",
          "libopus",
          "-b:a",
          "24k",
          "-application",
          "voip",
          "-avoid_negative_ts",
          "make_zero",
          "-f",
          "ogg",
          outputPath,
        ],
        { windowsHide: true, stdio: ["ignore", "ignore", "pipe"] },
      );
      let output = "";
      proc.stderr?.on("data", (chunk) => {
        output += chunk.toString();
      });
      proc.on("error", () => {
        reject(new Error("Não foi possível converter o áudio. Verifique a dependência ffmpeg-static."));
      });
      proc.on("close", (code) => {
        if (code === 0 && fs.existsSync(outputPath)) resolve(output);
        else reject(new Error("Não foi possível converter o áudio para o formato do WhatsApp."));
      });
    });
    const converted = await fs.promises.readFile(outputPath);
    if (!converted.length) {
      throw new Error("Não foi possível converter o áudio para o formato do WhatsApp.");
    }
    return {
      buffer: converted,
      mimeType: WHATSAPP_VOICE_MIME,
      seconds: parseDuration(stderr),
    };
  } finally {
    await Promise.all([
      fs.promises.unlink(inputPath).catch(() => {}),
      fs.promises.unlink(outputPath).catch(() => {}),
    ]);
  }
}
