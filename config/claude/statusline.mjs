#!/usr/bin/env node
// Custom Claude Code statusline
// Receives a JSON object on stdin, outputs one ANSI-colored line per logical row.
// Wraps to a new line rather than truncating when content is wide.

import { readFileSync, existsSync } from "fs";
import { execSync } from "child_process";
import { homedir } from "os";
import { join } from "path";

// ── ANSI helpers ────────────────────────────────────────────────────────────

const R = "\x1b[0m";
const BOLD = "\x1b[1m";

function fg(code) { return `\x1b[${code}m`; }

const C = {
  black:   fg(30),
  red:     fg(31),
  green:   fg(32),
  yellow:  fg(33),
  blue:    fg(34),
  magenta: fg(35),
  cyan:    fg(36),
  white:   fg(37),
  gray:    fg(90),
};

function col(color, text) {
  return `${color}${text}${R}`;
}

// ── Progress bar ─────────────────────────────────────────────────────────────

function progressBar(percent, width = 16) {
  const filled = Math.round(Math.max(0, Math.min(100, percent)) / 100 * width);
  const empty = width - filled;
  return "[" + "█".repeat(filled) + "░".repeat(empty) + "]";
}

// ── Git helpers ───────────────────────────────────────────────────────────────

function git(args, cwd) {
  try {
    return execSync(`git ${args}`, {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      timeout: 2000,
    }).trim();
  } catch {
    return null;
  }
}

function gitRepoName(cwd) {
  const root = git("rev-parse --show-toplevel", cwd);
  if (!root) return null;
  return root.split(/[/\\]/).filter(Boolean).at(-1) ?? null;
}

function gitBranch(cwd) {
  return git("branch --show-current", cwd);
}

function gitStatusEmoji(cwd) {
  const status = git("status --porcelain", cwd);
  if (status === null) return null;
  if (status === "") return "✓";

  let staged = false, unstaged = false, untracked = false;
  for (const line of status.split("\n")) {
    const x = line[0] ?? " ";
    const y = line[1] ?? " ";
    if (x === "?" && y === "?") { untracked = true; continue; }
    if (x !== " " && x !== "?") staged = true;
    if (y !== " " && y !== "?") unstaged = true;
  }

  const parts = [];
  if (staged)    parts.push("●");
  if (unstaged)  parts.push("✎");
  if (untracked) parts.push("?");
  return parts.join("") || "✓";
}

// ── JSONL helpers ─────────────────────────────────────────────────────────────

function readJsonlSync(path) {
  if (!existsSync(path)) return [];
  try {
    return readFileSync(path, "utf8")
      .split("\n")
      .filter(Boolean)
      .map(line => { try { return JSON.parse(line); } catch { return null; } })
      .filter(Boolean);
  } catch {
    return [];
  }
}

