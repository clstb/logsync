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
    key: "renaming",
    type: "object",
    title: "Renaming",
    description: "Key value pairs of calendar name and object mapping old to new event names",
    default: {}
  },
]
