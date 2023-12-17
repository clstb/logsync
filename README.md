# Logsync

Logsync is an opinionated plugin that synchronizes data from various sources into logseq.

## Features

- ICS
    - ![ICS showcase](https://github.com/clstb/logsync/blob/main/gifs/ics.gif)
    - Idemponent synchronization
    - Any number of calendars
    - Recurring events
    - Meeting links (google)
    - Event renaming
- GitHub
    - ![GitHub showcase](https://github.com/clstb/logsync/blob/main/gifs/github.gif)
    - Idemponent synchronization
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
