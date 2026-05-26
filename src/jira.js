import axios from "axios";
import { loadConfig } from "./config.js";

// ------------------------------------
// LAZY AXIOS SINGLETON
// Reads config once per process run.
// ------------------------------------
let _client = null;
let _config = null;

function getClient() {
  if (!_client) {
    _config = loadConfig();
    _client = axios.create({
      baseURL: _config.baseUrl,
      auth: {
        username: _config.email,
        password: _config.apiToken
      }
    });
  }
  return { client: _client, config: _config };
}

// ------------------------------------
// ADF TEXT EXTRACTOR
// Recursively flattens Atlassian Document Format nodes to plain text.
// ------------------------------------
function extractAdfText(node) {
  if (!node) return "";
  if (node.type === "text") return node.text || "";
  if (node.type === "hardBreak") return "\n";
  if (node.content && Array.isArray(node.content)) {
    const text = node.content.map(extractAdfText).join("");
    // Add newlines after block-level nodes for readability
    const blockNodes = ["paragraph", "heading", "listItem", "bulletList", "orderedList", "blockquote"];
    return blockNodes.includes(node.type) ? text + "\n" : text;
  }
  return "";
}

// ------------------------------------
// GET TICKET
// ------------------------------------
export async function getTicket(key) {
  const { client } = getClient();
  const res = await client.get(
    `/rest/api/3/issue/${key}`,
    { params: { fields: "summary,description,status,assignee,comment,priority" } }
  );

  const f = res.data.fields;
  return {
    key: res.data.key,
    summary: f.summary || "",
    status: f.status?.name || "",
    assignee: f.assignee?.displayName || "Unassigned",
    priority: f.priority?.name || "",
    description: f.description ? extractAdfText(f.description).trim() : "(no description)",
    comments: (f.comment?.comments || []).map(c => ({
      author: c.author?.displayName || "",
      body: extractAdfText(c.body).trim(),
      created: c.created
    }))
  };
}

// ------------------------------------
// GET ACCOUNT ID
// ------------------------------------
export async function getMyAccountId() {
  const { client } = getClient();
  const res = await client.get("/rest/api/3/myself");
  return res.data.accountId;
}

// ------------------------------------
// CREATE SUBTASK
// ------------------------------------
export async function createSubtask(parentKey, task, assigneeId) {
  const { client, config } = getClient();

  const fields = {
    project: { id: config.projectId },
    parent: { key: parentKey },
    issuetype: { name: "Sub-task" },
    summary: task.summary,
    description: {
      type: "doc",
      version: 1,
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: task.description }]
        }
      ]
    }
  };

  if (assigneeId) {
    fields.assignee = { id: assigneeId };
  }

  const res = await client.post("/rest/api/3/issue", { fields });
  return res.data.key;
}

// ------------------------------------
// GET TRANSITIONS
// ------------------------------------
export async function getTransitions(key) {
  const { client } = getClient();
  const res = await client.get(`/rest/api/3/issue/${key}/transitions`);
  return res.data.transitions.map(t => ({ id: t.id, name: t.name }));
}

// ------------------------------------
// TRANSITION ISSUE
// Resolves transition name via config key, matches case-insensitively.
// Prints available transitions if no match found.
// ------------------------------------
export async function transitionIssue(key, transitionConfigKey) {
  const { config } = getClient();

  const transitionName = config.transitions?.[transitionConfigKey];
  if (!transitionName) {
    const available = Object.keys(config.transitions || {}).join(", ");
    throw new Error(
      `Unknown transition key "${transitionConfigKey}".\n` +
      `Available keys in config: ${available || "(none — check your config.json)"}`
    );
  }

  const transitions = await getTransitions(key);
  const match = transitions.find(
    t => t.name.toLowerCase() === transitionName.toLowerCase()
  );

  if (!match) {
    const available = transitions.map(t => `"${t.name}"`).join(", ");
    throw new Error(
      `Transition "${transitionName}" not found for ${key}.\n` +
      `Available transitions on this issue: ${available}\n` +
      `Update "transitions.${transitionConfigKey}" in ~/.jira-dev-flow/config.json to match one of the above.`
    );
  }

  await getClient().client.post(`/rest/api/3/issue/${key}/transitions`, {
    transition: { id: match.id }
  });
}

// ------------------------------------
// ADD COMMENT
// ------------------------------------
export async function addComment(key, text) {
  const { client } = getClient();
  await client.post(`/rest/api/3/issue/${key}/comment`, {
    body: {
      type: "doc",
      version: 1,
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text }]
        }
      ]
    }
  });
}
