import "@logseq/libs";
import { PageEntity } from "@logseq/libs/dist/LSPlugin.user";
import { AgileClient } from "jira.js"
import { Board, Issue as JiraIssue, Sprint } from "jira.js/out/agile/models"

type Issue = {
  id: string;
  key: string;
  url: string;
  summary: string;

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
  return {
    id: issue.id,
    key: issue.key,
    url: issue.self,
    summary: issue.fields.summary,
  }
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
  }
}

async function insertIssueBlocks(page: PageEntity, issues: Issue[]) {
  const blocks = issues.map(issueToBlock)
  if (blocks.length === 0) {
    return
  }
  await logseq.Editor.insertBatchBlock(page.uuid, blocks, { before: false, sibling: true })
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
    const issues = await jiraIssues(this.client, sprint.id)
    await insertIssueBlocks(page, Object.values(issues))
  }
}
