import {Block} from './logseq';
import {BlockUUID, BlockEntity} from '@logseq/libs/dist/LSPlugin.user';
import {Octokit} from 'octokit';
import {DateTime} from 'luxon';
import util from 'util';
import {v5} from 'uuid';

const namespace = '4bd381ac-4474-4b43-ac28-17e0c6c1ebd3';

const PullRequestState = {
  id: '',
  title: '',
  repository: '',
  state: '',
  url: '',
  created: '',
  updated: '',
};

function formatDate(date: string) {
  const parsed = DateTime.fromISO(date);
  // Format date to 2023-04-13
  return `${parsed.toFormat('yyyy-MM-dd')}`;
}

class PullRequest implements Block {
  constructor(obj: Record<string, unknown>) {
    Object.assign(this, obj);
    const state = obj.state ? obj.state : {};
    this.state = state as typeof PullRequestState;
  }

  page: string;
  blockUUID: BlockUUID;
  state: typeof PullRequestState;

  content(): string {
    const prefix = this.state.state === 'OPEN' ? 'TODO' : 'DONE';
    return `${prefix} [${this.state.title}](${this.state.url})`;
  }
  properties(): Record<string, string> {
    return {
      repository: `[[github/${this.state.repository}]]`,
      state: this.state.state,
      created: `[[${formatDate(this.state.created)}]]`,
      updated: `[[${formatDate(this.state.updated)}]]`,
    };
  }
  async read(blockEntity: BlockEntity | null): Promise<void> {
    if (!blockEntity) {
      blockEntity = await logseq.Editor.getBlock(this.blockUUID);
    }
    Object.keys(PullRequestState).map(key => {
      if (!blockEntity?.properties[`.${key}`]) return;
      this.state[key] = blockEntity.properties[`.${key}`];
    });
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
const byIdQuery = `
{
  nodes(ids: [%s]) {
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
`;

export async function fetchPullRequests(
  octokit: Octokit,
  username: string
): Promise<Block[]> {
  const blocks = await logseq.Editor.getPageBlocksTree('github/pull-requests');
  const ids: string[] = [];

  for (const block of blocks) {
    const pr = new PullRequest({});
    pr.read(block);
    if (pr.state.state !== 'OPEN') continue;
    ids.push(pr.state.id);
  }

  const localPullRequests = await octokit.graphql(
    util.format(byIdQuery, ids.map(id => `"${id}"`).join(','))
  );
  const pullRequests = await octokit.graphql(util.format(prQuery, username));
  const reviewRequests = await octokit.graphql(
    util.format(reviewQuery, username)
  );

  const nodes = [
    ...localPullRequests.nodes,
    ...pullRequests.search.edges.map((edge: any) => edge.node),
    ...reviewRequests.search.edges.map((edge: any) => edge.node),
  ];

  const result: Record<string, Block> = {};
  for (const node of nodes) {
    if (node.id in result) continue;
    const blockUUID = v5(node.id, namespace);
    const pr = new PullRequest({
      page: 'github/pull-requests',
      blockUUID: blockUUID,
      state: {
        id: node.id,
        title: node.title,
        repository: node.repository.nameWithOwner,
        state: node.state,
        url: node.url,
        created: node.createdAt,
        updated: node.updatedAt,
      },
    });
    result[node.id] = pr;
  }

  return Object.values(result);
}
