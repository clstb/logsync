import "@logseq/libs";
import { settingsSchema } from "./settings";
import { PullRequest, PullRequestsFetcher, ReviewRequestsFetcher } from "./github";
import { Board, Sprint, Issue, BoardsFetcher, SprintsFetcher, IssuesFetcher } from "./jira";
import { sync } from "./sync";
import { AgileClient } from "jira.js"
import { Octokit } from "octokit";


async function main() {
  logseq.useSettingsSchema(settingsSchema);

  const githubToken = logseq.settings["github-token"];
  const githubClient = new Octokit({ auth: githubToken });

  const pullRequestsFetcher = new PullRequestsFetcher(githubClient);
  const reviewRequestsFetcher = new ReviewRequestsFetcher(githubClient);

  const jiraHost = logseq.settings["jira-host"];
  const jiraEmail = logseq.settings["jira-email"];
  const jiraToken = logseq.settings["jira-token"];
  const agileClient = new AgileClient({
    host: jiraHost,
    authentication: {
      basic: {
        email: jiraEmail,
        apiToken: jiraToken,
      },
    },
    newErrorHandling: true,
  });
  const boardFetcher = new BoardsFetcher(agileClient);
  const sprintFetcher = new SprintsFetcher(agileClient);
  const issueFetcher = new IssuesFetcher(agileClient);


  function createModel() {
    return {
      sync: async function() {
        const pullRequestsPromise = sync<PullRequest>(PullRequest, "github/pull-requests", pullRequestsFetcher, false);
        const reviewRequestsPromise = sync<PullRequest>(PullRequest, "github/review-requests", reviewRequestsFetcher, false);
        const boardIdsPromise = sync<Board>(Board, "jira/boards", boardFetcher, false);
        const boardIds = await boardIdsPromise;
        const sprintsPromises = boardIds.map(boardId =>
          sync<Sprint>(Sprint, `jira/sprints`, sprintFetcher, false, {
            state: "active,future",
            boardId: boardId,
          })
        );
        const sprints = await Promise.all(sprintsPromises);
        const issuesPromises = sprints.flat().map(sprintId =>
          sync<Issue>(Issue, `jira/issues`, issueFetcher, false, {
            sprintId: sprintId,
          })
        );
        await Promise.all([pullRequestsPromise, reviewRequestsPromise, ...issuesPromises]);
        console.log("synced")
      },
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
