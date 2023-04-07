import { BlockUUID } from "@logseq/libs/dist/LSPlugin.user";

export interface Block {
  page: string;
  block_uuid: BlockUUID;
  state: Record<string, any>;


  content(): string;
  properties(): Record<string, string>;
}

export async function read(block: Block): Promise<[Block, boolean]> {
  const blockEntity = await logseq.Editor.getBlock(block.block_uuid)
  if (!blockEntity) {
    return [block, false]
  }

  for (let key in block.state) {
    block.state[key] = blockEntity.properties[`.${key}`]
  }
  return [block, true]
}

export async function write(blocks: Block[]) {
  const pages = [...new Set(blocks.map(b => b.page))];

  let pageMap = {};
  for (let page of pages) {
    let pageEntity = await logseq.Editor.getPage(page);
    if (!pageEntity) {
      pageEntity = await logseq.Editor.createPage(page, {}, {
        redirect: false,
        createFirstBlock: false,
        journal: false,
      });
    }
    pageMap[page] = pageEntity;
  }

  for (let block of blocks) {
    let properties = block.properties();
    for (let key in block.state) {
      properties[`.${key}`] = block.state[key]
    }

    const blockEntity = await logseq.Editor.getBlock(block.block_uuid);
    if (blockEntity) {
      await logseq.Editor.updateBlock(block.block_uuid, block.content(), {
        properties: properties
      });
    } else {
      let page = pageMap[block.page];
      await logseq.Editor.insertBlock(page.uuid, block.content(), {
        customUUID: block.block_uuid,
        properties: properties
      });
    }
  }
}
