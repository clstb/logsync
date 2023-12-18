import '@logseq/libs';
import {settingsSchema} from './settings';
import {fetchEvents} from './ics';
import {fetchPullRequests} from './github';
import {write} from './logseq';
import {Octokit} from 'octokit';

async function main() {
  logseq.useSettingsSchema(settingsSchema);
  const calendars = logseq.settings['calendars'];
  const renaming = logseq.settings['renaming'];
  const githubToken = logseq.settings['github-token'];

  function createModel() {
    return {
      sync: async () => {
        for (const name in calendars) {
          const renames = renaming[name] ? renaming[name] : {};
          const events = await fetchEvents(name, calendars[name], renames);
          await write(events);
        }

        if (githubToken) {
          const octokit = new Octokit({auth: githubToken});
          const {
            data: {login},
          } = await octokit.rest.users.getAuthenticated();
          const pullRequests = await fetchPullRequests(octokit, login);
          await write(pullRequests);
        }
      },
    };
  }

  logseq.provideModel(createModel());

  logseq.App.registerUIItem('toolbar', {
    key: 'logsync',
    template: `
      <a class="button" data-on-click="sync">
        <i class="ti ti-reload"></i>
      </a>
    `,
  });
}

logseq.ready(main).catch(console.error);
