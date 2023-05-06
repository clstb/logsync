import "@logseq/libs";
import { BlockEntity } from "@logseq/libs/dist/LSPlugin.user";
import { Octokit } from "octokit";
import { SyncBlock, Fetcher, marshal, unmarshal, dateToStr } from "./sync";

export class PullRequest implements SyncBlock {
  id: string;
  namespace: string;
  synced: string;
  block_uuid?: string;

  author: string;
  title: string;
  url: string;
  state: string;
  created: string;
  updated: string;
  repository: string;
  reviewers: string;

  marshal(): BlockEntity {
    const block = marshal(this);

    const taskStr = this.state === "OPEN" ? "LATER" : "DONE";
    const content = `${taskStr} [${this.title}](${this.url})`
    const properties = {
      ".author": this.author,
      ".title": this.title,
      ".url": this.url,
      ".state": this.state,
      ".created": this.created,
      ".updated": this.updated,
      ".repository": this.repository,
      ".reviewers": this.reviewers,
    }
    block.content = content;
    for (const [key, value] of Object.entries(properties)) {
      block.properties[key] = value;
    }
    return block
  }
  unmarshal(block: BlockEntity) {
    unmarshal<this>(block, this);
    this.author = block.properties[".author"];
    this.title = block.properties[".title"];
    this.url = block.properties[".url"];
    this.state = block.properties[".state"];
    this.created = block.properties[".created"];
    this.updated = block.properties[".updated"];
    this.repository = block.properties[".repository"];
    this.reviewers = block.properties[".reviewers"];
  }
}

// Get a pull request from the github api by id
async function githubPullRequest(client: Octokit, id: string): Promise<PullRequest> {
  const response = await client.graphql(
    `
    query {
      node(id: "${id}") {
        ... on PullRequest {
          id
          author {
            login
          }
          createdAt
          updatedAt
          title
          url
          state
          repository {
            nameWithOwner
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
        }
      }
    }
    `
  );
  return parseGithubPullRequest(response.node);
}

function parsePullRequestNode(node): PullRequest {
  const pullRequest = new PullRequest();
  pullRequest.id = node.id;
  pullRequest.author = node.author.login;
  pullRequest.title = node.title;
  pullRequest.url = node.url;
  pullRequest.state = node.state;
  pullRequest.created = node.createdAt;
  pullRequest.updated = node.updatedAt;
  pullRequest.repository = node.repository.nameWithOwner;
  pullRequest.reviewers = node.reviewRequests.nodes.map((node) => node.requestedReviewer.login).join(", ");
  return pullRequest;

}

export class PullRequestsFetcher implements Fetcher {
  client = null;
  constructor(client: Octokit) {
    this.client = client
  }

  async fetch<PullRequest>(namespace: string): Promise<Record<string, PullRequest>> {
    const response = await this.client.graphql(
      `
      query {
        viewer {
          pullRequests(first: 100, states: [OPEN]) {
            nodes {
              id
              author {
                login
              }
              createdAt
              updatedAt
              title
              url
              state
              repository {
                nameWithOwner
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
            }
          }
        }
      }
      `
    );
    const pullRequests = {};
    for (const node of response.viewer.pullRequests.nodes) {
      const pullRequest = parsePullRequestNode(node);
      pullRequest.namespace = namespace;
      pullRequests[pullRequest.id] = pullRequest;
    }
    return pullRequests;
  }
}

export class ReviewRequestsFetcher implements Fetcher {
  client: Octokit = null;
  constructor(client: Octokit) {
    this.client = client
  }

  async fetch<PullRequest>(namespace: string): Promise<Record<string, PullRequest>> {
    const response = await this.client.graphql(
      `
      query {
        search(first: 20, query: "is:open is:pr review-requested:clstb", type: ISSUE) {
          nodes {
            ... on PullRequest {
              id
              author {
                login
              }
              createdAt
              updatedAt
              title
              url
              state
              repository {
                nameWithOwner
              }
              reviewRequests(first: 20) {
                nodes {
                  requestedReviewer {
                    ... on User {
                      login
                    }
                  }
                }
              }
            }
          }
        }
      }
      `
    );
    const pullRequests = {};
    for (const node of response.search.nodes) {
      const pullRequest = parsePullRequestNode(node);
      pullRequest.namespace = namespace;
      pullRequests[pullRequest.id] = pullRequest;
    }
    return pullRequests;
  }
}
