import { fetchEvents } from "./event"
import { Emitter } from "../events"

export class ICS {
  calendars: Record<string, string>;
  constructor(calendars: Record<string, string>){
    this.calendars = calendars;
  }
  register = () => {
    Emitter.on("fetchCalendars", this.fetchCalendars);
    Emitter.on("fetchEvents", this.fetchEvents);
  }
  fetchCalendars = () => {
    for (let calendar in this.calendars) {
      const url = this.calendars[calendar];
      Emitter.emit("fetchEvents", [calendar, url])
    }
  }
  fetchEvents = (event: [string, string]) => {
    const [calendar, url] = event;
    fetchEvents(calendar, url).then((events) => {
      events.map((event) => {
        Emitter.emit("fetchedEvent", event)
      })
    })
  }
}
