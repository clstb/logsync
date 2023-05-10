import { Block } from '../logseq/api';
import { BlockEntity } from '@logseq/libs/dist/LSPlugin.user';
import { AgileClient, AgileParameters, AgileModels } from "jira.js";

export class Issue implements Block {
  constructor(obj) {
    Object.assign(this, obj)
  }

  page: string;
  block_uuid?: string;

  id: string;
  key: string;
  url: string;
  summary: string;
  creator: string;
  assignee: string;
  status: string;
  created: string;
  updated: string;
  sprint: string;
  project: string;
  pullRequests: string;

  marshal(): BlockEntity {
    const content = `[${this.key}: ${this.summary}](${this.url})`;
    const properties = {
      ".id": this.id,
      ".key": this.key,
      ".url": this.url,
      ".summary": this.summary,
      ".creator": this.creator,
      ".status": this.status,
      ".created": this.created,
      ".updated": this.updated,
      ".sprint": this.sprint,
      ".project": this.project,
      "pull_requests": this.pullRequests,
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
  unmarshal(block: BlockEntity) {
    this.id = block.properties[".id"];
    this.key = block.properties[".key"];
    this.url = block.properties[".url"];
    this.summary = block.properties[".summary"];
    this.creator = block.properties[".creator"];
    this.assignee = block.properties[".assignee"];
    this.status = block.properties[".status"];
    this.created = block.properties[".created"];
    this.updated = block.properties[".updated"];
    this.sprint = block.properties[".sprint"];
    this.project = block.properties[".project"];
    this.pullRequests = block.properties[".pull_requests"];
  }
}

function parseIssue(v: AgileModels.Issue): Issue {
  return new Issue({
    page: `jira/issue/${v.key}`,

    id: v.id,
    key: v.key,
    url: v.self,
    summary: v.fields.summary,
    creator: v.fields.creator.displayName,
    ...v.fields.assignee && { assignee: v.fields.assignee.displayName },
    ...v.fields.status && { status: v.fields.status.name },
    created: v.fields.created,
    updated: v.fields.updated,
    ...v.fields.sprint && { sprint: v.fields.sprint.name },
    project: v.fields.project.name,
  })
}

export async function fetchIssues(
  client: AgileClient,
  parameters: AgileParameters.GetIssuesForSprint
): Promise<Issue[]> {
  const response = await client.sprint.getIssuesForSprint(parameters);
  return response.issues.map(parseIssue);
}
