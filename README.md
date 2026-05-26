# jira-dev-flow

A lightweight Node.js CLI for the full Jira development workflow — read tickets, create sub-tasks, track status, add comments, and manage sessions. Designed to integrate with GitHub Copilot prompts without the token overhead of Atlassian MCP for Jira operations.

---

## Features

- Read Jira ticket content (summary, description, AC, comments) from the terminal
- Create standard DEV / QA / UX sub-tasks with one command
- Transition ticket and sub-task statuses via config-mapped names
- Add comments to tickets
- Track sub-task progress per ticket via session files
- Auto-close sessions when all sub-tasks are marked done
- No Jira Automation or admin access required
- Works with GitHub Copilot agent prompts via ticket cache files

---

## Prerequisites

- Node.js 18+
- npm
- Jira Cloud account (`*.atlassian.net`)
- Jira API Token — generate one at: https://id.atlassian.com/manage-profile/security/api-tokens

Check versions:
```bash
node -v
npm -v

---

## Installation (Global)

```bash
npm install -g jira-dev-flow
```

Verify:
```bash
jira-dev-flow --help
```

---

## First-time Setup

On first run the CLI creates user config files at `~/.jira-dev-flow/`:

```
~/.jira-dev-flow/
├── config.json        # Jira credentials and transition names
├── tasks.json         # Sub-task templates
├── sessions/          # Active ticket sessions (auto-managed)
└── ticket-cache/      # Cached ticket JSON for GHCP file references
```

---

## Configuration

`~/.jira-dev-flow/config.json`:

```json
{
  "baseUrl": "https://yourcompany.atlassian.net",
  "email": "your.email@company.com",
  "apiToken": "YOUR_JIRA_API_TOKEN",
  "projectId": "your_project_id",
  "transitions": {
    "startDevelopment": "In Development",
    "subtaskInProgress": "In Progress",
    "subtaskDone": "Done"
  }
}
```

**Configuration Notes:**
- `email` — your Jira login email
- `apiToken` — Jira API token, not your password
- `projectId` — Your Jira project ID, (not project key)

- `transitions` — map logical keys to your project's actual workflow transition names. If a name doesn't match, the CLI prints available transitions for that issue so you can correct the config.

Open config in editor:
```bash
jira-dev-flow config
```

---

## Sub-task Templates

`~/.jira-dev-flow/tasks.json` controls which sub-tasks get created. Default:

```json
[
  { "type": "DEV", "summary": "[DEV] Story Analysis",    "description": "Analyze requirements and acceptance criteria", "assignee": "SELF" },
  { "type": "DEV", "summary": "[DEV] Code Changes",      "description": "Implement and commit required code changes",   "assignee": "SELF" },
  { "type": "DEV", "summary": "[DEV] Unit Testing",      "description": "Write and execute unit tests",                "assignee": "SELF" },
  { "type": "DEV", "summary": "[DEV] Dev Testing",       "description": "Perform functional testing",                  "assignee": "SELF" },
  { "type": "DEV", "summary": "[DEV] Buddy Testing",     "description": "Buddy testing of implemented changes",        "assignee": "NONE" },
  { "type": "QA",  "summary": "[QA] Test cases preparation", "description": "Test cases preparation",                  "assignee": "QA"   },
  { "type": "UX",  "summary": "UX Review",               "description": "Final UX review and validation",              "assignee": "NONE" }
]
```

Assignee values: `"SELF"` assigns to the current user, `"NONE"` leaves unassigned.

Open tasks in editor:
```bash
jira-dev-flow tasks
```

---

## Commands

### Read a ticket
```bash
jira-dev-flow ABC-123 --read
```
Prints summary, status, description, and comments to terminal.
Also writes `~/.jira-dev-flow/ticket-cache/ABC-123.json` for use with GHCP `#file:` references.

### Create sub-tasks
```bash
jira-dev-flow ABC-123                  # DEV + QA + UX
jira-dev-flow ABC-123 --dev-only       # DEV + UX
jira-dev-flow ABC-123 --skip-ux        # DEV only
jira-dev-flow ABC-123 --qa-only        # QA only
```
Creates sub-tasks and saves a session file at `~/.jira-dev-flow/sessions/ABC-123.json`.

### Transition ticket status
```bash
jira-dev-flow ABC-123 --set-status startDevelopment
```
Uses the transition key defined in `config.json`. If the mapped name doesn't match any available transition, prints the list of valid names.

### Transition a sub-task status
```bash
jira-dev-flow ABC-123 --set-subtask-status ABC-245 subtaskInProgress
jira-dev-flow ABC-123 --set-subtask-status ABC-245 subtaskDone
```
Also updates the session file. When all sub-tasks reach `done`, the session file and the ticket cache file are both auto-deleted.

### Close all open sub-tasks at once
```bash
jira-dev-flow ABC-123 --close-all-subtasks
```
Transitions every non-done sub-task in the session to `subtaskDone`, then deletes the session file.

### Add a comment
```bash
jira-dev-flow ABC-123 --comment "AC unclear: what does field X refer to?"
```

### Session management
```bash
jira-dev-flow --list-sessions          # show all active sessions with progress
jira-dev-flow ABC-123 --clear-session  # manually delete session file and ticket cache
```

---

## GHCP Integration

This CLI is created to integrate it with GHCP workflows so that without Atlassian MCP we can handle Jira operations.

After `--read`, GHCP prompts reference the ticket cache directly:
```
#file:~/.jira-dev-flow/ticket-cache/ABC-123.json
```

which GHCP can consume

---

## Troubleshooting

**401 Unauthorized** — API token or email is wrong. Verify with:
```bash
curl -u your@email.com:YOUR_TOKEN https://yourcompany.atlassian.net/rest/api/3/myself
```

**Transition not found** — The name in `config.transitions` doesn't match this project's workflow. The error output lists available transition names — copy the correct one into `config.json`.

**No session found** — Sub-tasks were not created via this CLI (or session was already cleared). Run the create command first.

---

## Security

- No credentials in the repository
- Each user stores their own API token locally in `~/.jira-dev-flow/config.json`
- Works with Jira Cloud only
