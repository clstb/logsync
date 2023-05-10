import { BlockEntity } from "@logseq/libs/dist/LSPlugin.user";
import { Emitter } from "../events";

export interface Block {
  page: string;
  block_uuid?: string;

  marshal(): BlockEntity;
  unmarshal(block: BlockEntity): void;
}

export class Logseq {
  register = () => {
    Emitter.on("upsertBlockWithPage", this.getOrCreatePage)
    Emitter.on("getOrCreatePage", this.getOrCreatePage);
    Emitter.on("createPage", this.createPage);
    Emitter.on("getOrCreateBlock", this.getOrCreateBlock);
    Emitter.on("createBlock", this.createBlock);
    Emitter.on("updateBlock", this.updateBlock);
  }
  getOrCreatePage = (block: Block) => {
    logseq.Editor.getPage(block.page).then((page) => {
      if (page) {
        Emitter.emit("gotPage", block)
      } else {
        Emitter.emit("createPage", block)
      }
    })
  }
  createPage = (block: Block) => {
    logseq.Editor.createPage(block.page).then(() => {
      Emitter.emit("createdPage", block)
    })
  }
  getOrCreateBlock = (block: Block) => {
    logseq.Editor.getPageBlocksTree(block.page).then((logBlocks) => {
      if (!logBlocks || logBlocks.length === 0) {
        Emitter.emit("createBlock", block);
      } else {
        block.block_uuid = logBlocks[0].uuid;
        Emitter.emit("gotBlock", block);
      }
    });
  }
  createBlock = (block: Block) => {
    const marshalled = block.marshal();
    logseq.Editor.insertBlock(block.page, marshalled.content, {
      sibling: true,
      properties: marshalled.properties,
    }).finally(logseq.Editor.exitEditingMode);
  }
  updateBlock = (block: Block) => {
    const marshalled = block.marshal();
    logseq.Editor.updateBlock(block.block_uuid, marshalled.content, {
      properties: marshalled.properties,
    }).finally(logseq.Editor.exitEditingMode);
  }
}
