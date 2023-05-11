import { Octokit } from "octokit";
import { Emitter } from "../events";
import {
  PullRequest,
  fetchPullRequestById,
  fetchPullRequestByNumber,
  fetchPullRequests,
  fetchReviewRequests
} from "./pull_request";

export class Github {
  client: Octokit;
  constructor(token: string) {
    this.client = new Octokit({
      auth: token,
    });
  }
  register = () => {
    Emitter.on("fetchPullRequest", this.fetchPullRequest);
    Emitter.on("fetchPullRequests", this.fetchPullRequests);
    Emitter.on("fetchReviewRequests", this.fetchReviewRequests);
  }
  fetchPullRequest = (pullRequest: PullRequest) => {
    if (pullRequest.id) {
      fetchPullRequestById(this.client, pullRequest.id).then((fetched) => {
        fetched.block_uuid = pullRequest.block_uuid
        Emitter.emit("fetchedPullRequest", fetched)
      })
    } else {
      fetchPullRequestByNumber(
        this.client,
        pullRequest.repositoryName,
        pullRequest.repositoryOwner,
        pullRequest.number,
      ).then((fetched) => {
        fetched.block_uuid = pullRequest.block_uuid
        Emitter.emit("fetchedPullRequest", fetched)
      })
    }
  }
  fetchPullRequests = () => {
    fetchPullRequests(this.client).then((pullRequests) => {
      pullRequests.map((pullRequest) => Emitter.emit("fetchedPullRequest", pullRequest))
    })
  }
  fetchReviewRequests = () => {
    fetchReviewRequests(this.client).then((pullRequests) => {
      pullRequests.map((pullRequest) => Emitter.emit("fetchedPullRequest", pullRequest))
    })
  }
}
