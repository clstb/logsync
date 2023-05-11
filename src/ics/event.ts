import { BlockEntity } from "@logseq/libs/dist/LSPlugin.user";
import axios from "axios";
import { DateTime } from "luxon";
import ical from "node-ical";
import { Block } from "../logseq/api";

function formatDate(date: DateTime) {
  // Format date to <2023-04-13 Thu 09:00>
  const day = date.toFormat("ccc");
  const time = date.toFormat("HH:mm");
  return `<${date.toFormat("yyyy-MM-dd")} ${day} ${time}>`;
}

export class Event implements Block {
  constructor(obj) {
    Object.assign(this, obj)
  }

  block_uuid?: string;

  id: string;
  title: string;
  meeting: string;
  date: DateTime;
  calendar: string;

  page(): string {
    return `calendars/${this.calendar}/${this.title}`
  }
  marshal(): BlockEntity {
    const dateString = formatDate(this.date);
    const content = `${this.title}\nSCHEDULED: ${dateString}`;
    const properties = {
      ".id": this.id,
      ".title": this.title,
      ...this.meeting && {"meeting": this.meeting},
      ".date": this.date.toISO(),
      ".calendar": this.calendar,
    }
    const block = {
      content: content,
      properties: properties,
    } as Partial<BlockEntity>;
    return block as BlockEntity;
  }
  unmarshal(block: BlockEntity): Block {
    this.block_uuid = block.uuid;
    return new Event({
      block_uuid: block.uuid,
      id: block.properties[".id"],
      title: block.properties[".title"],
      ...block.properties["meeting"] && {meeting: block.properties["meeting"]},
      date: DateTime.fromISO(block.properties[".date"]),
      calendar: block.properties[".calendar"],
    })
  }
}

function parseEvents(calendar, data): Event[] {
  const parsed = ical.parseICS(data);
  const today = DateTime.local();

  const events: Event[] = [];
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

    events.push(new Event({
      id: event.uid,
      title: title,
      ...meetingMatches && { meeting: meetingMatches[1] },
      date: date,
      calendar: calendar,
    }))
  }

  return events;
}

export async function fetchEvents(calendar: string, url: string): Promise<Event[]> {
  const response = await axios.get(url);
  return parseEvents(calendar, response.data);
}
