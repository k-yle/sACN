import { AbstractMergingReceiver } from './abstract';
import { PreparedData } from '../data/merging';
import { DMXUniverse } from '../data/universe';

export class HTPMergingReceiver extends AbstractMergingReceiver {
  // eslint-disable-next-line class-methods-use-this
  protected mergeData(data: PreparedData): DMXUniverse | null {
    const mergedData = new DMXUniverse();

    for (const [, tmp] of data.universeData.servers) {
      if (
        tmp.priority === data.maximumPriority &&
        tmp.universe === data.universe
      ) {
        for (let ch = 0; ch < 512; ch += 1) {
          const newValue = tmp.data.data[ch] || 0;
          if ((mergedData.data[ch] ?? 0) < newValue) {
            mergedData.data[ch] = newValue;
          }
        }
      }
    }

    return mergedData;
  }
}
