import "@logseq/libs";
import { settingsSchema } from "./settings";
import { fetchEvents } from "./ics";
import { write } from "./logseq";

async function main() {
  logseq.useSettingsSchema(settingsSchema);
  const calendars = logseq.settings["calendars"];
  const renaming = logseq.settings["renaming"];

  function createModel() {
    return {
      sync: async () => {
        for (let name in calendars) {
          const renames = renaming[name] ? renaming[name] : {}
          const events = await fetchEvents(name, calendars[name], renames);
          await write(events);
        }
      }
    }
  };

  logseq.provideModel(createModel());

  logseq.App.registerUIItem("toolbar", {
    key: "logsync",
    template: `
      <a class="button" data-on-click="sync">
        <i class="ti ti-reload"></i>
      </a>
    `,
  });
}

logseq.ready(main).catch(console.error);
