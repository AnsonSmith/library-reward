# LibraryReward Development Guidelines

Auto-generated from all feature plans. Last updated: 2026-08-31

## Active Technologies

- TypeScript 5.x targeting ES2020, compiled to a single bundle + React 19 + Vite (build only); `fflate` for ZIP decompression; browser-native `DOMParser` for OOXML. No runtime network dependencies, no CDN, no web fonts, no spreadsheet library. (001-weekly-prize-drawing)

## Project Structure

```text
backend/
frontend/
tests/
```

## Commands

npm test && npm run lint

## Code Style

TypeScript 5.x targeting ES2020, compiled to a single bundle: Follow standard conventions

## Recent Changes

- 002-monthly-prize-drawing: Drawings are monthly, not weekly. One roster plus any number of that month's weekly circulation reports are imported together; a student overdue in ANY of them sits out the month. A drawing period is the calendar month (`src/domain/monthKey.ts`); `WinRecord.monthKey` replaced `weekKey`, and backup format v2 migrates v1 files by each win's drawn-on date.
- 001-weekly-prize-drawing: Added TypeScript 5.x targeting ES2020, compiled to a single bundle + React 19 + Vite (build only); `fflate` for ZIP decompression; browser-native `DOMParser` for OOXML. No runtime network dependencies, no CDN, no web fonts, no spreadsheet library.

<!-- MANUAL ADDITIONS START -->
<!-- MANUAL ADDITIONS END -->
