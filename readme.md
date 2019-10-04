# sACN receiver in node.js
[![Build Status](https://github.com/k-yle/sACN/workflows/Build%20and%20Test/badge.svg)](https://github.com/k-yle/sACN/actions)
[![Coverage Status](https://coveralls.io/repos/github/k-yle/sACN/badge.svg?branch=master)](https://coveralls.io/github/k-yle/sACN?branch=master)
[![npm version](https://badge.fury.io/js/sacn.svg)](https://badge.fury.io/js/sacn)
[![npm](https://img.shields.io/npm/dt/sacn.svg)](https://www.npmjs.com/package/sacn)

💡 🎭 This module can receive [DMX](https://en.wikipedia.org/wiki/DMX512) data sent via [sACN](https://en.wikipedia.org/wiki/E1.31) from professional lighting consoles (e.g. [ETC](https://www.etcconnect.com/), [Onyx](https://obsidiancontrol.com/)).

> 🔦 Sending [RDM](https://en.wikipedia.org/wiki/RDM_(lighting)) data to fixtures is not implemented yet, see [issue #1](https://github.com/k-yle/sACN/issues/1).

## Install
```bash
npm install sacn
```

## Usage
```js
const { Receiver, objectify } = require('sacn');

const sACN = new Receiver({
  universes: [1, 2],
  // see table 1 below for all options
});

sACN.on('packet', (packet) => {
  console.log('got dmx data:', objectify(packet.slotsData));
  // see table 2 below for all packet properties
});

sACN.on('PacketCorruption', (err) => {
  // trigged if a corrupted packet is received
});

sACN.on('PacketOutOfOrder', (err) => {
  // trigged if a packet is recieved out of order
});
```

The `objectify` function is a helper that converts the Buffer (e.g. `Buffer<ff 00 ff>`) into a human-readable object (e.g. `{ 1: 100, 2: 0, 3: 100 }`).


### Table 1 - Options
| Name      | Type     | Purpose | Default |
|-----------|----------|---------|---------|
| `universes` | `number[]` | Required. List of universes to listen to. Must be within 0-63999 | `[]` |
| `port` | `number` | Optional. The multicast port to use. All professional consoles broadcast to the default port. | `5568` |
| `iface` | `string` | Optional. If the computer is connected to multiple networks, specify which network adaptor to use by using this computer's local IP address | `null` |
| `reuseAddr` | `boolean` | Optional. Allow multiple programs on your computer to listen to the same sACN universe. | `false` |

### Table 2 - Packet properties
```js
{
  "sourceName": "Onyx", // controller that sent the packet
  "sourceAddress": "192.168.1.69", // ip address of the controller
  "universe": 1, // DMX universe
  "sequence": 172, // packets are numbered 0-255 to keep them in order
  "priority": 100, // 0-200. used if multiple controllers send to the same universe
  "slotsData": Buffer, // a buffer with length 512 containing the values of DMX channels 1-512

  /* there are more low-level properties which most
     users won't need, see the ./src/packet.ts file */
}
```

# Contribute
```bash
npm run build # compile typescript
npm test # run tests
```

# Network Requirements
- [x] Multicast must be enabled. sACN uses port `5568` on `239.255.x.x`
- [x] Network infrastructure that supports at least 100Mbps (100BaseT)


# Protocol Docs
The Architecture for Control Networks (ACN) and derived protocols are created by the Entertainment Services and Technology Association.
 - sACN is defined in [ANSI E1.31](./docs/E1.31-2018.pdf)
 - RDMNet is defined in [ANSI E1.33](./docs/E1.33-2019.pdf)
