# VCP SheetAI MVP

## Goal

Build a focused spreadsheet tool for VCP that targets "AI-enhanced daily spreadsheet work" instead of full Excel parity.

The first release should optimize for:

- lightweight workbook management
- tabular editing for small and medium datasets
- AI-assisted formula generation and data cleanup
- CSV/XLSX import and export
- smooth integration with existing VCP chat, note, and knowledge workflows

## Product Positioning

VCP SheetAI is not a full Excel replacement in phase 1.

Phase 1 aims to cover:

- personal and team data tables
- operational ledgers
- lightweight reports
- AI-assisted summary and transformation

Phase 1 explicitly does not aim to cover:

- VBA or macro compatibility
- pivot-table parity
- advanced charting parity
- complex workbook-level formula graphs
- high-fidelity Excel layout compatibility

## MVP Scope

### Core UI

- workbook list
- worksheet tabs
- spreadsheet grid
- formula bar
- basic toolbar
- right-side AI panel

### Editing

- edit cell values
- insert and delete rows/columns
- rename sheets
- resize columns
- sort and simple filter
- freeze first row and first column

### Formula Support

- `SUM`
- `AVERAGE`
- `COUNT`
- `MAX`
- `MIN`
- `IF`
- `ROUND`
- `CONCAT`

### AI Actions

- natural-language to formula
- explain formula
- clean column values
- classify rows
- summarize table
- generate report from selected range

### File Support

- import `csv`
- import `xlsx`
- export `csv`
- export `xlsx`

## Architecture

### Frontend

Repo: `VCPChat`

- new module folder: `Sheetmodules/`
- separate Electron child window, same pattern as Notes
- renderer responsibilities:
  - workbook shell
  - grid rendering
  - local interaction state
  - AI side panel

### Backend

Repo: `VCPToolBox`

- new admin route group: `/admin_api/sheetai/*`
- responsibilities:
  - workbook metadata
  - workbook persistence
  - import/export orchestration
  - AI task endpoints

### Storage

Phase 1 storage format:

- workbook metadata in JSON
- worksheet cell payloads in JSON
- imported/exported files handled as conversion boundaries

Suggested structure:

```text
sheetai/
  workbooks/
    <workbook-id>/
      workbook.json
      sheets/
        sheet-1.json
        sheet-2.json
```

## API Draft

### Readiness

- `GET /admin_api/sheetai/health`

### Workbook list

- `GET /admin_api/sheetai/workbooks`
- `POST /admin_api/sheetai/workbooks`

### Workbook detail

- `GET /admin_api/sheetai/workbooks/:id`
- `PUT /admin_api/sheetai/workbooks/:id`
- `DELETE /admin_api/sheetai/workbooks/:id`

### Sheet operations

- `POST /admin_api/sheetai/workbooks/:id/sheets`
- `PUT /admin_api/sheetai/workbooks/:id/sheets/:sheetId`
- `PUT /admin_api/sheetai/workbooks/:id/sheets/:sheetId/cells`

### AI operations

- `POST /admin_api/sheetai/ai/formula`
- `POST /admin_api/sheetai/ai/clean`
- `POST /admin_api/sheetai/ai/summarize`

## Build Order

1. workbook CRUD
2. child window shell in `VCPChat`
3. grid component with local JSON persistence
4. import/export
5. AI actions
6. advanced formulas and charts

## Success Criteria

The MVP is successful if a user can:

- create a workbook
- edit a few hundred rows smoothly
- import a CSV file
- ask AI to generate a formula
- ask AI to summarize a table
- export the workbook back to CSV or XLSX
