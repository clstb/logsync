import "@logseq/libs";
import axios from "axios";
import ical from "node-ical";
import { DateTime } from 'luxon';
import { PageEntity } from "@logseq/libs/dist/LSPlugin.user";

type Event = {
  title: string,
  meeting: string,
  date: DateTime,
  uid: string,

  block_uuid?: string;
}

async function ensureCalendarPage(calendar: string) {
  const page = await logseq.Editor.getPage(`calendar/${calendar}`);
  if (!page) {
    return await logseq.Editor.createPage(`calendar/${calendar}`);
  }
  return page
}

async function logseqEvents(calendar: string, eventRenames: Record<string,string>): Promise<Record<string, Event>> {
  const page = await logseq.Editor.getPage(`calendar/${calendar}`);
  if (!page) {
    return {};
  }

  const blocks = await logseq.Editor.getPageBlocksTree(`calendar/${calendar}`);
  const events: Record<string,Event> = {};

  for (const block of blocks) {
    if (!block.properties || !block.properties[".uid"]) {
      continue;
    }
    const event = {
      uid: block.properties[".uid"],
      title: block.properties[".title"],
      date: DateTime.fromISO(block.properties[".date"]),
      meeting: block.properties["meeting"],
      block_uuid: block.uuid,
    };
    events[event.uid] = event;
  }

  for (const event of Object.values(events)) {
    const key = Object.keys(eventRenames).find(key => eventRenames[key] === event.title)
    if (key) {
      event.title = key
    }
  }

  return events;
}

async function remoteEvents(url: string, eventRenames: Record<string,string>): Promise<Record<string, Event>> {
  const response = await axios.get(url);
  return parseEvents(response.data, eventRenames);
}

function parseEvents(data, eventRenames: Record<string, string>): Record<string, Event> {
  const parsed = ical.parseICS(data);
  const events: Record<string, Event> = {};
  const today = DateTime.local();

  for (let key in parsed) {
    let event = parsed[key];

    if (event.type !== 'VEVENT') continue;

    if (event.rrule) {
      if (DateTime.fromJSDate(event.rrule.options.until) < today) continue;
    } else {
      if (DateTime.fromJSDate(event.start) < today) continue;
    }

    let date = DateTime.fromJSDate(event.start);
    if (event.rrule) {
      const rrule = event.rrule
      let currentDate = event.rrule.after(today.toJSDate(), true)
      if (!currentDate) {
        continue
      }
      // Get the timezone identifier from the rrule object
      const tzid = rrule.origOptions.tzid

      // Get the original start date and offset from the rrule object
      const originalDate = new Date(rrule.origOptions.dtstart)
      const originalTzDate = DateTime.fromJSDate(originalDate, { zone: tzid })
      const originalOffset = originalTzDate.offset

      const currentTzDate = DateTime.fromJSDate(currentDate, { zone: tzid })
      const currentOffset = currentTzDate.offset

      // Calculate the difference between the current offset and the original offset
      const offsetDiff = currentOffset - originalOffset

      // Adjust the start date by the offset difference to get the corrected start date
      currentDate.setHours(currentDate.getHours() - offsetDiff / 60)
      date = DateTime.fromJSDate(currentDate)
    }

    date = date.set({ second: 0, millisecond: 0 });
    const title = event.summary.replace(/\//g, "|");
    const meetingMatches = event.description.match(/(https:\/\/meet\.google\.com\/[\w-]+)/);

    events[event.uid] = {
      title: title,
      meeting: meetingMatches ? meetingMatches[1] : null,
      date: date,
      uid: event.uid,
    }
  }

  for (const event of Object.values(events)) {
    if (eventRenames[event.title]) {
      event.title = eventRenames[event.title]
    }
  }

  return events;
}

function formatDate(date: DateTime) {
  // Format date to <2023-04-13 Thu 09:00>
  const day = date.toFormat("ccc");
  const time = date.toFormat("HH:mm");
  return `<${date.toFormat("yyyy-MM-dd")} ${day} ${time}>`;
}

function eventToBlock(page: PageEntity, event: Event) {
  const dateString = formatDate(event.date);
  let properties = {
    ".uid": event.uid,
    ".title": event.title,
    ".date": event.date.toISO(),
  }
  if (event.meeting) {
    properties["meeting"] = event.meeting;
  }
  return {
    content: `[[${page.name}/${event.title}]]\nSCHEDULED: ${dateString}`,
    properties: properties,
  }
}

async function insertEventBlocks(page: PageEntity, events: Event[]) {
  events.sort((a, b) => a.date.toUnixInteger() - b.date.toUnixInteger());
  const blocks = [];
  for (const event of events) {
    blocks.push(eventToBlock(page, event));
  }
  if (blocks.length > 0) {
    await logseq.Editor.insertBatchBlock(page.uuid, blocks, { before: false, sibling: true });
  }
}

async function updateEventBlock(page: PageEntity, event: Event) {
  const block = eventToBlock(page, event);
  await logseq.Editor.updateBlock(event.block_uuid, block.content, { properties: block.properties });
}

async function deleteEventBlocks(events: Event[]) {
  for (const event of events) {
    await logseq.Editor.removeBlock(event.block_uuid);
  }
}

function updateEvent(now: DateTime, local: Event, remote: Event): [Event, boolean] {
  let changed = false;
  if (local.title !== remote.title) {
    local.title = remote.title;
    changed = true;
  }
  if (local.date !== remote.date) {
    if (local.date.toISOWeekDate() !== now.toISOWeekDate()) {
      local.date = remote.date;
      changed = true;
    }
  }
  if (local.meeting !== remote.meeting) {
    local.meeting = remote.meeting;
    changed = true;
  }
  return [local, changed];
}

export class ICS {
  calendars = {}
  eventRenames = {};
  constructor(calendars: Record<string, string>, eventRenames: Record<string, string>) {
    this.calendars = calendars;
    this.eventRenames = eventRenames;
  }

  sync = async function() {
    const now = DateTime.local();
    for (let calendarName in this.calendars) {
      const page = await ensureCalendarPage(calendarName);
      const url = this.calendars[calendarName];
      const local = await logseqEvents(calendarName, this.eventRenames);
      const remote = await remoteEvents(url, this.eventRenames);
      const toInsert = [];
      const toDelete = [];
      for (let uid in remote) {
        if (local[uid]) {
          const [updated, changed] = updateEvent(now, local[uid], remote[uid]);
          if (changed) {
            await updateEventBlock(page, updated)
          }
        } else {
          toInsert.push(remote[uid]);
        };
      }
      for (let uid in local) {
        if (!remote[uid]) {
          toDelete.push(local[uid]);
        }
      }
      await insertEventBlocks(page, toInsert);
      await deleteEventBlocks(toDelete);
    }
  }
}
