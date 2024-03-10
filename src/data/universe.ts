export class DMXUniverse {
  readonly data: number[] = new Array(512);

  constructor(recordData: Record<number, number> = {}) {
    // init universe using `0` for every channel
    this.data.fill(0);

    // set provided values
    for (const addr in recordData) {
      this.data[+addr - 1] = recordData[+addr] ?? 0;
    }
  }
}
