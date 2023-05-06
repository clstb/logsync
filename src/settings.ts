import { SettingSchemaDesc } from "@logseq/libs/dist/LSPlugin.user";

export const settingsSchema: SettingSchemaDesc[] = [
  {
    key: "calendars",
    type: "object",
    title: "Calendars",
    description: "Key value pairs of calendar name and ics url",
    default: {}
  },
  {
    key: "event-renames",
    type: "object",
    title: "Event Renames",
    description: "Key value pairs of event name and new name",
    default: {}
  },
  {
    key: "github-token",
    type: "string",
    title: "Github Token",
    description: "Github personal access token",
    default: ""
  },
  {
    key: "jira-host",
    type: "string",
    title: "Jira Host",
    description: "Jira host url",
    default: ""
  },
  {
    key: "jira-email",
    type: "string",
    title: "Jira Email",
    description: "Jira email address",
    default: ""
  },
  {
    key: "jira-token",
    type: "string",
    title: "Jira Token",
    description: "Jira personal access token",
    default: ""
  }
]
