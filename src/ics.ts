import { Block } from "./logseq";
import { BlockUUID } from "@logseq/libs/dist/LSPlugin.user";
import axios from "axios";
import ical from "node-ical";
import { DateTime } from "luxon";
import { v5 } from "uuid";

const namespace = "dd13a47c-c074-4ef9-9676-66792035d4be"

class EventState {
  title: string;
  start: string;
  end: string;
  meeting?: string;
}

export class Event implements Block {
  constructor(obj: Record<string,any>) {
    Object.assign(this, obj)
  }

  page: string;
  block_uuid: BlockUUID;
  state: EventState;

  content(): string {
    return `TODO [[${this.state.title}]]\n`;
  };
  properties(): Record<string, string> {
    return {
      start: formatDate(this.state.start),
      end: formatDate(this.state.end),
      ...this.state.meeting && {"meeting": this.state.meeting},
    }
  };
}

function formatDate(date: string) {
  const parsed = DateTime.fromISO(date);
  // Format date to 2023-04-13 09:00
  const time = parsed.toFormat("HH:mm");
  return `${parsed.toFormat("yyyy-MM-dd")} ${time}`;
}

export async function fetchEvents(
  name: string,
  url: string,
  renaming: Record<string, string>,
): Promise<Event[]> {
  const today = DateTime.local();
  const response = await axios.get(url);
  const parsed = ical.parseICS(response.data)
  const events: Event[] = [];
  for (let key in parsed) {
    let event = parsed[key];

    if (event.type !== 'VEVENT') continue;

    if (event.rrule) {
      if (DateTime.fromJSDate(event.rrule.options.until) < today) continue;
    } else {
      if (DateTime.fromJSDate(event.start) < today) continue;
    }

    let start = DateTime.fromJSDate(event.start);
    const duration = DateTime.fromJSDate(event.end).diff(start);
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
      start = DateTime.fromJSDate(currentDate)
    }

    start = start.set({ second: 0, millisecond: 0 });
    let end = start.plus(duration);
    end = end.set({ second: 0, millisecond: 0 });

    const block_uuid = v5(event.uid, namespace)

    let title = event.summary.replace(/\//g, "|");
    if (renaming[title]) {
      title = renaming[title];
    }

    let meetingMatches = undefined;
    if (event.description) {
      meetingMatches = event.description.match(/(https:\/\/meet\.google\.com\/[\w-]+)/);
    }

    events.push(new Event({
      page: `calendar/${name}`,
      block_uuid: block_uuid,
      state: {
        title: title,
        start: start.toISO(),
        end: end.toISO(),
        ...meetingMatches && { meeting: meetingMatches[1] },
      }
    }));
  }
  return events;
}
