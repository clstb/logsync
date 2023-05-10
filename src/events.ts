import "@logseq/libs";
import mitt from 'mitt';
import { Block } from "./logseq/api";
import { Issue } from "./jira/issue";
import { Board } from "./jira/board";
import { Sprint } from "./jira/sprint";
import { Event } from "./ics/event";
import { DevStatus, GetIssueDevStatus } from "./jira/dev_status";
import { PullRequest } from "./github/pull_request";
import { AgileParameters } from "jira.js";

type Events = {
  // Logsync
  sync: void;

  // Logseq
  upsertBlockWithPage: Block;
  getOrCreatePage: Block;
  createPage: Block;
  getOrCreateBlock: Block;
  createBlock: Block;
  updateBlock: Block;

  gotPage: Block;
  createdPage: Block;
  gotBlock: Block;

  // ICS
  fetchCalendars: void;
  fetchEvents: [string, string];

  fetchedEvent: Event;

  // Github
  fetchPullRequest: PullRequest;
  fetchPullRequests: void;
  fetchReviewRequests: void;

  fetchedPullRequest: PullRequest;

  // Jira
  fetchBoards: void;
  fetchSprints: AgileParameters.GetAllSprints;
  fetchIssues: AgileParameters.GetIssuesForSprint;
  fetchIssueDevStatus: GetIssueDevStatus;

  fetchedBoard: Board;
  fetchedSprint: Sprint;
  fetchedIssue: Issue;
  fetchedIssueDevStatus: [Issue, DevStatus];
}

export const Emitter = mitt<Events>();
