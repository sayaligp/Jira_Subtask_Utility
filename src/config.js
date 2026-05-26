import fs from "fs";
import path from "path";
import os from "os";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const BASE_DIR = path.join(os.homedir(), ".jira-flow");
const CONFIG_PATH = path.join(BASE_DIR, "config.json");
const TASKS_PATH = path.join(BASE_DIR, "tasks.json");
const SESSIONS_DIR = path.join(BASE_DIR, "sessions");
const TICKET_CACHE_DIR = path.join(BASE_DIR, "ticket-cache");

const DEFAULT_CONFIG = path.join(__dirname, "../templates/config.default.json");
const DEFAULT_TASKS = path.join(__dirname, "../templates/tasks.default.json");

export function ensureUserFiles() {
  if (!fs.existsSync(BASE_DIR)) {
    fs.mkdirSync(BASE_DIR);
  }

  if (!fs.existsSync(SESSIONS_DIR)) {
    fs.mkdirSync(SESSIONS_DIR);
  }

  if (!fs.existsSync(TICKET_CACHE_DIR)) {
    fs.mkdirSync(TICKET_CACHE_DIR);
  }

  if (!fs.existsSync(CONFIG_PATH)) {
    fs.copyFileSync(DEFAULT_CONFIG, CONFIG_PATH);
    console.log("📄 config.json created at ~/.jira-flow (please update it)");
  }

  if (!fs.existsSync(TASKS_PATH)) {
    fs.copyFileSync(DEFAULT_TASKS, TASKS_PATH);
    console.log("📄 tasks.json created at ~/.jira-flow (editable)");
  }
}

export function loadConfig() {
  return JSON.parse(fs.readFileSync(CONFIG_PATH, "utf-8"));
}

export function loadTasks() {
  return JSON.parse(fs.readFileSync(TASKS_PATH, "utf-8"));
}

// ------------------------------------
// TICKET CACHE
// ------------------------------------

export function writeTicketCache(ticket) {
  const filePath = path.join(TICKET_CACHE_DIR, `${ticket.key}.json`);
  fs.writeFileSync(filePath, JSON.stringify(ticket, null, 2), "utf-8");
  return filePath;
}

export function ticketCachePath(key) {
  return path.join(TICKET_CACHE_DIR, `${key}.json`);
}

function deleteTicketCache(key) {
  const filePath = path.join(TICKET_CACHE_DIR, `${key}.json`);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
}

// ------------------------------------
// SESSION MANAGEMENT
// ------------------------------------

function sessionPath(parentKey) {
  return path.join(SESSIONS_DIR, `${parentKey}.json`);
}

export function writeSession(parentKey, subtasks) {
  const data = {
    parent: parentKey,
    createdAt: new Date().toISOString(),
    subtasks: subtasks.map(s => ({ ...s, status: "pending" }))
  };
  fs.writeFileSync(sessionPath(parentKey), JSON.stringify(data, null, 2), "utf-8");
}

export function loadSession(parentKey) {
  const filePath = sessionPath(parentKey);
  if (!fs.existsSync(filePath)) {
    throw new Error(`No session found for ${parentKey}. Run jira-flow ${parentKey} first to create subtasks.`);
  }
  return JSON.parse(fs.readFileSync(filePath, "utf-8"));
}

/**
 * Updates a subtask's status in the session file.
 * If all subtasks are "done" after the update, the session file is deleted.
 * Returns true if the session was auto-deleted, false otherwise.
 */
export function updateSessionSubtaskStatus(parentKey, subtaskKey, status) {
  const filePath = sessionPath(parentKey);
  const session = loadSession(parentKey);

  const subtask = session.subtasks.find(
    s => s.key.toLowerCase() === subtaskKey.toLowerCase()
  );
  if (!subtask) {
    throw new Error(`Subtask ${subtaskKey} not found in session for ${parentKey}.`);
  }

  subtask.status = status;
  fs.writeFileSync(filePath, JSON.stringify(session, null, 2), "utf-8");

  const allDone = session.subtasks.every(s => s.status === "done");
  if (allDone) {
    fs.unlinkSync(filePath);
    deleteTicketCache(parentKey);
    return true;
  }
  return false;
}

export function clearSession(parentKey) {
  const filePath = sessionPath(parentKey);
  if (!fs.existsSync(filePath)) {
    throw new Error(`No session found for ${parentKey}.`);
  }
  fs.unlinkSync(filePath);
  deleteTicketCache(parentKey);
}

export function listSessions() {
  if (!fs.existsSync(SESSIONS_DIR)) return [];

  const files = fs.readdirSync(SESSIONS_DIR).filter(f => f.endsWith(".json"));
  return files.map(file => {
    const data = JSON.parse(fs.readFileSync(path.join(SESSIONS_DIR, file), "utf-8"));
    const total = data.subtasks.length;
    const done = data.subtasks.filter(s => s.status === "done").length;
    const inProgress = data.subtasks.filter(s => s.status === "inProgress").length;
    const pending = data.subtasks.filter(s => s.status === "pending").length;
    return {
      parent: data.parent,
      createdAt: data.createdAt,
      total,
      done,
      inProgress,
      pending
    };
  });
}

export { CONFIG_PATH, TASKS_PATH, SESSIONS_DIR, TICKET_CACHE_DIR };