import { Block } from '../logseq/api';
import { BlockEntity } from '@logseq/libs/dist/LSPlugin.user';
import { AgileClient, AgileModels } from "jira.js";

export class Board implements Block {
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

function parseBoard(v: AgileModels.Board): Board {
  return new Board({
    page: `jira/board/${v.id}`,

    id: v.id,
    ...v.name && { name: v.name },
  })
}

export async function fetchBoards(client: AgileClient): Promise<Board[]> {
  const response = await client.board.getAllBoards();
  return response.values.map(parseBoard)
}

