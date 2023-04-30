import "@logseq/libs";
import { PageEntity } from "@logseq/libs/dist/LSPlugin.user";
import { Octokit } from "octokit";

type PullRequest = {
  id: string;
  author: string;
  title: string;
  url: string;
  state: string;
  created: string;
  updated: string;
  repository: string;
  reviewers: string;

  block_uuid?: string;
}
async function ensurePullRequestsPage(): Promise<PageEntity> {
  const page = await logseq.Editor.getPage("github/pull-requests"); if (!page) { return await logseq.Editor.createPage("github/pull-requests"); }
  return page;
}

async function logseqPullRequests(): Promise<Record<string, PullRequest>> {
  const blocks = await logseq.Editor.getPageBlocksTree("github/pull-requests");
  const pullRequests = {};
  for (const block of blocks) {
    if (!block.properties || !block.properties[".id"]) {
      continue;
    }
    const pullRequest = {
      id: block.properties[".id"],
      author: block.properties["author"],
      title: block.properties[".title"],
      url: block.properties[".url"],
      state: block.properties["state"],
      createdAt: block.properties["createdAt"],
      updatedAt: block.properties["updatedAt"],
      repository: block.properties["repository"],
      reviewers: block.properties["reviewers"],
      block_uuid: block.uuid,
    };
    pullRequests[pullRequest.id] = pullRequest;
  }
  return pullRequests;
}

async function githubReviewRequests(client: Octokit): Promise<Record<string, PullRequest>> {
  const response = await client.graphql(
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
    const pullRequest = parseGithubPullRequest(node);
    pullRequests[pullRequest.id] = pullRequest;
  }
  return pullRequests;
}

async function githubPullRequests(client: Octokit): Promise<Record<string, PullRequest>> {
  const response = await client.graphql(
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
    const pullRequest = parseGithubPullRequest(node);
    pullRequests[pullRequest.id] = pullRequest;
  }
  return pullRequests;
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

function parseGithubPullRequest(node): PullRequest {
  const nthNumber = (n: number) => {
    const s = ["th", "st", "nd", "rd"];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  };

  const reviewers = node.reviewRequests.nodes.map((node) => `[[github/${node.requestedReviewer.login}]]`).join(", ");
  const created = new Date(node.createdAt);
  const createdStr = `${created.toLocaleString("default", { month: "short" })} ${nthNumber(created.getDate())}, ${created.getFullYear()}`;
  const updated = new Date(node.updatedAt);
  const updatedStr = `${updated.toLocaleString("default", { month: "short" })} ${nthNumber(updated.getDate())}, ${updated.getFullYear()}`;
  const author = `[[github/${node.author.login}]]`;
  return {
    id: node.id,
    author: author,
    title: node.title,
    url: node.url,
    state: node.state,
    created: `[[${createdStr}]]`,
    updated: `[[${updatedStr}]]`,
    repository: `[[github/${node.repository.nameWithOwner}]]`,
    reviewers: reviewers,
  }
}


function pullRequestToBlock(pullRequest: PullRequest) {
  const taskStr = pullRequest.state === "OPEN" ? "LATER" : "DONE";
  return {
    uuid: pullRequest.block_uuid,
    content: `${taskStr} [${pullRequest.title}](${pullRequest.url})`,
    properties: {
      ".id": pullRequest.id,
      ".title": pullRequest.title,
      ".url": pullRequest.url,
      "author": pullRequest.author,
      "state": pullRequest.state,
      "created": pullRequest.created,
      "updated": pullRequest.updated,
      "repository": pullRequest.repository,
      "reviewers": pullRequest.reviewers,
    },
  }
}

async function updatePullRequestBlock(pullRequest: PullRequest) {
  const block = pullRequestToBlock(pullRequest);
  await logseq.Editor.updateBlock(pullRequest.block_uuid, block.content, { properties: block.properties })
}

async function insertPullRequestBlocks(page: PageEntity, pullRequests: PullRequest[]) {
  const blocks = [];
  for (const pullRequest of pullRequests) {
    blocks.push(pullRequestToBlock(pullRequest));
  }
  if (blocks.length > 0) {
    await logseq.Editor.insertBatchBlock(page.uuid, blocks, { before: false, sibling: true });
  }
}

function updatePullRequest(local: PullRequest, remote: PullRequest): [PullRequest, boolean] {
  let changed = false;
  if (local.author !== remote.author) {
    local.author = remote.author;
    changed = true;
  }
  if (local.title !== remote.title) {
    local.title = remote.title;
    changed = true;
  }
  if (local.updated !== remote.updated) {
    local.updated = remote.updated;
    changed = true;
  }
  if (local.created !== remote.created) {
    local.created = remote.created;
    changed = true;
  }
  if (local.reviewers !== remote.reviewers) {
    local.reviewers = remote.reviewers;
    changed = true;
  }
  if (local.state !== remote.state) {
    local.state = remote.state;
    changed = true;
  }
  return [local, changed];
}

export class Github {
  client = null;
  constructor(token: string) {
    this.client = new Octokit({
      auth: token,
    });
  }
  sync = async function() {
    const page = await ensurePullRequestsPage();
    const local = await logseqPullRequests();
    const remotePullRequests = await githubPullRequests(this.client);
    const remoteReviews = await githubReviewRequests(this.client);
    const remote = { ...remotePullRequests, ...remoteReviews };

    const toInsert = [];
    for (const pullRequest of Object.values(remote)) {
      if (local[pullRequest.id]) {
        const [updated, changed] = updatePullRequest(local[pullRequest.id], pullRequest);
        if (changed) {
          await updatePullRequestBlock(updated);
        }
      } else {
        toInsert.push(pullRequest);
      }
    }
    for (const pullRequest of Object.values(local)) {
      if (!remote[pullRequest.id]) {
        const fetched = await githubPullRequest(this.client, pullRequest.id);
        const [updated, changed] = updatePullRequest(pullRequest, fetched);
        if (changed) {
          await updatePullRequestBlock(updated);
        }
      }
    }
    await insertPullRequestBlocks(page, toInsert);
  }
}
