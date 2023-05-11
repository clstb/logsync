import { Block } from '../logseq/api';
import { BlockEntity } from '@logseq/libs/dist/LSPlugin.user';
import { AgileClient, AgileModels } from "jira.js";

export class Board implements Block {
  constructor(obj){
    Object.assign(this, obj)
  }

  block_uuid?: string;

  id: number;
  name: string;

  page(): string {
    return `jira/board/${this.id}`
  }
  marshal(): BlockEntity {
    const content = this.name;
    const properties = {
      ".id": this.id,
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
  unmarshal(block: BlockEntity): Block {
    this.block_uuid = block.uuid;
    return new Board({
      block_uuid: block.uuid,
      id: block.properties[".id"],
      name: block.properties[".name"],
    })
  }
}

function parseBoard(v: AgileModels.Board): Board {
  return new Board({
    id: v.id,
    ...v.name && { name: v.name },
  })
}

export async function fetchBoards(client: AgileClient): Promise<Board[]> {
  const response = await client.board.getAllBoards();
  return response.values.map(parseBoard)
}

