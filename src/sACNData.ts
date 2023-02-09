export class SACNData {
  data: number[] = new Array(512);

  constructor(recordData: Record<number, number> = {}) {
    this.data.fill(0);
    for (const addr in recordData) {
      this.data[+addr - 1] = recordData[+addr] ?? 0;
    }
  }
}
