# Changelog

## 0.4.0 - 2025-06-5

### Changed

- Dropped Node.js <=18 support.

## 0.3.0 - 2024-02-04

### Changed

- **BREAKING** Upgraded to Axios v1.

## 0.2.1 - 2022-07-22

### Changed

- Updated `README.md`.

## 0.2.0 - 2022-07-21

### Added

- Tests.
- `timeout` support.
- Real cancellation support (Released in `light-my-request@5.2.0`).
- [Documentation](https://segevfiner.github.io/axios-light-my-request-adapter/).

### Changed

- Updated caveats in `README.md`.

### Fixed

- Passing `params` was broken https://github.com/fastify/light-my-request/issues/204.
- Fixed `responseType` handling.
- Handle `maxContentLength`.

## 0.1.0 - 2022-07-10

Initial Release.
