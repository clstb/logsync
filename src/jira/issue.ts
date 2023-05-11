import { Block } from '../logseq/api';
import { BlockEntity } from '@logseq/libs/dist/LSPlugin.user';
import { AgileClient, AgileParameters, AgileModels } from "jira.js";
import { dateToStr } from "../logseq/api"
import { DateTime } from "luxon";

export class Issue implements Block {
  constructor(obj) {
    Object.assign(this, obj)
  }

  block_uuid?: string;

  id: number;
  key: string;
  url: string;
  summary: string;
  creator: string;
  assignee: string;
  status: string;
  created: DateTime;
  updated: DateTime;
  sprintId: string;
  project: string;
  pullRequests: string;

  page(): string {
    return `jira/issue/${this.key}`
  }
  marshal(): BlockEntity {
    const content = `[${this.key}: ${this.summary}](${this.url})`;
    const properties = {
      ".id": this.id,
      ".key": this.key,
      ".url": this.url,
      ".summary": this.summary,
      ".creator": this.creator,
      "creator": `[[people/${this.creator}]]`,
      ...this.assignee && {
        ".assignee": this.assignee,
        "assignee": `[[people/${this.assignee}]]`
      },
      "status": this.status,
      ".created": this.created.toISO(),
      "created": `[[${dateToStr(this.created)}]]`,
      ".updated": this.updated.toISO(),
      "updated": `[[${dateToStr(this.updated)}]]`,
      ...this.sprintId && { 
        ".sprint_id": this.sprintId,
        "sprint": `[[jira/sprint/${this.sprintId}]]`
      },
      "project": this.project,
      ...this.pullRequests && { "pull_requests": this.pullRequests },
    }
    const block = {
      content: content,
      properties: properties,
    } as Partial<BlockEntity>;
    if (this.block_uuid) {
      block.uuid = this.block_uuid
    }
    return block as BlockEntity;
  }
  unmarshal(block: BlockEntity): Block {
    this.block_uuid = block.uuid;
    return new Issue({
      block_uuid: block.uuid,
      id: block.properties[".id"],
      key: block.properties[".key"],
      url: block.properties[".url"],
      summary: block.properties[".summary"],
      creator: block.properties[".creator"],
      ...block.properties[".assignee"] && {
        assignee: block.properties[".assignee"],
      },
      status: block.properties["status"],
      created: DateTime.fromISO(block.properties[".created"]),
      updated: DateTime.fromISO(block.properties[".updated"]),
      ...block.properties[".sprintId"] && {
        sprintId: block.properties[".sprintId"],
      },
      project: block.properties["project"],
      ...block.properties["pullRequests"] && {
        pullRequests: block.properties["pullRequests"],
      },
    })
  }
}

function parseIssue(v: AgileModels.Issue): Issue {
  return new Issue({
    id: +v.id,
    key: v.key,
    url: v.self.split('/rest/agile/1.0/issue')[0] + "/browse/" + v.key,
    summary: v.fields.summary.trim(),
    creator: v.fields.creator.displayName,
    ...v.fields.assignee && { assignee: v.fields.assignee.displayName },
    ...v.fields.status && { status: v.fields.status.name },
    created: DateTime.fromISO(v.fields.created),
    updated: DateTime.fromISO(v.fields.updated),
    ...v.fields.sprint && { sprintId: v.fields.sprint.id },
    project: v.fields.project.name.trim(),
  })
}

export async function fetchIssues(
  client: AgileClient,
  parameters: AgileParameters.GetIssuesForSprint
): Promise<Issue[]> {
  const response = await client.sprint.getIssuesForSprint(parameters);
  return response.issues.map(parseIssue);
}
