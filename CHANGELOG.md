# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [4.6.1] - 2024-11-02

### Changed

- [#63]: Fix type defintions for `MergingReceiver`'s events

## [4.6.0] - 2024-08-06

### Added

- [#62]: When using `Sender`'s `minRefreshRate`, emit an event when there are network issues

## [4.5.0] - 2024-07-22

### Added

- [#43] [#58]: Experimental support for a Receiver that can merge data from multiple sources
- [#54]: Added option to use raw dmx values
- [#53]: Allow sending data to a specific IP instead of the whole LAN
- [#57]: Export `Sender` props
- Minor performance improvements
- Minor improvements to type defintions and integration tests

## [4.4.0] - 2023-07-22

### Added

- [#52]: Allow sending data to a specific IP address instead of the whole LAN

## [4.3.0] - 2023-02-10

### Added

- [#47]: Allow the network interface to be selected for the Sender class

## [4.2.0] - 2022-03-18

### Added

- Added `defaultPacketOptions` to the sender options

### Changed

- [#38]: Emit fewer PacketOutOfOrder errors

## [4.1.0] - 2021-04-10

### Added

- [#31]: The sender can now re-send data for sACN receivers that require this

## [4.0.0] - 2021-03-31

### Changed

- [#29]: Updated dev dependencies and enabled strictNullChecks in typescript.
- [#29]: 💥 BREAKING TYPEDEF CHANGE: correctly documented the return type of `payloadAsBuffer` as `Buffer | null`, instead of `Buffer`.

## [3.2.1] - 2020-07-19

### Changed

- [#26]: (dependabot) Bump lodash to fix security vulnerability

## [3.2.0] - 2020-06-19

### Added

- [#25]: Return raw buffer if needed

## [3.1.1] - 2020-06-17

### Added

- [#23]: Support passing a callback to `Receiver.close()`

## [3.1.0] - 2020-06-15

### Added

- Created the `Sender` Interface

### Changed

- Return payload as an object, not a buffer (**breaking**)
- Round percentages to 2 decimals places when converting from hex (**potentially breaking**)
- [#19]: Discard received packets sent to the wrong multicast address (**potentially breaking**)

## [0.7.0] - 2019-10-04

Changelog not available for prior versions