function sessionDuration(transcriptPath) {
  const lines = readJsonlSync(transcriptPath);
  let first = null, last = null;
  for (const e of lines) {
    if (e.timestamp) { first = new Date(e.timestamp); break; }
  }
  for (let i = lines.length - 1; i >= 0; i--) {
    if (lines[i]?.timestamp) { last = new Date(lines[i].timestamp); break; }
  }
  if (!first || !last) return null;
  const totalMin = Math.floor((last - first) / 60000);
  if (totalMin < 1) return "<1m";
  const h = Math.floor(totalMin / 60), m = totalMin % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}hr`;
  return `${h}hr ${m}m`;
}

function contextMetrics(transcriptPath) {
  const lines = readJsonlSync(transcriptPath);
  let latest = null, latestTime = null;
  for (const e of lines) {
    if (e.message?.usage && e.isSidechain !== true && !e.isApiErrorMessage && e.timestamp) {
      const t = new Date(e.timestamp);
      if (!latestTime || t > latestTime) { latestTime = t; latest = e; }
    }
  }
  if (!latest) return null;
  const u = latest.message.usage;
  const contextLength =
    (u.input_tokens ?? 0) +
    (u.cache_read_input_tokens ?? 0) +
    (u.cache_creation_input_tokens ?? 0);
  return { contextLength };
}

// ── Thinking effort ───────────────────────────────────────────────────────────

function thinkingEffort(transcriptPath) {
  if (transcriptPath) {
    const lines = readJsonlSync(transcriptPath);
    const prefix = "<local-command-stdout>Set model to ";
    const regex = /with (low|medium|high|xhigh|max) effort<\/local-command-stdout>$/i;
    for (let i = lines.length - 1; i >= 0; i--) {
      const content = lines[i]?.message?.content;
      if (typeof content === "string" && content.trimStart().startsWith(prefix)) {
        const m = regex.exec(content.trim());
        if (m) return m[1].toLowerCase();
      }
    }
  }
  try {
    const settingsPath = join(homedir(), ".claude", "settings.json");
    if (existsSync(settingsPath)) {
      const s = JSON.parse(readFileSync(settingsPath, "utf8"));
      const e = s.effortLevel?.toLowerCase();
      if (["low","medium","high","xhigh","max"].includes(e)) return e;
    }
  } catch {}
  return "medium";
}

// ── Model display ─────────────────────────────────────────────────────────────

function modelName(model) {
  if (!model) return null;
  const raw = typeof model === "string" ? model : model.display_name ?? model.id;
  if (!raw) return null;
  return raw
    .replace(/^([a-z]+\.)*anthropic\./, "")
    .replace(/^claude-/, "")
    .replace(/\s*\([^)]*\)\s*/g, "")
    .replace(/\[[^\]]*\]$/, "")
    .trim();
}

// ── Context window size for model ─────────────────────────────────────────────

const MODEL_CONTEXT = {
  "claude-opus-4":    200000,
  "claude-sonnet-4":  200000,
  "claude-haiku-4":   200000,
  "claude-3-7":       200000,
  "claude-3-5":       200000,
  "claude-3":         200000,
};

function maxTokensForModel(modelId) {
  if (!modelId) return 200000;
  for (const [key, val] of Object.entries(MODEL_CONTEXT)) {
    if (modelId.includes(key)) return val;
  }
  return 200000;
}

// ── Segment builders ──────────────────────────────────────────────────────────

function buildSegments(data) {
  const cwd = data.workspace?.current_dir ?? data.workspace?.project_dir ?? data.cwd ?? process.cwd();
  const transcriptPath = data.transcript_path;

  // Context bar
  let ctxSeg = null;
  {
    const cw = data.context_window;
    let used = null, total = null;

    if (cw) {
      total = cw.context_window_size ?? null;
      if (cw.used_percentage != null && total != null) {
        used = Math.round(cw.used_percentage / 100 * total);
      } else if (cw.current_usage != null) {
        if (typeof cw.current_usage === "number") {
          used = cw.current_usage;
        } else {
          used = (cw.current_usage.input_tokens ?? 0)
               + (cw.current_usage.cache_creation_input_tokens ?? 0)
               + (cw.current_usage.cache_read_input_tokens ?? 0);
        }
      }
    }

    if ((used === null || total === null) && transcriptPath) {
      const m = contextMetrics(transcriptPath);
      if (m) {
        used = used ?? m.contextLength;
        total = total ?? maxTokensForModel(typeof data.model === "string" ? data.model : data.model?.id);
      }
    }

    if (used !== null && total !== null && total > 0) {
      const pct = Math.max(0, Math.min(100, used / total * 100));
      const usedK = Math.round(used / 1000);
      const totalK = Math.round(total / 1000);
      ctxSeg = col(C.white, `📊 ${progressBar(pct, 8)} ${usedK}k/${totalK}k`);
    }
  }

  // Project + branch + status
  const repo = gitRepoName(cwd);
  const branch = gitBranch(cwd);
  const statusEmoji = repo ? gitStatusEmoji(cwd) : null;

  const gitSeg = repo
    ? col(C.cyan, `📁 ${repo}`) +
      (branch ? " " + col(C.magenta, `⎇ ${branch}`) : "") +
      (statusEmoji ? " " + col(
        statusEmoji === "✓" ? C.green : statusEmoji.includes("●") ? C.yellow : C.red,
        statusEmoji
      ) : "")
    : null;

  // Session clock
  let clockSeg = null;
  {
    const durationMs = data.cost?.total_duration_ms;
    if (typeof durationMs === "number" && Number.isFinite(durationMs) && durationMs >= 0) {
      const totalMin = Math.floor(durationMs / 60000);
      const h = Math.floor(totalMin / 60), m = totalMin % 60;
      const fmt = h === 0 ? `${m}m` : m === 0 ? `${h}hr` : `${h}hr ${m}m`;
      clockSeg = col(C.yellow, `⏱ ${fmt}`);
    } else if (transcriptPath) {
      const dur = sessionDuration(transcriptPath);
      if (dur) clockSeg = col(C.yellow, `⏱ ${dur}`);
    }
  }

  // Thinking effort
  const effort = thinkingEffort(transcriptPath);
  const thinkingSeg = col(C.blue, `🧠 ${effort}`);

  // Model
  const model = modelName(data.model);
  const modelSeg = model ? col(C.cyan, `🤖 ${model}`) : null;

  return [gitSeg, thinkingSeg, modelSeg, ctxSeg, clockSeg].filter(Boolean);
}

// ── Layout: wrap into lines that fit the terminal ─────────────────────────────

function stripAnsi(str) {
  return str.replace(/\x1b\[[0-9;]*m/g, "");
}

function probeTerminalWidth() {
  if (process.platform === "win32") return null;
  try {
    const tty = execSync("ps -o tty= -p $(ps -o ppid= -p $$)", {
      encoding: "utf8", stdio: ["pipe", "pipe", "ignore"], shell: "/bin/sh",
    }).trim();
    if (tty && tty !== "??" && tty !== "?") {
      const width = execSync(`stty size < /dev/${tty} | awk '{print $2}'`, {
        encoding: "utf8", stdio: ["pipe", "pipe", "ignore"], shell: "/bin/sh",
      }).trim();
      const n = parseInt(width, 10);
      if (!isNaN(n) && n > 0) return n;
    }
  } catch {}
  try {
    const width = execSync("tput cols 2>/dev/null", {
      encoding: "utf8", stdio: ["pipe", "pipe", "ignore"],
    }).trim();
    const n = parseInt(width, 10);
    if (!isNaN(n) && n > 0) return n;
  } catch {}
  return null;
}

function layoutSegments(segments) {
  // Claude Code reserves ~40 cols on the right for its prompt UI.
  const detected = process.stdout.columns ?? probeTerminalWidth() ?? 120;
  const cols = Math.max(20, detected - 40);
  const sep = "  ";
  const lines = [];
  let current = [], currentLen = 0;

  for (const seg of segments) {
    const segLen = stripAnsi(seg).length;
    const sepLen = current.length > 0 ? sep.length : 0;
    if (current.length > 0 && currentLen + sepLen + segLen > cols) {
      lines.push(current.join(sep));
      current = [seg];
      currentLen = segLen;
    } else {
      current.push(seg);
      currentLen += sepLen + segLen;
    }
  }
  if (current.length > 0) lines.push(current.join(sep));
  return lines;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function readStdin() {
  if (process.stdin.isTTY) return null;
  const chunks = [];
  process.stdin.setEncoding("utf8");
  for await (const chunk of process.stdin) chunks.push(chunk);
  return chunks.join("");
}

(async () => {
  const input = await readStdin();
  if (!input?.trim()) return;

  let data;
  try { data = JSON.parse(input); } catch { return; }

  const segments = buildSegments(data);
  const lines = layoutSegments(segments);
  for (const line of lines) process.stdout.write("\x1b[0m" + line + "\x1b[0m\n");
})();
