import { Block } from "./logseq";
import { BlockUUID } from "@logseq/libs/dist/LSPlugin.user";
import axios from "axios";
import ical from "node-ical";
import { DateTime } from "luxon";
import { v5 } from "uuid";

const namespace = "dd13a47c-c074-4ef9-9676-66792035d4be"

class EventState {
  title: string;
  date: string;
  meeting?: string;
}

function formatDate(date: string) {
  const parsed = DateTime.fromISO(date);
  // Format date to <2023-04-13 Thu 09:00>
  const day = parsed.toFormat("ccc");
  const time = parsed.toFormat("HH:mm");
  return `<${parsed.toFormat("yyyy-MM-dd")} ${day} ${time}>`;
}

export class Event implements Block {
  constructor(obj: Record<string,any>) {
    Object.assign(this, obj)
  }

  page: string;
  block_uuid: BlockUUID;
  state: EventState;

  content(): string {
    const dateString = formatDate(this.state.date);
    return `[[${this.state.title}]]\nSCHEDULED: ${dateString}`;
  };
  properties(): Record<string, string> {
    return {
      ...this.state.meeting && {"meeting": this.state.meeting},
    }
  };
  async read(): Promise<boolean> {
    const block = await logseq.Editor.getBlock(this.block_uuid)
    if (!block) {
      return false
    }
    for (let key in this.state) {
      this.state[key] = block.properties[`.${key}`]
    }
    return true
  }
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

    const block_uuid = v5(event.uid, namespace)

    let title = event.summary.replace(/\//g, "|");
    if (renaming[title]) {
      title = renaming[title];
    }

    let meetingMatches = undefined;
    if (event.description) {
      meetingMatches = event.description.match(/(https:\/\/meet\.google\.com\/[\w-]+)/);
    }

    date = date.set({ second: 0, millisecond: 0 });

    events.push(new Event({
      page: `calendar/${name}`,
      block_uuid: block_uuid,
      state: {
        title: title,
        date: date.toISO(),
        ...meetingMatches && { meeting: meetingMatches[1] },
      }
    }));
  }
  return events;
}
