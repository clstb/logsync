import { Block } from "../logseq/api";
import { BlockEntity } from "@logseq/libs/dist/LSPlugin.user";
import { Octokit } from "octokit";
import { DateTime } from "luxon";
import { dateToStr } from "../logseq/api"


export class PullRequest implements Block {
  constructor(obj) {
    Object.assign(this, obj)
  }

  block_uuid?: string;

  id: string;
  number: number;
  author: string;
  created: DateTime;
  updated: DateTime;
  title: string;
  url: string;
  state: string;
  repositoryName: string
  repositoryOwner: string
  reviewers: string[];

  page(): string {
    return `github/${this.repositoryOwner}/${this.repositoryName}/pull/${this.number}`
  }
  marshal(): BlockEntity {
    const taskStr = this.state === "OPEN" ? "LATER" : "DONE";
    const content = `${taskStr} [${this.title}](${this.url})`
    const properties = {
      ".id": this.id,
      ".number": this.number,
      ".author": this.author,
      "author": `[[github/${this.author}]]`,
      ".created": this.created.toISO(),
      "created": `[[${dateToStr(this.created)}]]`,
      ".updated": this.updated.toISO(),
      "updated": `[[${dateToStr(this.updated)}]]`,
      ".title": this.title,
      ".url": this.url,
      "state": this.state,
      ".repository_name": this.repositoryName,
      ".repository_owner": this.repositoryOwner,
      "repository": `[[github/${this.repositoryOwner}/${this.repositoryName}]]`,
      ...this.reviewers && {
        ".reviewers": this.reviewers.join(" "),
        "reviewers": this.reviewers.map((reviewer) => `[[github/${reviewer}]]`).join(" "),
      }
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
    return new PullRequest({
      block_uuid: block.uuid,
      id: block.properties[".id"],
      number: block.properties[".number"],
      author: block.properties[".author"],
      title: block.properties[".title"],
      url: block.properties[".url"],
      state: block.properties["state"],
      created: DateTime.fromISO(block.properties[".created"]),
      updated: DateTime.fromISO(block.properties[".updated"]),
      repositoryName: block.properties[".repositoryName"],
      repositoryOwner: block.properties[".repositoryOwner"],
      ...block.properties[".reviewers"] && {
        reviewers: block.properties[".reviewers"].split(" "),
      }
    })
  }
}

const pullRequestFields = `
  id
  number
  author {
    login
  }
  createdAt
  updatedAt
  title
  url
  state
  repository {
    name
    owner {
      login
    }
  }
  reviewRequests(first: 20) {
    nodes {
      requestedReviewer {
        ...on User {
          login
        }
      }
    }
  }
`

function parsePullRequest(node): PullRequest {
  return new PullRequest({
    id: node.id,
    number: node.number,
    author: node.author.login,
    created: DateTime.fromISO(node.createdAt),
    updated: DateTime.fromISO(node.updatedAt),
    title: node.title,
    url: node.url,
    state: node.state,
    repositoryName: node.repository.name,
    repositoryOwner: node.repository.owner.login,
    ...node.reviewRequests.nodes.length && {
      reviewers: node.reviewRequests.nodes.map((node) => node.requestedReviewer.login),
    }
  })
}

export async function fetchPullRequestById(client: Octokit, id: string): Promise<PullRequest> {
  const query = `
    query {
      node(id: "${id}") {
        ... on PullRequest {
          ${pullRequestFields}
        }
      }
  `
  const response = client.graphql(query)
  return parsePullRequest(response.node)
}

export async function fetchPullRequestByNumber(client: Octokit, repository: string, owner: string, number: number): Promise<PullRequest> {
  const query = `
    query {
      repository(owner: "${owner}", name: "${repository}") {
        pullRequest(number: ${number}) {
          ${pullRequestFields}
        }
      }
    }
  `
  const response = await client.graphql(query)
  return parsePullRequest(response.repository.pullRequest)
}

export async function fetchPullRequests(client: Octokit): Promise<PullRequest[]> {
  const query = `
    query {
      viewer {
        pullRequests(first: 100, states: [OPEN]) {
          nodes {
            ${pullRequestFields}
          }
        }
      }
    }
  `
  const response = await client.graphql(query)
  const pullRequests = [];
  for (const node of response.viewer.pullRequests.nodes) {
    const pullRequest = parsePullRequest(node);
    pullRequests.push(pullRequest);
  }
  return pullRequests;
}

export async function fetchReviewRequests(client: Octokit): Promise<PullRequest[]> {
  const query = `
    query {
      search(first: 100, query: "is:open is:pr review-requested:clstb", type: ISSUE) {
        nodes {
          ... on PullRequest {
            ${pullRequestFields}
          }
        }
      }
    }
  `
  const response = await client.graphql(query)
  const pullRequests = [];
  for (const node of response.search.nodes) {
    const pullRequest = parsePullRequest(node);
    pullRequests.push(pullRequest);
  }
  return pullRequests;
}
