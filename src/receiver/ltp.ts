import { DMXUniverse } from '../data/universe';
import { PreparedData } from '../data/merging';
import { AbstractMergingReceiver } from './abstract';

export class LTPMergingReceiver extends AbstractMergingReceiver {
  // eslint-disable-next-line class-methods-use-this
  protected mergeData(data: PreparedData): DMXUniverse | null {
    const { referenceData } = data.universeData;
    const mergedData = new DMXUniverse();

    for (let ch = 0; ch < 512; ch += 1) {
      let referenceTime = 0;
      mergedData.data[ch] = referenceData.data[ch] || 0;

      for (const [, tmp] of data.universeData.servers) {
        if (tmp.lastUpdate > referenceTime) {
          referenceTime = tmp.lastUpdate;
          mergedData.data[ch] =
            tmp.data.data[ch] || (mergedData.data[ch] as number);
        }
      }
    }

    return mergedData;
  }
}
