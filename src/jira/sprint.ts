import { Block } from '../logseq/api';
import { BlockEntity } from '@logseq/libs/dist/LSPlugin.user';
import { AgileClient, AgileModels } from "jira.js";
import { AgileParameters } from "jira.js"

export class Sprint implements Block {
  constructor(obj){
    Object.assign(this, obj)
  }

  page: string;
  block_uuid?: string;

  id: number;
  name: string = "";

  marshal(): BlockEntity {
    const content = this.name;
    const properties = {
      ".name": this.name,
    }
    const block = {
      content: content,
      properties: properties,
    } as Partial<BlockEntity>;
    if (this.block_uuid) {
      block.uuid = this.block_uuid
    }
    return block as BlockEntity;
  }
  unmarshal(block: BlockEntity) {
    this.name = block.properties[".name"];
  }
}

function parseSprint(v: AgileModels.Sprint): Sprint {
  return new Sprint({
    page: `jira/sprint/${v.id}`,

    id: v.id,
    ...v.name && { name: v.name },
  })
}

export async function fetchSprints(client: AgileClient, parameters: AgileParameters.GetAllSprints): Promise<Sprint[]> {
  const response = await client.board.getAllSprints(parameters);
  return response.values.map(parseSprint)
}
