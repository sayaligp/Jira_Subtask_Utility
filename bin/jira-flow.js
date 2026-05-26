#!/usr/bin/env node

import { execSync } from "child_process";
import {
  ensureUserFiles,
  loadTasks,
  loadSession,
  writeSession,
  updateSessionSubtaskStatus,
  clearSession,
  listSessions,
  writeTicketCache,
  ticketCachePath,
  CONFIG_PATH,
  TASKS_PATH
} from "../src/config.js";
import {
  getMyAccountId,
  createSubtask,
  getTicket,
  transitionIssue,
  addComment
} from "../src/jira.js";

ensureUserFiles();

const args = process.argv.slice(2);

// ------------------------------------
// UTILITY: get value after a flag
// e.g. ["ABC-1", "--set-status", "startDevelopment"] -> "startDevelopment"
// ------------------------------------
function getFlagValue(flag) {
  const idx = args.indexOf(flag);
  if (idx === -1) return null;
  const val = args[idx + 1];
  return val && !val.startsWith("--") ? val : null;
}

// ------------------------------------
// OPEN CONFIG / TASKS IN EDITOR
// ------------------------------------
function openInEditor(filePath) {
  try {
    if (process.platform === "win32") {
      // start opens the file with its default associated app (e.g. VS Code, Notepad)
      execSync(`start "" "${filePath}"`, { stdio: "inherit", shell: true });
    } else if (process.platform === "darwin") {
      execSync(`open "${filePath}"`, { stdio: "inherit" });
    } else {
      const editor = process.env.EDITOR || "nano";
      execSync(`"${editor}" "${filePath}"`, { stdio: "inherit" });
    }
  } catch (err) {
    console.error("Could not open editor:", err.message);
    console.log(`Edit manually: ${filePath}`);
  }
}

if (args[0] === "config") {
  openInEditor(CONFIG_PATH);
  process.exit(0);
}

if (args[0] === "tasks") {
  openInEditor(TASKS_PATH);
  process.exit(0);
}

// ------------------------------------
// LIST SESSIONS (no parent key needed)
// jira-flow --list-sessions
// ------------------------------------
if (args.includes("--list-sessions")) {
  const sessions = listSessions();
  if (sessions.length === 0) {
    console.log("No active sessions.");
  } else {
    const pad = (str, len) => String(str).padEnd(len);
    console.log(
      `${pad("TICKET", 12)} ${pad("TOTAL", 6)} ${pad("DONE", 6)} ${pad("IN PROGRESS", 12)} ${pad("PENDING", 8)} CREATED`
    );
    console.log("─".repeat(70));
    for (const s of sessions) {
      console.log(
        `${pad(s.parent, 12)} ${pad(s.total, 6)} ${pad(s.done, 6)} ${pad(s.inProgress, 12)} ${pad(s.pending, 8)} ${s.createdAt.slice(0, 10)}`
      );
    }
  }
  process.exit(0);
}

// ------------------------------------
// All remaining commands require a parent key as first arg
// ------------------------------------
const parentKey = args[0];

if (!parentKey || parentKey.startsWith("--")) {
  console.error(
    "Usage:\n" +
    "  jira-flow --list-sessions\n" +
    "  jira-flow <KEY> --read\n" +
    "  jira-flow <KEY> --set-status <transitionKey>\n" +
    "  jira-flow <KEY> --set-subtask-status <SUBTASK-KEY> <transitionKey>\n" +
    "  jira-flow <KEY> --close-all-subtasks\n" +
    "  jira-flow <KEY> --comment \"text\"\n" +
    "  jira-flow <KEY> --clear-session\n" +
    "  jira-flow <KEY> [--dev-only | --qa-only | --skip-ux]\n" +
    "  jira-flow config\n" +
    "  jira-flow tasks"
  );
  process.exit(1);
}

// ------------------------------------
// READ TICKET
// jira-flow ABC-123 --read
// ------------------------------------
if (args.includes("--read")) {
  (async () => {
    try {
      const ticket = await getTicket(parentKey);

      // Write structured cache for GHCP to read via #file:
      const cachePath = writeTicketCache(ticket);

      // Human-readable terminal output
      console.log(`\n── ${ticket.key}: ${ticket.summary} ──`);
      console.log(`Status   : ${ticket.status}`);
      console.log(`Assignee : ${ticket.assignee}`);
      console.log(`Priority : ${ticket.priority}`);
      console.log(`\nDescription:\n${ticket.description}`);
      if (ticket.comments.length > 0) {
        console.log(`\nComments (${ticket.comments.length}):`);
        for (const c of ticket.comments) {
          console.log(`  [${c.created.slice(0, 10)}] ${c.author}: ${c.body}`);
        }
      }
      console.log(`\nTicket cached at: ${cachePath}`);
      process.exit(0);
    } catch (err) {
      console.error("Error:", err.response?.data?.errorMessages || err.message);
      process.exit(1);
    }
  })();
}

// ------------------------------------
// SET PARENT TICKET STATUS
// jira-flow ABC-123 --set-status startDevelopment
// ------------------------------------
else if (args.includes("--set-status")) {
  const transitionKey = getFlagValue("--set-status");
  if (!transitionKey) {
    console.error("Usage: jira-flow <KEY> --set-status <transitionKey>");
    console.error("Available transition keys are defined in ~/.jira-flow/config.json");
    process.exit(1);
  }
  (async () => {
    try {
      await transitionIssue(parentKey, transitionKey);
      console.log(`${parentKey} status updated via transition "${transitionKey}".`);
      process.exit(0);
    } catch (err) {
      console.error("Error:", err.message);
      process.exit(1);
    }
  })();
}

