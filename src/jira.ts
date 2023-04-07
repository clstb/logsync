import { AgileClient } from "jira.js"

async function jiraBoards(client: AgileClient) {
  const boards = await client.board.getAllBoards()
  console.log(boards)
}

export class Jira {
  client = null
  constructor(host: string, email: string, token: string) {
    this.client = new AgileClient({
      host: host,
      authentication: {
        basic: {
          email: email,
          apiToken: token,
        },
      },
    })
  }
  sync = async function() {
    await jiraBoards(this.client)
  }
}
