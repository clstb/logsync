# Logsync

## Features

- ICS
    - ![ICS showcase](./gifs/ics.gif)
    - Idempotent synchronization
    - Any number of calendars
    - Recurring events
    - Meeting links (google)
    - Event renaming
- GitHub
    - ![GitHub showcase](./gifs/github.gif)
    - Idempotent synchronization
    - Created pull requests
    - Assigned review requests

## Configuration

`$HOME/.logseq/settings/logsync.json`
```json
{
  "calendars": {
    "some-calendar": "https://some.ics.url/basic.ics"
  },
  "renaming": {
    "some-calendar": {
        "Some event name": "Some new event name"
    }
  },
  "github-token": "ghp_...",
  "disabled": false
}
```
