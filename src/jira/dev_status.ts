import { AgileClient, RequestConfig } from 'jira.js';
import { Issue } from "./issue";

export interface DevStatus {
  detail: {
    pullRequests: {
      url: string
    }[]
  }[]
}

export interface GetIssueDevStatus {
  issue: Issue;
  applicationType: string;
  dataType: string;
}

export async function fetchIssueDevStatus(
  client: AgileClient,
  parameters: GetIssueDevStatus
): Promise<DevStatus> {
  const config: RequestConfig = {
    method: 'GET',
    url: '/rest/dev-status/latest/issue/detail',
    params: {
      issueId: parameters.issue.id,
      applicationType: parameters.applicationType,
      dataType: parameters.dataType
    }
  };
  let callback: never;
  const response = await client.sendRequest<DevStatus>(config, callback)
  return response;
}
