import "@logseq/libs";
import { PageEntity } from "@logseq/libs/dist/LSPlugin.user";
import { AgileClient } from "jira.js"
import { Board, Issue as JiraIssue, Sprint } from "jira.js/out/agile/models"

type Issue = {
  id: string;
  key: string;
  url: string;
  summary: string;
  creator: string;
  assignee?: string;
  created: string;
  updated: string;
  status: string;
  sprint: string;
  project: string;

  block_uuid?: string;
}

async function ensureIssuesPage(): Promise<PageEntity> {
  const page = await logseq.Editor.getPage("jira/issues");
  if (!page) {
    return await logseq.Editor.createPage("jira/issues");
  }
  return page;
}

async function jiraBoards(client: AgileClient): Promise<Record<number, Board>> {
  const boards: Record<number, Board> = {}
  const response = await client.board.getAllBoards()
  response.values.forEach((board) => {
    boards[board.id] = board
  })
  return boards
}

async function logseqIssues(): Promise<Record<string, Issue>> {
  const blocks = await logseq.Editor.getPageBlocksTree("/jira/issues");
  const issues = {};
  for (const block of blocks) {
    if (!block.properties || !block.properties[".id"]) {
      continue;
    }
    const issue = {
      id: block.properties[".id"],
      key: block.properties[".key"],
      url: block.properties[".url"],
      summary: block.properties[".summary"],
      project: block.properties[".project"],
      creator: block.properties["creator"],
      assignee: block.properties["assignee"],
      created: block.properties["created"],
      updated: block.properties["updated"],
      status: block.properties["status"],
      sprint: block.properties["sprint"],
      block_uuid: block.uuid,
    }
    issues[issue.id] = issue
  }
  return issues;
}

async function jiraIssues(client: AgileClient, sprintId: number): Promise<Record<number, Issue>> {
  const issues: Record<number, Issue> = {}
  // Fetch all issues for the sprint
  const response = await client.sprint.getIssuesForSprint({
    sprintId: sprintId,
    startAt: 0,
    maxResults: 100,
  })
  response.issues.forEach((issue) => {
    issues[issue.id] = parseJiraIssue(issue)
  })
  return issues
}

function parseJiraIssue(issue: JiraIssue): Issue {
  const nthNumber = (n: number) => {
    const s = ["th", "st", "nd", "rd"];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  };

  const created = new Date(issue.fields.created);
  const createdStr = `${created.toLocaleString("default", { month: "short" })} ${nthNumber(created.getDate())}, ${created.getFullYear()}`;
  const updated = new Date(issue.fields.updated);
  const updatedStr = `${updated.toLocaleString("default", { month: "short" })} ${nthNumber(updated.getDate())}, ${updated.getFullYear()}`;
  const creator = `[[jira/people/${issue.fields.creator.displayName}]]`

  const project = issue.fields.project.name
  const sprint = `[[jira/project/${project}/${issue.fields.sprint.name}]]`


  const parsed: Issue = {
    id: issue.id,
    key: issue.key,
    url: issue.self,
    summary: issue.fields.summary,
    created: createdStr,
    updated: updatedStr,
    creator: creator,
    status: issue.fields.status.name,
    project: project,
    sprint: sprint,
  }

  if (issue.fields.assignee) {
    parsed.assignee = `[[jira/people/${issue.fields.assignee.displayName}]]`
  }

  return parsed
}

async function jiraSprint(client: AgileClient, boardId: number): Promise<Sprint> {
  const response = await client.board.getAllSprints({
    boardId: boardId,
    state: "active",
  })
  return response.values[0]
}

function issueToBlock(issue: Issue) {
  return {
    uuid: issue.block_uuid,
    content: `[${issue.key}: ${issue.summary}](${issue.url})`,
    properties: {
      ".id": issue.id,
      ".key": issue.key,
      ".url": issue.url,
      ".summary": issue.summary,
      ".project": issue.project,
      "page": `[[jira/issues/${issue.key}]]`,
      "creator": issue.creator,
      "assignee": issue.assignee,
      "created": `[[${issue.created}]]`,
      "updated": `[[${issue.updated}]]`,
      "status": issue.status,
      "sprint": issue.sprint,
    }
  }
}

async function updateIssueBlock(issue: Issue) {
  const block = issueToBlock(issue)
  await logseq.Editor.updateBlock(issue.block_uuid, block.content, { properties: block.properties })
}

async function insertIssueBlocks(page: PageEntity, issues: Issue[]) {
  const blocks = issues.map(issueToBlock)
  if (blocks.length === 0) {
    return
  }
  await logseq.Editor.insertBatchBlock(page.uuid, blocks, { before: false, sibling: true })
}

function updateIssue(local: Issue, remote: Issue): [Issue, boolean] {
  let changed = false;
  if (local.summary !== remote.summary) {
    local.summary = remote.summary;
    changed = true;
  }
  if (local.assignee !== remote.assignee) {
    local.assignee = remote.assignee;
    changed = true;
  }
  if (local.status !== remote.status) {
    local.status = remote.status;
    changed = true;
  }
  if (local.sprint !== remote.sprint) {
    local.sprint = remote.sprint;
    changed = true;
  }
  if (local.updated !== remote.updated) {
    local.updated = remote.updated;
    changed = true;
  }

  return [local, changed];
}

async function deleteIssueBlocks(issues: Issue[]) {
  for (const issue of issues) {
    await logseq.Editor.removeBlock(issue.block_uuid);
  }
}

export class Jira {
  client = null
  constructor(host: string, email: string, token: string) {
    this.client = new AgileClient({
      host: host,
      authentication: {
        basic: {
          email: email,
          apiToken: token,
        },
      },
    })
  }
  sync = async function() {
    const page = await ensureIssuesPage()
    const boards = await jiraBoards(this.client)
    const board = boards[2]
    const sprint = await jiraSprint(this.client, board.id)
    const local = await logseqIssues()
    const remote = await jiraIssues(this.client, sprint.id)

    const toInsert = [];
    const toDelete = [];
    for (const issue of Object.values(remote)) {
      if (local[issue.id]) {
        const [updated, changed] = updateIssue(local[issue.id], issue)
        if (changed) {
          await updateIssueBlock(updated)
        }
      } else {
        toInsert.push(issue)
      }
    }
    for (const issue of Object.values(local)) {
      if (!remote[issue.id]) {
        toDelete.push(issue)
      }
    }

    await insertIssueBlocks(page, toInsert);
    await deleteIssueBlocks(toDelete);
  }
}
