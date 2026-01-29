import axios from "axios";
import { loadConfig } from "./config.js";

export async function getMyAccountId() {
  const config = loadConfig();

  const res = await axios.get(
    `${config.baseUrl}/rest/api/3/myself`,
    {
      auth: {
        username: config.email,
        password: config.apiToken
      }
    }
  );

  return res.data.accountId;
}

export async function createSubtask(parentKey, task, assigneeId) {
  const config = loadConfig();

  
  const fields= {
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
    },
  }

  if(assigneeId){
    fields.assignee= { id: assigneeId }
  }
  const payload = {fields};
  const res = await axios.post(
    `${config.baseUrl}/rest/api/3/issue`,
    payload,
    {
      auth: {
        username: config.email,
        password: config.apiToken
      }
    }
  );

  return res.data.key;
}
