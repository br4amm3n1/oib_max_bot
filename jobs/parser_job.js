import { DateTime } from 'luxon';
import axios from 'axios';
import * as cheerio from 'cheerio';
import UserAgent from 'fake-useragent';
import checkInfoSitesDbManager from '../db_manager/check_info_sites_db_manager.js';
import bot, { CHAT_ID } from '../bot_instance.js';
import { formatDateTimeForDb, fromJson, logWarning } from '../shared/utils.js';


const getRandomUserAgent = () => {
    const ua = new UserAgent();
    return ua.random;
};

async function checkSites() {
    const urls = await fromJson('./data/urls.json');
    const failedChecks = [];
    
    const checkPromises = Object.entries(urls).map(async ([name, siteData]) => {
        const url = siteData.url;
        
        try {
            const headers = {
                'Accept': 'text/html',
                'User-Agent': getRandomUserAgent()
            };

            const response = await axios.get(url, { 
                headers,
                httpsAgent: new (await import('https')).Agent({ rejectUnauthorized: false })
            });

            const html = response.data;
            const $ = cheerio.load(html);
            
            const selector = siteData['css-selector'][0];
            const expectedValue = siteData['css-selector'][1];
            
            const elements = $(selector);
            
            if (elements.length === 0 || elements.first().toString() !== expectedValue) {
                return `(${url}) -> Элемент не найден;`;
            }
            
            return null;
            
        } catch (error) {
            if (error.response) {
                const statusCode = error.response.status;
                const statusText = error.response.statusText || 'Unknown';
                return `${url} -> HTTP ${statusCode} (${statusText}): ${error.message};`;
            } else if (error.code) {
                let errorDescription = error.message;
                
                switch(error.code) {
                    case 'ECONNREFUSED':
                        errorDescription = 'Соединение отклонено (порт закрыт или сервер не отвечает)';
                        break;
                    case 'ENOTFOUND':
                        errorDescription = 'DNS имя не найдено (сайт не существует)';
                        break;
                    case 'ETIMEDOUT':
                        errorDescription = 'Таймаут соединения (сервер не отвечает)';
                        break;
                    case 'ECONNABORTED':
                        errorDescription = 'Соединение прервано';
                        break;
                    case 'CERT_HAS_EXPIRED':
                    case 'DEPTH_ZERO_SELF_SIGNED_CERT':
                        errorDescription = 'Проблема с SSL сертификатом';
                        break;
                }
                
                return `(${url}) -> [${error.code}] ${errorDescription};`;
            } else {
                return `(${url}) -> Неизвестная ошибка: ${error.message};`;
            }
        }
    });
    
    const results = await Promise.all(checkPromises);
    
    for (const result of results) {
        if (result !== null) {
            failedChecks.push(result);
        }
    }
    
    const timeNow = DateTime.now();
    let text = '';
    let checkResult = true;
    
    if (failedChecks.length === 0) {
        text = 'Веб-ресурсы успешно прошли проверки';
    } else {
        checkResult = false;
        text = failedChecks.join('');
    }
    
    try {
        await checkInfoSitesDbManager.connect();
        await checkInfoSitesDbManager.setCheckInfo(checkResult ? 1 : 0, text, timeNow.toFormat('yyyy-MM-dd HH:mm:ss'));
        await sendNotificationsForSitesChecking();
    } catch (error) {
        logWarning(error.toString());
    } finally {
        if (checkInfoSitesDbManager.db) {
            checkInfoSitesDbManager.close();
        }
    }
}

async function sendNotificationsForSitesChecking() {
    const timeDayAgo = DateTime.now().minus({ hours: 4 });
    const timeForDb = formatDateTimeForDb(timeDayAgo);
    
    let queryResult;

    await new Promise(resolve => setTimeout(resolve, 10000));

    try {
        queryResult = await checkInfoSitesDbManager.getCheckInfo(timeForDb);
    } catch (error) {
        logWarning(error.toString());
    }

    if (queryResult) {
        const timeOfCheck = queryResult.create_time;
        const timeOfCheckStr = timeOfCheck.toString();

        const prepCheckResult = queryResult.text.split(';').filter(item => item.length > 0);
        let checkResultStr = `Проверка ${timeOfCheckStr}: ❌\n`;

        prepCheckResult.forEach((result, index) => {
            checkResultStr += `${index + 1}. ${result}\n`;
        });

        const text = `${checkResultStr}`;

        await bot.api.sendMessageToChat(CHAT_ID, text, {format: "markdown"});
    }
}

export { 
    checkSites, 
    sendNotificationsForSitesChecking, 
    fromJson 
};