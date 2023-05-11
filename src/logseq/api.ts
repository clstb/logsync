import { BlockEntity } from "@logseq/libs/dist/LSPlugin.user";
import { Emitter } from "../events";
import { DateTime } from "luxon";
import diff from "microdiff";

export interface Block {
  block_uuid?: string;

  page(): string;
  marshal(): BlockEntity;
  unmarshal(block: BlockEntity): Block;
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
    logseq.Editor.getPage(block.page()).then((page) => {
      if (page) {
        Emitter.emit("gotPage", block)
      } else {
        Emitter.emit("createPage", block)
      }
    })
  }
  createPage = (block: Block) => {
    logseq.Editor.createPage(block.page(), {}, {
      redirect: false,
      createFirstBlock: false,
    }).then(() => {
      Emitter.emit("createdPage", block)
    })
  }
  getOrCreateBlock = (block: Block) => {
    logseq.Editor.getPageBlocksTree(block.page()).then((localBlocks) => {
      if (!localBlocks || localBlocks.length === 0) {
        Emitter.emit("createBlock", block);
      } else {
        const localBlock = block.unmarshal(localBlocks[0]);
        const diffs = diff(localBlock, block);
        if (diffs.length > 0) {
          console.log(diffs)
          Emitter.emit("gotBlock", block);
        }
      }
    });
  }
  createBlock = (block: Block) => {
    const marshalled = block.marshal();
    logseq.Editor.insertBlock(block.page(), marshalled.content, {
      sibling: true,
      properties: marshalled.properties,
      ...block.block_uuid && { customUUID: block.block_uuid},
    });
  }
  updateBlock = (block: Block) => {
    const marshalled = block.marshal();
    logseq.Editor.updateBlock(block.block_uuid, marshalled.content, {
      properties: marshalled.properties,
    });
  }
}

export function dateToStr(date: DateTime): string {
  const nthNumber = (n: number) => {
    const s = ["th", "st", "nd", "rd"];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  };

  return date.toFormat("LLL ") + nthNumber(date.day) + date.toFormat(", yyyy");
}

