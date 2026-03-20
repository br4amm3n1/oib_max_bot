import fs from 'fs/promises';
import { DateTime } from 'luxon';

export const camelCase = (str) => {
    return str.replace(/(?:^\w|[A-Z]|\b\w)/g, function (word, index) {
        return index == 0 ? word.toLowerCase() : word.toUpperCase();
    }).replace(/\s+/g, '');
}

export const formatDate = (date) => {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    return `${day}.${month}`;
}

export const formatDateFull = (date) => {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}.${month}.${year}`;
}

export const parseDate = (dateStr) => {
    const [day, month, year] = dateStr.split('.').map(Number);
    return new Date(year, month - 1, day);
}

export const formatDateTimeForDb = (dt) => {
    return dt.toFormat('yyyy-MM-dd HH:mm:ss.SSS');
};

export const fromJson = async (filename) => {
    const data = await fs.readFile(filename, 'utf-8');
    return JSON.parse(data);
};

export const logWarning = (message) => {
    const logPath = './data/logs.log';
    const timestamp = DateTime.now().toFormat('yyyy-MM-dd HH:mm:ss');
    
    const originalPrepareStackTrace = Error.prepareStackTrace;
    Error.prepareStackTrace = (_, stack) => stack;
    
    const error = new Error();
    const stack = error.stack;
    
    Error.prepareStackTrace = originalPrepareStackTrace;
    
    const caller = stack[1];
    
    let fileInfo = '';
    if (caller) {
        const fileName = caller.getFileName();
        const lineNumber = caller.getLineNumber();
        if (fileName) {
            const shortFileName = fileName.split('/').pop();
            fileInfo = `[${shortFileName}:${lineNumber}]`;
        }
    }
    
    fs.appendFile(logPath, `${timestamp} - WARNING: ${fileInfo} ${message}\n`).catch(console.error);
};