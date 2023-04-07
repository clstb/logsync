import "@logseq/libs";
import { Github } from "./github";
import { ICS } from "./ics";
import { Jira } from "./jira";
import { settingsSchema } from "./settings";


function sync(ics: ICS, github: Github, jira: Jira) {
  const sources  = [ics]
  if (github != null) {
    sources.push(github)
  }
  if (jira != null) {
    sources.push(jira)
  }

  return async function() {
    await Promise.all(sources.map(source => source.sync()))
  }
}

async function main() {
  logseq.useSettingsSchema(settingsSchema);

  const ics = new ICS();

  const githubToken = logseq.settings["github-token"];
  let github: Github = null;
  if (githubToken != "") {
    github = new Github(githubToken);
  }


  const jiraHost = logseq.settings["jira-host"];
  const jiraEmail = logseq.settings["jira-email"];
  const jiraToken = logseq.settings["jira-token"];
  let jira: Jira = null;
  if (jiraHost != "" && jiraEmail != "" && jiraToken != "") {
    jira = new Jira(jiraHost, jiraEmail, jiraToken);
  }

  function createModel() {
    return {
      sync: sync(ics, github, jira),
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
