import {Block} from './logseq';
import {BlockUUID} from '@logseq/libs/dist/LSPlugin.user';
import {Octokit} from 'octokit';
import {DateTime} from 'luxon';
import util from 'util';
import {v5} from 'uuid';

const namespace = '4bd381ac-4474-4b43-ac28-17e0c6c1ebd3';

class PullRequestState {
  id: string;
  title: string;
  repository: string;
  state: string;
  url: string;
  createdAt: string;
  updatedAt: string;
}

function formatDate(date: string) {
  const parsed = DateTime.fromISO(date);
  // Format date to 2023-04-13
  return `${parsed.toFormat('yyyy-MM-dd')}`;
}

class PullRequest implements Block {
  constructor(obj: Record<string, unknown>) {
    Object.assign(this, obj);
  }

  page: string;
  blockUUID: BlockUUID;
  state: PullRequestState;

  content(): string {
    return `TODO [${this.state.title}](${this.state.url})`;
  }
  properties(): Record<string, string> {
    return {
      repository: `[[github/${this.state.repository}]]`,
      state: this.state.state,
      created: `[[${formatDate(this.state.createdAt)}]]`,
      updated: `[[${formatDate(this.state.updatedAt)}]]`,
    };
  }
}

const baseQuery = `
{
  search(query: "%s", type: ISSUE, first: 100) {
    edges {
      node {
        ... on PullRequest {
          repository {
            nameWithOwner
          }
          url
          title
          id
          state
          createdAt
          updatedAt
        }
      }
    }
  }
}
`;
const prQuery = util.format(baseQuery, 'type:pr state:open author:%s');
const reviewQuery = util.format(baseQuery, 'state:open review-requested:%s');

export async function fetchPullRequests(
  octokit: Octokit,
  username: string
): Promise<PullRequest[]> {
  const result: PullRequest[] = [];

  const pullRequests = await octokit.graphql(util.format(prQuery, username));
  const reviewRequests = await octokit.graphql(
    util.format(reviewQuery, username)
  );

  for (const edges of [
    pullRequests.search.edges,
    reviewRequests.search.edges,
  ]) {
    for (const pr of edges) {
      const blockUUID = v5(pr.node.id, namespace);
      result.push(
        new PullRequest({
          page: 'github/pull-requests',
          blockUUID: blockUUID,
          state: {
            id: pr.node.id,
            title: pr.node.title,
            repository: pr.node.repository.nameWithOwner,
            state: pr.node.state,
            url: pr.node.url,
            createdAt: pr.node.createdAt,
            updatedAt: pr.node.updatedAt,
          },
        })
      );
    }
  }

  return result;
}
