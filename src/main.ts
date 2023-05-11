import "@logseq/libs";
import { settingsSchema } from "./settings";
import { Emitter } from "./events";
import { Logseq } from "./logseq/api";
import { Github } from "./github/api";
import { Jira } from "./jira/api";
import { PullRequest } from "./github/pull_request";
import { ICS } from "./ics/api"
import { v5 } from "uuid";

const namespace = "062249fe-f22c-456e-bcc1-4fcfb2880b08";

async function main() {
  logseq.useSettingsSchema(settingsSchema);
  const calendars = logseq.settings["calendars"];
  const githubToken = logseq.settings["github-token"];
  const jiraHost = logseq.settings["jira-host"];
  const jiraEmail = logseq.settings["jira-email"];
  const jiraApiToken = logseq.settings["jira-token"];

  if (calendars) {
    new ICS(calendars).register();
  }
  if (githubToken) {
    new Github(githubToken).register();
  }
  if (jiraHost && jiraEmail && jiraApiToken) {
    new Jira(jiraHost, jiraEmail, jiraApiToken).register();
  }

  // Logseq
  const ls = new Logseq();
  ls.register()
  Emitter.on("gotPage", ls.getOrCreateBlock)
  Emitter.on("createdPage", ls.createBlock)
  Emitter.on("gotBlock", ls.updateBlock)

  // ICS
  Emitter.on("fetchedEvent", (event) => Emitter.emit("upsertBlockWithPage", event))

  // Github
  Emitter.on("fetchedPullRequest", (pullRequest) => Emitter.emit("upsertBlockWithPage", pullRequest))

  // Jira
  Emitter.on("fetchedBoard", (board) => Emitter.emit("upsertBlockWithPage", board));
  Emitter.on("fetchedSprint", (sprint) => Emitter.emit("upsertBlockWithPage", sprint));
  Emitter.on("fetchedIssue", (issue) => Emitter.emit("fetchIssueDevStatus", {
    issue: issue,
    applicationType: "GitHub",
    dataType: "branch",
  }));
  Emitter.on("fetchedIssueDevStatus", (event) => {
    const [issue, devStatus] = event;
    const urls = devStatus.detail.map((d) => d.pullRequests.map((p) => p.url)).flat();
    const uuids = [];
    urls.map((url) => {
      const split = url.split("/");
      const repositoryOwner = split[3];
      const repositoryName = split[4];
      const pullRequestNumber = split[6];
      const page = `github/${repositoryOwner}/${repositoryName}/pull/${pullRequestNumber}`
      const uuid = v5(page, namespace);
      uuids.push(uuid);
      Emitter.emit("fetchPullRequest", new PullRequest({
        block_uuid: uuid,
        repositoryOwner: repositoryOwner,
        repositoryName: repositoryName,
        number: pullRequestNumber,
      }));
    })
    if (uuids.length > 0) {
      issue.pullRequests = uuids.map((uuid) => `{{embed ((${uuid}))}}`).join(" ");
    }
    Emitter.emit("upsertBlockWithPage", issue);
  })

  // Logsync
  Emitter.on("sync", () => {
    Emitter.emit("fetchPullRequests");
    Emitter.emit("fetchReviewRequests");
    Emitter.emit("fetchBoards");
    Emitter.emit("fetchCalendars");
  })

  function createModel() {
    return {
      sync: () => { Emitter.emit("sync") }
    };
  }

  logseq.provideModel(createModel());
  logseq.App.registerUIItem("toolbar",
    {
      key: "bla",
      template: `
      <a class="button" data-on-click="sync">
        <i class="ti ti-arrow-down"></i>
      </a>
    `,
    });
}

logseq.ready(main).catch(console.error);
