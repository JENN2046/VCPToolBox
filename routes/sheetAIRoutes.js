const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const ExcelJS = require('exceljs');

function createWorkbookId() {
    return `wb_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function createSheetId(index = 1) {
    return `sheet_${index}`;
}

async function ensureDir(dirPath) {
    await fs.mkdir(dirPath, { recursive: true });
}

async function pathExists(targetPath) {
    try {
        await fs.access(targetPath);
        return true;
    } catch {
        return false;
    }
}

async function readJson(targetPath) {
    const raw = await fs.readFile(targetPath, 'utf8');
    return JSON.parse(raw);
}

async function writeJson(targetPath, payload) {
    await fs.writeFile(targetPath, JSON.stringify(payload, null, 2), 'utf8');
}

function sanitizeCellRef(cellRef) {
    return String(cellRef || '').trim().toUpperCase();
}

function isValidCellRef(cellRef) {
    return /^[A-Z]+[1-9]\d*$/.test(cellRef);
}

module.exports = function createSheetAIRoutes() {
    const router = express.Router();
    const sheetRoot = process.env.SHEETAI_ROOT_PATH || path.join(process.cwd(), 'sheetai');
    const workbookRoot = path.join(sheetRoot, 'workbooks');

    function getWorkbookDir(workbookId) {
        return path.join(workbookRoot, workbookId);
    }

    function getWorkbookFile(workbookId) {
        return path.join(getWorkbookDir(workbookId), 'workbook.json');
    }

    function getSheetFile(workbookId, sheetId) {
        return path.join(getWorkbookDir(workbookId), 'sheets', `${sheetId}.json`);
    }

    async function readWorkbook(workbookId) {
        const workbookFile = getWorkbookFile(workbookId);
        if (!(await pathExists(workbookFile))) {
            const error = new Error(`Workbook not found: ${workbookId}`);
            error.statusCode = 404;
            throw error;
        }
        return readJson(workbookFile);
    }

    async function writeWorkbook(workbook) {
        await ensureDir(path.dirname(getWorkbookFile(workbook.id)));
        await writeJson(getWorkbookFile(workbook.id), workbook);
    }

    async function readSheet(workbookId, sheetId) {
        const sheetFile = getSheetFile(workbookId, sheetId);
        if (!(await pathExists(sheetFile))) {
            const error = new Error(`Sheet not found: ${sheetId}`);
            error.statusCode = 404;
            throw error;
        }
        return readJson(sheetFile);
    }

    async function writeSheet(workbookId, sheet) {
        await ensureDir(path.dirname(getSheetFile(workbookId, sheet.id)));
        await writeJson(getSheetFile(workbookId, sheet.id), sheet);
    }

    router.get('/health', async (_req, res) => {
        await ensureDir(workbookRoot);
        res.json({
            ok: true,
            module: 'sheetai',
            version: 'mvp-grid-editing',
            root: sheetRoot
        });
    });

    router.get('/workbooks', async (_req, res, next) => {
        try {
            await ensureDir(workbookRoot);
            const entries = await fs.readdir(workbookRoot, { withFileTypes: true });
            const workbooks = [];

            for (const entry of entries) {
                if (!entry.isDirectory()) {
                    continue;
                }

                const workbookPath = getWorkbookFile(entry.name);
                if (!(await pathExists(workbookPath))) {
                    continue;
                }

                try {
                    workbooks.push(await readJson(workbookPath));
                } catch (error) {
                    workbooks.push({
                        id: entry.name,
                        title: entry.name,
                        status: 'invalid',
                        error: error.message
                    });
                }
            }

            workbooks.sort((a, b) => {
                const aTime = new Date(a.updatedAt || a.createdAt || 0).getTime();
                const bTime = new Date(b.updatedAt || b.createdAt || 0).getTime();
                return bTime - aTime;
            });

            res.json({ workbooks });
        } catch (error) {
            next(error);
        }
    });

    router.post('/workbooks', async (req, res, next) => {
        try {
            const title = typeof req.body?.title === 'string' && req.body.title.trim()
                ? req.body.title.trim()
                : 'Untitled Workbook';

            const workbookId = createWorkbookId();
            const defaultSheetId = createSheetId(1);
            const now = new Date().toISOString();

            const workbook = {
                id: workbookId,
                title,
                createdAt: now,
                updatedAt: now,
                sheets: [
                    {
                        id: defaultSheetId,
                        name: 'Sheet1',
                        rowCount: 100,
                        columnCount: 26
                    }
                ]
            };

            const defaultSheet = {
                id: defaultSheetId,
                name: 'Sheet1',
                cells: {},
                rowCount: 100,
                columnCount: 26
            };

            await writeWorkbook(workbook);
            await writeSheet(workbookId, defaultSheet);

            res.status(201).json({ workbook });
        } catch (error) {
            next(error);
        }
    });

    router.get('/workbooks/:id', async (req, res, next) => {
        try {
            const workbook = await readWorkbook(req.params.id);
            res.json({ workbook });
        } catch (error) {
            next(error);
        }
    });

    router.put('/workbooks/:id', async (req, res, next) => {
        try {
            const workbook = await readWorkbook(req.params.id);
            const title = typeof req.body?.title === 'string' ? req.body.title.trim() : '';

            if (title) {
                workbook.title = title;
            }

            workbook.updatedAt = new Date().toISOString();
            await writeWorkbook(workbook);
            res.json({ workbook });
        } catch (error) {
            next(error);
        }
    });

    router.get('/workbooks/:id/sheets/:sheetId', async (req, res, next) => {
        try {
            const workbook = await readWorkbook(req.params.id);
            const sheetMeta = workbook.sheets.find((sheet) => sheet.id === req.params.sheetId);
            if (!sheetMeta) {
                return res.status(404).json({ error: `Sheet not found: ${req.params.sheetId}` });
            }

            const sheet = await readSheet(req.params.id, req.params.sheetId);
            res.json({ workbook, sheet });
        } catch (error) {
            next(error);
        }
    });

    router.post('/workbooks/:id/sheets', async (req, res, next) => {
        try {
            const workbook = await readWorkbook(req.params.id);
            const nextIndex = Array.isArray(workbook.sheets) ? workbook.sheets.length + 1 : 1;
            const sheetId = createSheetId(nextIndex);
            const sheetName = typeof req.body?.name === 'string' && req.body.name.trim()
                ? req.body.name.trim()
                : `Sheet${nextIndex}`;
            const rowCount = Number.isFinite(Number(req.body?.rowCount)) ? Math.max(10, Math.floor(Number(req.body.rowCount))) : 100;
            const columnCount = Number.isFinite(Number(req.body?.columnCount)) ? Math.max(5, Math.floor(Number(req.body.columnCount))) : 26;

            const sheetMeta = {
                id: sheetId,
                name: sheetName,
                rowCount,
                columnCount
            };

            const sheet = {
                ...sheetMeta,
                cells: {}
            };

            workbook.sheets = Array.isArray(workbook.sheets) ? workbook.sheets : [];
            workbook.sheets.push(sheetMeta);
            workbook.updatedAt = new Date().toISOString();

            await writeSheet(req.params.id, sheet);
            await writeWorkbook(workbook);

            res.status(201).json({ workbook, sheet });
        } catch (error) {
            next(error);
        }
    });

    router.post('/workbooks/:id/sheets/:sheetId/import/xlsx', async (req, res, next) => {
        try {
            const workbook = await readWorkbook(req.params.id);
            const sheetIndex = workbook.sheets.findIndex((sheet) => sheet.id === req.params.sheetId);
            if (sheetIndex === -1) {
                return res.status(404).json({ error: `Sheet not found: ${req.params.sheetId}` });
            }

            const contentBase64 = typeof req.body?.contentBase64 === 'string' ? req.body.contentBase64 : '';
            if (!contentBase64) {
                return res.status(400).json({ error: 'contentBase64 is required' });
            }

            const excelBuffer = Buffer.from(contentBase64, 'base64');
            const excelWorkbook = new ExcelJS.Workbook();
            await excelWorkbook.xlsx.load(excelBuffer);
            const worksheet = excelWorkbook.worksheets[0];

            if (!worksheet) {
                return res.status(400).json({ error: 'No worksheet found in xlsx file' });
            }

            const sheet = await readSheet(req.params.id, req.params.sheetId);
            sheet.cells = {};

            let maxRow = 0;
            let maxColumn = 0;

            worksheet.eachRow((row, rowNumber) => {
                maxRow = Math.max(maxRow, rowNumber);
                row.eachCell({ includeEmpty: true }, (cell, columnNumber) => {
                    maxColumn = Math.max(maxColumn, columnNumber);
                    const cellText = cell.text || '';
                    if (!cellText) {
                        return;
                    }
                    const cellRef = `${columnNumberToLabel(columnNumber)}${rowNumber}`;
                    sheet.cells[cellRef] = {
                        value: cellText
                    };
                });
            });

            sheet.rowCount = Math.max(maxRow, 10);
            sheet.columnCount = Math.max(maxColumn, 5);
            sheet.name = worksheet.name || sheet.name;

            workbook.sheets[sheetIndex] = {
                ...workbook.sheets[sheetIndex],
                name: sheet.name,
                rowCount: sheet.rowCount,
                columnCount: sheet.columnCount
            };
            workbook.updatedAt = new Date().toISOString();

            await writeSheet(req.params.id, sheet);
            await writeWorkbook(workbook);

            res.json({ workbook, sheet });
        } catch (error) {
            next(error);
        }
    });

    router.get('/workbooks/:id/sheets/:sheetId/export/xlsx', async (req, res, next) => {
        try {
            const workbook = await readWorkbook(req.params.id);
            const sheetMeta = workbook.sheets.find((sheet) => sheet.id === req.params.sheetId);
            if (!sheetMeta) {
                return res.status(404).json({ error: `Sheet not found: ${req.params.sheetId}` });
            }

            const sheet = await readSheet(req.params.id, req.params.sheetId);
            const excelWorkbook = new ExcelJS.Workbook();
            const worksheet = excelWorkbook.addWorksheet(sheet.name || sheetMeta.name || 'Sheet1');

            Object.entries(sheet.cells || {}).forEach(([cellRef, cellValue]) => {
                worksheet.getCell(cellRef).value = cellValue?.value || '';
            });

            const xlsxBuffer = await excelWorkbook.xlsx.writeBuffer();
            const fileName = `${(workbook.title || 'sheetai-workbook').replace(/[\\/:*?"<>|]+/g, '_')}-${(sheet.name || 'Sheet1').replace(/[\\/:*?"<>|]+/g, '_')}.xlsx`;

            res.json({
                filename: fileName,
                contentBase64: Buffer.from(xlsxBuffer).toString('base64')
            });
        } catch (error) {
            next(error);
        }
    });

    router.put('/workbooks/:id/sheets/:sheetId/cells', async (req, res, next) => {
        try {
            const workbook = await readWorkbook(req.params.id);
            const sheetIndex = workbook.sheets.findIndex((sheet) => sheet.id === req.params.sheetId);
            if (sheetIndex === -1) {
                return res.status(404).json({ error: `Sheet not found: ${req.params.sheetId}` });
            }

            const sheet = await readSheet(req.params.id, req.params.sheetId);
            const updates = Array.isArray(req.body?.updates) ? req.body.updates : [];

            for (const update of updates) {
                const cellRef = sanitizeCellRef(update?.cell);
                if (!isValidCellRef(cellRef)) {
                    continue;
                }

                const rawValue = update?.value;
                const value = rawValue === null || rawValue === undefined ? '' : String(rawValue);

                if (value === '') {
                    delete sheet.cells[cellRef];
                } else {
                    sheet.cells[cellRef] = {
                        value
                    };
                }
            }

            const rowCount = Number(req.body?.rowCount);
            const columnCount = Number(req.body?.columnCount);

            if (Number.isFinite(rowCount) && rowCount > 0) {
                sheet.rowCount = Math.max(10, Math.floor(rowCount));
            }
            if (Number.isFinite(columnCount) && columnCount > 0) {
                sheet.columnCount = Math.max(5, Math.floor(columnCount));
            }

            workbook.sheets[sheetIndex] = {
                ...workbook.sheets[sheetIndex],
                rowCount: sheet.rowCount,
                columnCount: sheet.columnCount
            };
            workbook.updatedAt = new Date().toISOString();

            await writeSheet(req.params.id, sheet);
            await writeWorkbook(workbook);

            res.json({
                workbook,
                sheet,
                updatedCells: updates.length
            });
        } catch (error) {
            next(error);
        }
    });

    router.use((error, _req, res, _next) => {
        const statusCode = error.statusCode || 500;
        res.status(statusCode).json({
            error: error.message || 'SheetAI route error'
        });
    });

    return router;
};

function columnNumberToLabel(index) {
    let value = index;
    let label = '';
    while (value > 0) {
        const remainder = (value - 1) % 26;
        label = String.fromCharCode(65 + remainder) + label;
        value = Math.floor((value - 1) / 26);
    }
    return label;
}
