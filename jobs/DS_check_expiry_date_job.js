import fs from 'fs/promises';
import path from 'path';
import { DateTime } from 'luxon';
import csv from 'csv-parser';
import { createReadStream } from 'fs';
import bot, { CHAT_ID } from '../bot_instance.js';
import { logWarning } from '../shared/utils.js';

/**
 * Сравнивает даты и возвращает сообщение если дата истекает через 2 недели или месяц
 * @param {string} dateStr - дата в формате DD.MM.YYYY
 * @returns {string} - сообщение или пустая строка
 */
function compareDates(dateStr) {
    const today = DateTime.now().startOf('day');
    const inTwoWeeks = today.plus({ days: 14 });
    const nextMonth = today.plus({ months: 1 });
    
    const inTwoWeeksStr = inTwoWeeks.toFormat('dd.MM.yyyy');
    const nextMonthStr = nextMonth.toFormat('dd.MM.yyyy');
    
    const periods = {
        'inTwoWeeks': inTwoWeeksStr,
        'nextMonth': nextMonthStr
    };
    
    const cleanDate = dateStr.trim().substring(0, 10);
    const expiryDate = DateTime.fromFormat(cleanDate, 'dd.MM.yyyy');
    
    if (!expiryDate.isValid) {
        console.warn(`Неверный формат даты: ${dateStr}`);
        logWarning(error.toString());
        return '';
    }
    
    const expiryDateStr = expiryDate.toFormat('dd.MM.yyyy');
    
    for (const [period, periodDate] of Object.entries(periods)) {
        if (expiryDateStr === periodDate) {
            if (period === 'inTwoWeeks') {
                return 'Истекает через 2 недели';
            }
            if (period === 'nextMonth') {
                return 'Истекает через месяц';
            }
        }
    }
    
    return '';
}

/**
 * Читает CSV файл и возвращает массив объектов
 * @param {string} filePath - путь к CSV файлу
 * @returns {Promise<Array>} - массив данных из CSV
 */
async function readCsv(filePath) {
    return new Promise((resolve, reject) => {
        const results = [];
        createReadStream(filePath)
            .pipe(csv({ separator: ';' }))
            .on('data', (data) => results.push(data))
            .on('end', () => resolve(results))
            .on('error', (error) => reject(error));
    });
}

/**
 * Проверяет сроки действия сертификатов
 */
async function checkExpiryDateOfDs() {
    try {
        const csvPath = path.join('./data/ds_info.csv');
        
        try {
            await fs.access(csvPath);
        } catch (error) {
            console.error('CSV файл не найден:', csvPath);
            logWarning(error.toString());
            return;
        }
        
        const rows = await readCsv(csvPath);
        
        const rowsWithDate = rows.filter(row => 
            row['Окончание действия сертификата'] && 
            row['Окончание действия сертификата'].trim() !== ''
        );
        
        const expiredMessages = [];
        
        for (const row of rowsWithDate) {
            const expiryDate = row['Окончание действия сертификата'];
            const result = compareDates(expiryDate);
            
            if (result) {
                expiredMessages.push(
                    `У ${row['ФИО']} из ${row['Подразделение']} сертификат истекает ` +
                    `📅${expiryDate.substring(0, 10)} (${result})`
                );
            }
        }
        
        if (expiredMessages.length > 0) {
            const header = 'ИСТЕКАЮЩИЕ СЕРТИФИКАТЫ 📑:\n\n';
            const textMessage = header + expiredMessages.join('\n');
            
            await bot.api.sendMessageToChat(CHAT_ID, textMessage);
        }
        
    } catch (error) {
        console.error('Ошибка при проверке сертификатов:', error);
        logWarning(error.toString());
    }
}

export { 
    checkExpiryDateOfDs
};