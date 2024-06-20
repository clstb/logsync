import {Block} from './logseq';
import {BlockUUID, BlockEntity} from '@logseq/libs/dist/LSPlugin.user';
import {Octokit} from 'octokit';
import {DateTime} from 'luxon';
import util from 'util';
import {v5} from 'uuid';
import {PRQuery, PRReviewQuery, PRByIdQuery} from './query';
import {Review} from './review';

const namespace = '4bd381ac-4474-4b43-ac28-17e0c6c1ebd3';

export const PullRequestState = {
  id: '',
  title: '',
  repository: '',
  state: '',
  url: '',
  created: '',
  updated: '',
  reviews: '',
};

function formatDate(date: string) {
  const parsed = DateTime.fromISO(date);
  // Format date to 2023-04-13
  return `${parsed.toFormat('yyyy-MM-dd')}`;
}

export class PullRequest implements Block {
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
      ...(this.state.reviews && {
        reviews: this.state.reviews
          .split(' ')
          .map(uuid => {
            return `((${uuid}))`;
          })
          .join('@@html: <br>@@'),
      }),
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

export async function fetchPullRequests(
  octokit: Octokit,
  username: string
): Promise<Block[]> {
  const ids: string[] = [];

  let page = await logseq.Editor.getPage('github/pull-requests');
  if (page) {
    const blocks = await logseq.Editor.getPageBlocksTree('github/pull-requests');
    for (const block of blocks) {
      const pr = new PullRequest({});
      pr.read(block);
      if (pr.state.state !== 'OPEN') continue;
      ids.push(pr.state.id);
    }
  }

  const localPullRequests = await octokit.graphql(
    util.format(PRByIdQuery, ids.map(id => `"${id}"`).join(','))
  );
  const pullRequests = await octokit.graphql(util.format(PRQuery, username));
  const reviewRequests = await octokit.graphql(
    util.format(PRReviewQuery, username)
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

    const reviews = [];
    for (const review of node.latestReviews.nodes) {
      const reviewUUID = v5(review.id, namespace);
      const reviewBlock = new Review({
        page: 'github/reviews',
        blockUUID: reviewUUID,
        state: {
          id: review.id,
          state: review.state,
          prState: node.state,
          login: review.author.login,
          created: node.createdAt,
          updated: node.updatedAt,
        },
      });
      reviews.push(reviewBlock);
    }

    for (const reviewRequest of node.reviewRequests.nodes) {
      const reviewUUID = v5(reviewRequest.id, namespace);
      const reviewBlock = new Review({
        page: 'github/reviews',
        blockUUID: reviewUUID,
        state: {
          id: reviewRequest.id,
          state: 'REQUESTED',
          prState: node.state,
          login: reviewRequest.requestedReviewer.login,
        },
      });
      reviews.push(reviewBlock);
    }

    pr.state.reviews = reviews.map(review => review.blockUUID).join(' ');
    result[pr.state.id] = pr;
    reviews.map(review => (result[review.state.id] = review));
  }

  return Object.values(result);
}
