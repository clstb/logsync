import "@logseq/libs";
import { BlockEntity } from "@logseq/libs/dist/LSPlugin.user";
import { AgileClient } from "jira.js"
import { AgileParameters } from "jira.js"
import { SyncBlock, Fetcher, marshal, unmarshal } from "./sync";


export class Board implements SyncBlock {
  id: string;
  namespace: string;
  synced: string;
  block_uuid?: string;

  name: string = "";

  marshal(): BlockEntity {
    const block = marshal(this);
    const content = this.name;
    const properties = {
      ".name": this.name,
    }

    block.content = content;
    for (const [key, value] of Object.entries(properties)) {
      block.properties[key] = value;
    }
    return block
  };
  unmarshal(block: BlockEntity) {
    unmarshal<this>(block, this);
    this.name = block.properties[".name"];
  };
}

export class BoardsFetcher implements Fetcher {
  client: AgileClient = null;
  constructor(client: AgileClient) {
    this.client = client;
  }

  async fetch<Board>(namespace: string): Promise<Record<string, Board>> {
    const response = await this.client.board.getAllBoards();
    const boards = {};
    for (const v of response.values) {
      const board = new Board();
      board.id = v.id.toString();
      board.namespace = namespace;
      board.name = v.name;
      boards[board.id] = board;
    }
    return boards;
  }
}

export class Sprint implements SyncBlock {
  id: string;
  namespace: string;
  synced: string;
  block_uuid?: string;

  name: string;
  start: string = "";
  end: string = "";
  complete: string = "";

  marshal(): BlockEntity {
    const block = marshal(this);
    const content = this.name;
    const properties = {
      ".name": this.name,
      ".start": this.start,
      ".end": this.end,
      ".complete": this.complete,
    }

    block.content = content;
    for (const [key, value] of Object.entries(properties)) {
      block.properties[key] = value;
    }
    return block
  }
  unmarshal(block: BlockEntity) {
    unmarshal<this>(block, this);
    this.name = block.properties[".name"];
    this.start = block.properties[".start"];
    this.end = block.properties[".end"];
    this.complete = block.properties[".complete"];
  }
}

export class SprintsFetcher implements Fetcher {
  client: AgileClient = null;
  constructor(client: AgileClient) {
    this.client = client;
  }

  async fetch<Sprint>(namespace: string, opts: AgileParameters.GetAllSprints): Promise<Record<string, Sprint>> {
    const response = await this.client.board.getAllSprints(opts)
    const sprints = {}
    for (const v of response.values) {
      const sprint = new Sprint();
      sprint.id = v.id.toString();
      sprint.namespace = namespace;
      sprint.name = v.name.trim();
      sprint.start = v.startDate ? v.startDate.toString() : "";
      sprint.end = v.endDate ? v.endDate.toString() : "";
      sprint.complete = v.completeDate ? v.completeDate.toString() : "";
      sprints[sprint.id] = sprint;
    }
    return sprints;
  }
}

export class Issue implements SyncBlock {
  id: string;
  namespace: string;
  synced: string;
  block_uuid?: string;

  key: string = "";
  url: string = "";
  summary: string = "";
  creator: string = "";
  assignee: string = "";
  status: string = "";
  created: string = "";
  updated: string = "";
  sprint: string = "";
  project: string = "";

  marshal(): BlockEntity {
    const block = marshal(this);
    const content = `[${this.key}: ${this.summary}](${this.url})`;
    const properties = {
      ".key": this.key,
      ".url": this.url,
      ".summary": this.summary,
      ".creator": this.creator,
      ".status": this.status,
      ".created": this.created,
      ".updated": this.updated,
      ".sprint": this.sprint,
      ".project": this.project,
    }

    block.content = content;
    for (const [key, value] of Object.entries(properties)) {
      block.properties[key] = value;
    }
    return block
  }
  unmarshal(block: BlockEntity) {
    unmarshal<this>(block, this);
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
  };
}

export class IssuesFetcher implements Fetcher {
  client: AgileClient = null;
  constructor(client: AgileClient) {
    this.client = client;
  }

  async fetch<Issue>(namespace: string, opts: AgileParameters.GetIssuesForSprint): Promise<Record<string, Issue>> {
    const response = await this.client.sprint.getIssuesForSprint(opts)
    const issues = {};
    for (const v of response.issues) {
      const issue = new Issue()
      issue.id = v.id
      issue.namespace = namespace
      issue.key = v.key
      issue.url = v.self
      issue.summary = v.fields.summary.replace(/\s+$/, "") 
      issue.creator = v.fields.creator.displayName
      issue.assignee = v.fields.assignee?.displayName.trim()
      issue.status = v.fields.status.name
      issue.created = v.fields.created
      issue.updated = v.fields.updated
      issue.sprint = v.fields.sprint?.name.trim()
      issue.project = v.fields.project.name.trim()
      issues[issue.id] = issue
    }
    return issues
  }
}
