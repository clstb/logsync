import {BlockUUID} from '@logseq/libs/dist/LSPlugin.user';

export interface Block {
  page: string;
  blockUUID: BlockUUID;
  state: Record<string, unknown>;

  content(): string;
  properties(): Record<string, string>;
}

export async function read(block: Block): Promise<[Block, boolean]> {
  const blockEntity = await logseq.Editor.getBlock(block.blockUUID);
  if (!blockEntity) {
    return [block, false];
  }

  for (const key in block.state) {
    block.state[key] = blockEntity.properties[`.${key}`];
  }
  return [block, true];
}

export async function write(blocks: Block[]) {
  const pages = [...new Set(blocks.map(b => b.page))];

  const pageMap = {};
  for (const page of pages) {
    let pageEntity = await logseq.Editor.getPage(page);
    if (!pageEntity) {
      pageEntity = await logseq.Editor.createPage(
        page,
        {},
        {
          redirect: false,
          createFirstBlock: false,
          journal: false,
        }
      );
    }
    pageMap[page] = pageEntity;
  }

  for (const block of blocks) {
    const properties = block.properties();
    for (const key in block.state) {
      properties[`.${key}`] = block.state[key];
    }

    const blockEntity = await logseq.Editor.getBlock(block.blockUUID);
    if (blockEntity) {
      await logseq.Editor.updateBlock(block.blockUUID, block.content(), {
        properties: properties,
      });
    } else {
      const page = pageMap[block.page];
      await logseq.Editor.insertBlock(page.uuid, block.content(), {
        customUUID: block.blockUUID,
        properties: properties,
      });
    }
  }
}
