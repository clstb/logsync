import { AgileClient, AgileParameters } from "jira.js";
import { fetchBoards } from "./board";
import { fetchSprints } from "./sprint";
import { fetchIssues } from "./issue";
import { fetchIssueDevStatus, GetIssueDevStatus } from "./dev_status";
import { Emitter } from "../events";

export class Jira {
  client: AgileClient;
  constructor(host: string, email: string, apiToken: string) {
    this.client = new AgileClient({
      host: host,
      authentication: {
        basic: {
          email: email,
          apiToken: apiToken,
        },
      },
      newErrorHandling: true,
    });
  }
  register = () => {
    Emitter.on("fetchBoards", this.fetchBoards);
    Emitter.on("fetchSprints", this.fetchSprints);
    Emitter.on("fetchIssues", this.fetchIssues);
    Emitter.on("fetchIssueDevStatus", this.fetchIssueDevStatus);
  }
  fetchBoards = () => {
    fetchBoards(this.client).then((boards) => {
      boards.map((board) => {
        Emitter.emit("fetchedBoard", board)
        Emitter.emit("fetchSprints", { boardId: board.id, state: "active" })
      })
    })
  }
  fetchSprints = (parameters: AgileParameters.GetAllSprints) => {
    fetchSprints(this.client, parameters).then((sprints) => {
      sprints.map((sprint) => {
        Emitter.emit("fetchedSprint", sprint)
        Emitter.emit("fetchIssues", { sprintId: sprint.id })
      })
    })
  }
  fetchIssues = (parameters: AgileParameters.GetIssuesForSprint) => {
    fetchIssues(this.client, parameters).then((issues) => {
      issues.map((issue) => Emitter.emit("fetchedIssue", issue))
    })
  }
  fetchIssueDevStatus = (parameters: GetIssueDevStatus) => {
    fetchIssueDevStatus(this.client, parameters).then((devStatus) => {
      Emitter.emit("fetchedIssueDevStatus", [parameters.issue, devStatus])
    })
  }
}
