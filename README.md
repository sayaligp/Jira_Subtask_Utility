# Jira Subtask CLI

A lightweight **Node.js CLI utility** to automatically create standard **DEV / QA / UX Jira sub-tasks** for a parent Jira issue — without requiring Jira Automation or admin access.

This tool is designed to save time for **developers and testers** by eliminating repetitive manual sub-task creation.

---

## ✨ Features

- Create multiple Jira sub-tasks using **one command**
- Works without **Jira Automation** or Jira admin permissions
- Globally installable via `npm`
- User-editable configuration and task templates
- Cross-platform support (Windows / macOS / Linux)
- Uses Jira **Cloud REST APIs**

---

## 📋 Default Sub-tasks Created

By default, the utility creates the following sub-tasks:

- DEV – Story Analysis
- DEV – Code Changes
- DEV – Unit Testing
- DEV – Dev Testing
- QA – Functional Testing
- DEV – Buddy Testing *(unassigned)*
- UX Review *(unassigned)*

> Sub-tasks can be freely customized by editing `tasks.json`.

---

## 🧰 Prerequisites

- **Node.js 18+**
- **npm**
- Jira **Cloud** account (`*.atlassian.net`)
- Jira **API Token**

Check versions:
```bash
node -v
npm -v

🚀 Installation (Global)

Install directly fusing below command:
npm install -g https://github.com/sayaligp/Jira_Subtask_Utility.git


Verify installation:
jira-subtask


Expected output:
❌ Usage: jira-subtask <ISSUE-KEY> [--dev-only | --qa-only | --skip-ux]

⚙️ First-time Setup
On first execution, the utility automatically creates user-specific files:

jira-subtask ABC-1

This creates:

~/.jira-subtask/
├── config.json
└── tasks.json

🔐 Configure Jira Credentials

Open the config file:

jira-subtask config

Update it with your Jira details:

{
  "baseUrl": "https://yourcompany.atlassian.net",
  "email": "your.email@company.com",
  "apiToken": "YOUR_JIRA_API_TOKEN",
  "projectId": "your project id"
}

Configuration notes

email → Jira login email
apiToken → Jira API token (NOT your password)
projectId → Jira project ID (not project key)

Create an API token here:
https://id.atlassian.com/manage-profile/security/api-tokens

📝 Customize Sub-tasks (Optional)
Open task template file:
jira-subtask tasks

Each task entry looks like:

{
  "type": "DEV",
  "summary": "[DEV] Code Changes",
  "description": "Implement required code changes",
  "assignee": "SELF"
}

Assignee behavior
"SELF" → assigned to the current user
"NONE" → created unassigned

▶️ Usage
Create all sub-tasks (DEV + QA + UX)
jira-subtask ABC-123

Create DEV + UX sub-tasks only
jira-subtask ABC-123 --dev-only

Create QA sub-tasks only
jira-subtask ABC-123 --qa-only

Create DEV sub-tasks only (without UX)
jira-subtask ABC-123 --skip-ux


⚠️ Only one flag at a time is supported.

🧪 Sample Output
Fetching Jira account...
🚀 Creating 6 sub-tasks for ABC-123
✅ ABC-201 → [DEV] Code Changes
✅ ABC-202 → [QA] Functional Testing
🎉 Done!


🧯 Troubleshooting
❌ 401 Unauthorized
Ensure API token is correct
Email must match Jira login email
Verify credentials using:
curl -u email:token https://yourcompany.atlassian.net/rest/api/3/myself

🔐 Security
No credentials are committed to the repository
Each user uses their own Jira API token
Tokens are stored locally on the user’s machine

📌 Notes
Works only with Jira Cloud
No Jira admin permissions required
Intended for internal team productivity
