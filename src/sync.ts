import { BlockEntity, PageEntity } from "@logseq/libs/dist/LSPlugin.user";
import diff from "microdiff";

export interface SyncBlock {
  id: string;
  namespace: string;
  synced: string;
  block_uuid?: string;

  marshal(): BlockEntity;
  unmarshal(block: BlockEntity): void;
}

export function dateToStr(date: Date): string {
  const nthNumber = (n: number) => {
    const s = ["th", "st", "nd", "rd"];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  };

  return `${date.toLocaleString("default", { month: "short" })} ${nthNumber(date.getDate())}, ${date.getFullYear()}`;
}

async function upsertBlockPage(block: SyncBlock): Promise<void> {
  const pageName = `${block.namespace}/${block.id}`;
  let page = await logseq.Editor.getPage(pageName);
  if (!page) {
    page = await logseq.Editor.createPage(pageName, {}, {
      createFirstBlock: false,
    });
  }
  block.synced = dateToStr(new Date());
  const marshalled = block.marshal();
  await logseq.Editor.prependBlockInPage(pageName, marshalled.content, { properties: marshalled.properties });
}

async function updateBlock<T extends SyncBlock>(block: T): Promise<void> {
  block.synced = dateToStr(new Date());
  const marshalled = block.marshal();
  await logseq.Editor.updateBlock(marshalled.uuid, marshalled.content, { properties: marshalled.properties });
}

async function loadBlocks<T extends SyncBlock>(ctor: { new(): T }, namespace: string): Promise<Record<string, T>> {
  const page = await logseq.Editor.getPage(namespace);
  if (!page) {
    return {}
  }

  const pages = await logseq.Editor.getPagesFromNamespace(namespace)
  const syncBlocks = {} as Record<string, T>;
  for (const page of pages) {
    const blocks = await logseq.Editor.getPageBlocksTree(page.name)
    for (const block of blocks) {
      let syncBlock = new ctor();
      syncBlock.unmarshal(block);
      syncBlocks[syncBlock.id] = syncBlock;
    }
  }
  return syncBlocks;
}

export function marshal(block: SyncBlock): BlockEntity {
  const marshalled = {
    properties: {},
  } as BlockEntity;
  marshalled.properties[".id"] = block.id;
  marshalled.properties[".namespace"] = block.namespace;
  marshalled.properties["synced"] = block.synced;
  if (block.block_uuid) {
    marshalled.uuid = block.block_uuid;
  }
  return marshalled;
}

export function unmarshal<T extends SyncBlock>(block: BlockEntity, instance: T) {
  instance.id = String(block.properties[".id"]);
  instance.namespace = block.properties[".namespace"];
  instance.synced = block.properties["synced"];
  instance.block_uuid = block.uuid;
}

export interface Fetcher {
  fetch<BlockType extends SyncBlock>(namespace: string, opts): Promise<Record<string, BlockType>>;
}

export async function sync<T extends SyncBlock>(ctor: { new(): T }, namespace: string, fetcher: Fetcher, prune: boolean = false, opts = {}): Promise<string[]> {
  const local = await loadBlocks<T>(ctor, namespace);
  const remote = await fetcher.fetch<T>(namespace, opts).catch((e) => {
    console.error(e);
    return [];
  });

  const toInsert = {} as Record<string, T>;
  const toUpdate = {} as Record<string, T>;
  const toDelete = {} as Record<string, T>;
  const toKeep = {} as Record<string, T>;

  for (const id in local) {
    if (id in remote) {
      const localBlock = local[id];
      const remoteBlock = remote[id];
      remoteBlock.block_uuid = localBlock.block_uuid;
      remoteBlock.synced = localBlock.synced;
      const diffs = diff(localBlock, remoteBlock);
      if (diffs.length > 0) {
        toUpdate[id] = remoteBlock;
      } else {
        toKeep[id] = remoteBlock;
      }
    } else {
      toDelete[id] = local[id];
    }
  }
  for (const id in remote) {
    if (!(id in local)) {
      toInsert[id] = remote[id];
    }
  }

  for (const id in toInsert) {
    await upsertBlockPage(toInsert[id]);
  }
  for (const id in toUpdate) {
    await updateBlock(toUpdate[id]);
  }
  if (prune) {
    for (const id in toDelete) {
      await logseq.Editor.deleteBlock(toDelete[id].block_uuid);
    }
  }

  const ids = Object.keys(toInsert).concat(Object.keys(toUpdate)).concat(Object.keys(toKeep));
  return ids;
}
