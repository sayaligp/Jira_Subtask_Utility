import fs from "fs";
import path from "path";
import os from "os";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const BASE_DIR = path.join(os.homedir(), ".jira-subtask");
const CONFIG_PATH = path.join(BASE_DIR, "config.json");
const TASKS_PATH = path.join(BASE_DIR, "tasks.json");

const DEFAULT_CONFIG = path.join(__dirname, "../templates/config.default.json");
const DEFAULT_TASKS = path.join(__dirname, "../templates/tasks.default.json");

export function ensureUserFiles() {
  if (!fs.existsSync(BASE_DIR)) {
    fs.mkdirSync(BASE_DIR);
  }

  if (!fs.existsSync(CONFIG_PATH)) {
    fs.copyFileSync(DEFAULT_CONFIG, CONFIG_PATH);
    console.log("📄 config.json created at ~/.jira-subtask (please update it)");
  }

  if (!fs.existsSync(TASKS_PATH)) {
    fs.copyFileSync(DEFAULT_TASKS, TASKS_PATH);
    console.log("📄 tasks.json created at ~/.jira-subtask (editable)");
  }
}

export function loadConfig() {
  return JSON.parse(fs.readFileSync(CONFIG_PATH, "utf-8"));
}

export function loadTasks() {
  return JSON.parse(fs.readFileSync(TASKS_PATH, "utf-8"));
}

export { CONFIG_PATH, TASKS_PATH };
