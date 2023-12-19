import util from 'util';

const latestReviews = `
latestReviews(first: 100) {
  nodes {
    id
    state
    author {
      login
    }
  }
}
`;
const reviewRequests = `
reviewRequests(first: 100) {
  nodes {
    id
    requestedReviewer {
      ...on User {
        login
      }
    }
  }
}
`;

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
          ${latestReviews}
          ${reviewRequests}
        }
      }
    }
  }
}
`;
export const PRQuery = util.format(baseQuery, 'type:pr state:open author:%s');
export const PRReviewQuery = util.format(
  baseQuery,
  'state:open review-requested:%s'
);
export const PRByIdQuery = `
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
      ${latestReviews}
      ${reviewRequests}
    }
  }
}
`;
