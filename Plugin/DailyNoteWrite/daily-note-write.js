const { writeDiary } = require('./writer-core');

const DEBUG_MODE = (process.env.DebugMode || 'false').toLowerCase() === 'true';

function debugLog(message, ...args) {
    if (DEBUG_MODE) {
        console.error(`[DailyNoteWrite][Debug] ${message}`, ...args);
    }
}

function sendOutput(data) {
    try {
        const jsonString = JSON.stringify(data);
        process.stdout.write(jsonString);
        debugLog('Sent output to stdout:', jsonString);
    } catch (error) {
        console.error('[DailyNoteWrite] Error stringifying output:', error);
        process.stdout.write(JSON.stringify({ status: 'error', message: 'Internal error: Failed to stringify output.' }));
    }
}

async function main() {
    let inputData = '';
    process.stdin.setEncoding('utf8');

    process.stdin.on('readable', () => {
        let chunk;
        while ((chunk = process.stdin.read()) !== null) {
            inputData += chunk;
        }
    });

    process.stdin.on('end', async () => {
        try {
            if (!inputData) {
                throw new Error('No input data received via stdin.');
            }

            const diaryData = JSON.parse(inputData);
            const { maidName, dateString, contentText } = diaryData;
            const fileName = diaryData.fileName || diaryData.FileName;
            const writeResult = await writeDiary(maidName, dateString, contentText, fileName);

            sendOutput({
                status: 'success',
                message: `Diary saved to ${writeResult.filePath}`,
                result: writeResult
            });
        } catch (error) {
            console.error('[DailyNoteWrite] Error processing request:', error.message);
            sendOutput({ status: 'error', message: error.message || 'An unknown error occurred.' });
            process.exitCode = 1;
        }
    });

    process.stdin.on('error', (error) => {
        console.error('[DailyNoteWrite] Stdin error:', error);
        sendOutput({ status: 'error', message: 'Error reading input.' });
        process.exitCode = 1;
    });
}

main();
