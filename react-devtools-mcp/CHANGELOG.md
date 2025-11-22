# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [Unreleased]

### Added
- ARIA selector support for `get_react_component_from_snapshot` tool
  - Uses Puppeteer's ARIA selector syntax (`aria/Name[role="button"]`)
  - Built on browser's native accessibility tree for reliable element finding
  - More robust than manual DOM traversal or text searching
  - Successfully handles headings, images, buttons, and most UI elements
  - Automatically finds DOM elements and extracts React fiber data

### Technical Details
- Implements `page.$('aria/Name[role="button"]')` pattern for element discovery
- Extracts React component information from `__reactFiber$...` keys on DOM elements
- Returns complete component data: name, type, props, state, source location, and owner hierarchy

## [0.1.0] - Initial Release

### Added
- React DevTools backend injection into web pages
- Component tree inspection via MCP tools
- Accessibility tree snapshot for finding UI elements
- Source location tracking using React 19 compatible `data-inspector-*` attributes
- Component highlighting in browser
- Support for multiple React renderers and roots
