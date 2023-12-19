import {Block} from './logseq';
import {BlockUUID, BlockEntity} from '@logseq/libs/dist/LSPlugin.user';

export const ReviewState = {
  id: '',
  state: '',
  prState: '',
  login: '',
  created: '',
  updated: '',
};

export class Review implements Block {
  constructor(obj: Record<string, unknown>) {
    Object.assign(this, obj);
    const state = obj.state ? obj.state : {};
    this.state = state as typeof ReviewState;
  }

  page: string;
  blockUUID: BlockUUID;
  state: typeof ReviewState;

  content(): string {
    let [prefix, suffix] = ['TODO ', ''];
    switch (this.state.state) {
      case 'APPROVED':
        prefix = 'DONE ';
        break;
      case 'CHANGES_REQUESTED':
        suffix = ' ⭕';
        break;
      case 'REQUESTED':
        suffix = ' 🔸';
        break;
      case 'COMMENTED':
        suffix = ' 💬';
        break;
    }

    if (this.state.prState !== 'OPEN') {
      prefix = 'DONE ';
    }

    return `${prefix}[[github/${this.state.login}]]${suffix}`;
  }
  properties(): Record<string, string> {
    return {};
  }
  async read(blockEntity: BlockEntity | null): Promise<void> {
    if (!blockEntity) {
      blockEntity = await logseq.Editor.getBlock(this.blockUUID);
    }
    Object.keys(ReviewState).map(key => {
      if (!blockEntity?.properties[`.${key}`]) return;
      this.state[key] = blockEntity.properties[`.${key}`];
    });
  }
}
