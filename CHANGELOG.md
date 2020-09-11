# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