// ------------------------------------
// SET SUBTASK STATUS
// jira-flow ABC-123 --set-subtask-status ABC-456 subtaskDone
// ------------------------------------
else if (args.includes("--set-subtask-status")) {
  const subtaskKey = getFlagValue("--set-subtask-status");
  const idx = args.indexOf("--set-subtask-status");
  const transitionKey = args[idx + 2];

  if (!subtaskKey || !transitionKey || transitionKey.startsWith("--")) {
    console.error("Usage: jira-flow <PARENT-KEY> --set-subtask-status <SUBTASK-KEY> <transitionKey>");
    process.exit(1);
  }
  (async () => {
    try {
      await transitionIssue(subtaskKey, transitionKey);
      console.log(`${subtaskKey} transitioned via "${transitionKey}".`);

      // Update session and check for auto-cleanup
      const statusForSession = transitionKey === "subtaskDone" ? "done" : "inProgress";
      try {
        const autoDeleted = updateSessionSubtaskStatus(parentKey, subtaskKey, statusForSession);
        if (autoDeleted) {
          console.log(`All subtasks done. Session for ${parentKey} closed.`);
        }
      } catch {
        // Session file may not exist for older tickets — not a hard error
      }
      process.exit(0);
    } catch (err) {
      console.error("Error:", err.message);
      process.exit(1);
    }
  })();
}

// ------------------------------------
// ADD COMMENT
// jira-flow ABC-123 --comment "text here"
// ------------------------------------
else if (args.includes("--comment")) {
  const text = getFlagValue("--comment");
  if (!text) {
    console.error('Usage: jira-flow <KEY> --comment "your comment text"');
    process.exit(1);
  }
  (async () => {
    try {
      await addComment(parentKey, text);
      console.log(`Comment added to ${parentKey}.`);
      process.exit(0);
    } catch (err) {
      console.error("Error:", err.response?.data?.errorMessages || err.message);
      process.exit(1);
    }
  })();
}

// ------------------------------------
// CLOSE ALL SUBTASKS
// jira-flow ABC-123 --close-all-subtasks
// Transitions every non-done subtask in the session to subtaskDone
// ------------------------------------
else if (args.includes("--close-all-subtasks")) {
  (async () => {
    try {
      const session = loadSession(parentKey);
      const open = session.subtasks.filter(s => s.status !== "done");
      if (open.length === 0) {
        console.log(`All subtasks for ${parentKey} are already done.`);
        process.exit(0);
      }
      for (const subtask of open) {
        await transitionIssue(subtask.key, "subtaskDone");
        console.log(`  ${subtask.key} closed.`);
      }
      clearSession(parentKey);
      console.log(`Session for ${parentKey} closed.`);
      process.exit(0);
    } catch (err) {
      console.error("Error:", err.message);
      process.exit(1);
    }
  })();
}

// ------------------------------------
// CLEAR SESSION
// jira-flow ABC-123 --clear-session
// ------------------------------------
else if (args.includes("--clear-session")) {
  try {
    clearSession(parentKey);
    console.log(`Session for ${parentKey} cleared.`);
  } catch (err) {
    console.error("Error:", err.message);
    process.exit(1);
  }
  process.exit(0);
}

// ------------------------------------
// CREATE SUBTASKS (existing flow)
// jira-flow ABC-123 [--dev-only | --qa-only | --skip-ux]
// ------------------------------------
else {
  const devOnly = args.includes("--dev-only");
  const qaOnly = args.includes("--qa-only");
  const skipUx = args.includes("--skip-ux");

  const flagCount = [devOnly, qaOnly, skipUx].filter(Boolean).length;
  if (flagCount > 1) {
    console.error("Only one flag is allowed: --dev-only OR --qa-only OR --skip-ux");
    process.exit(1);
  }

  const tasks = loadTasks();

  let filteredTasks;
  if (devOnly) {
    filteredTasks = tasks.filter(t => t.type === "DEV" || t.type === "UX");
  } else if (qaOnly) {
    filteredTasks = tasks.filter(t => t.type === "QA");
  } else if (skipUx) {
    filteredTasks = tasks.filter(t => t.type === "DEV");
  } else {
    filteredTasks = tasks;
  }

  if (filteredTasks.length === 0) {
    console.log("No tasks to create.");
    process.exit(0);
  }

  (async () => {
    try {
      console.log("Fetching Jira account...");
      const myAccountId = await getMyAccountId();

      console.log(`Creating ${filteredTasks.length} sub-tasks for ${parentKey}`);

      const createdSubtasks = [];

      for (const task of filteredTasks) {
        let assigneeId = null;
        if (task.assignee === "SELF") {
          assigneeId = myAccountId;
        }

        const key = await createSubtask(parentKey, task, assigneeId);
        console.log(`  ${key} --> ${task.summary}`);
        createdSubtasks.push({ key, type: task.type, summary: task.summary });
      }

      writeSession(parentKey, createdSubtasks);
      console.log(`\nDone! Session saved -- use --list-sessions to view open tickets.`);
      process.exit(0);
    } catch (err) {
      console.error("Error:", err.response?.data?.errorMessages || err.message);
      process.exit(1);
    }
  })();
}
