#!/usr/bin/env node
import { exec } from "child_process";
import { ensureUserFiles, loadConfig, loadTasks, CONFIG_PATH, TASKS_PATH } from "../src/config.js";
import { getMyAccountId, createSubtask } from "../src/jira.js";

// Ensure user files exist
ensureUserFiles();

const args = process.argv.slice(2);

/**
 * ------------------------------------
 * HELPER COMMANDS (NEW)
 * ------------------------------------
 */
if (args[0] === "config") {
const editor = process.env.EDITOR || "notepad";
exec(`"${editor}" "${CONFIG_PATH}"`);
process.exit(0);
}

if (args[0] === "tasks") {
const editor = process.env.EDITOR || "notepad";
exec(`"${editor}" "${TASKS_PATH}"`);
process.exit(0);
}


const parentKey = args[0];

const devOnly = args.includes("--dev-only");
const qaOnly = args.includes("--qa-only");
const skipUx = args.includes("--skip-ux");

// Validate input
if (!parentKey) {
  console.error(
    "Usage: jira-subtask <ISSUE-KEY> [--dev-only | --qa-only | --skip-ux]"
  );
  process.exit(1);
}

// Only one flag allowed
const flagCount = [devOnly, qaOnly, skipUx].filter(Boolean).length;
if (flagCount > 1) {
  console.error(
    "Only one flag is allowed: --dev-only OR --qa-only OR --skip-ux"
  );
  process.exit(1);
}

const config = loadConfig();
const tasks = loadTasks();

// --------------------
// FINAL FILTER LOGIC
// --------------------
let filteredTasks;

if (devOnly) {
  // DEV + UX
  filteredTasks = tasks.filter(
    t => t.type === "DEV" || t.type === "UX"
  );
} else if (qaOnly) {
  // QA only
  filteredTasks = tasks.filter(t => t.type === "QA");
} else if (skipUx) {
  // DEV only
  filteredTasks = tasks.filter(t => t.type === "DEV");
} else {
  // DEV + QA + UX
  filteredTasks = tasks;
}

if (filteredTasks.length === 0) {
  console.log("No tasks to create.");
  process.exit(0);
}

// --------------------
// Execute
// --------------------
(async () => {
  try {
    console.log("Fetching Jira account...");
    const myAccountId = await getMyAccountId();

    console.log(
      `Creating ${filteredTasks.length} sub-tasks for ${parentKey}`
    );

    for (const task of filteredTasks) {
      let assigneeId = null;
      if(task.assignee === "SELF"){
        assigneeId = myAccountId;
      }
         

      const key = await createSubtask(parentKey, task, assigneeId);
      console.log(`${key} → ${task.summary}`);
    }

    console.log("Done!");
  } catch (err) {
    console.error(
      "Error:",
      err.response?.data?.errorMessages || err.message
    );
    process.exit(1);
  }
})();
