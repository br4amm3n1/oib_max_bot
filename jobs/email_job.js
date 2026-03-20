import Imap from "imap";
import { simpleParser } from "mailparser";
import bot, { IMAP_SERVER, CHAT_ID, LOGIN, PASSWORD } from "../bot_instance.js";
import { logWarning } from "../shared/utils.js";


export const checkEmailJob = async () => {
    const mailCatalogs = ['INBOX', 'INBOX/check_minzdrav'];
    
    for (const catalog of mailCatalogs) {
        const imapConfig = {
            user: LOGIN,
            password: PASSWORD,
            host: IMAP_SERVER,
            port: 993,
            tls: true,
            tlsOptions: { rejectUnauthorized: false }
        };

        const imapConnection = new Imap(imapConfig);

        await new Promise((resolve, reject) => {
            imapConnection.once('ready', () => {
                imapConnection.openBox(catalog, false, (err, box) => {
                    if (err) {
                        console.error('Ошибка открытия папки:', err);
                        logWarning(err.toString());
                        imapConnection.end();
                        reject(err);
                        return;
                    }

                    imapConnection.search(['UNSEEN'], (err, results) => {
                        if (err) {
                            console.error('Ошибка поиска:', err);
                            imapConnection.end();
                            reject(err);
                            return;
                        }

                        if (results.length === 0) {
                            console.log('Непрочитанных сообщений нет');
                            imapConnection.end();
                            resolve();
                            return;
                        }

                        const fetch = imapConnection.fetch(results, { bodies: '' });

                        fetch.on('message', (msg, seqno) => {
                            msg.on('body', (stream, info) => {
                                simpleParser(stream, async (err, parsed) => {
                                    if (err) {
                                        console.error('Ошибка парсинга письма:', err);
                                        return;
                                    }

                                    const messageText = `НОВОЕ ПИСЬМО:\n\n\nОт: ${parsed.from.text}\nТема: ${parsed.subject}\nДата: ${parsed.date}\n\n${parsed.text}`;
                                    
                                    try {
                                        await bot.api.sendMessageToChat(CHAT_ID, messageText);
                                        console.log('Сообщение отправлено.');
                                    } catch (error) {
                                        console.error('Ошибка отправки:', error);
                                        logWarning(error.toString());
                                    }
                                });
                            });

                            // msg.once('attributes', (attrs) => {
                            //     console.log('Атрибуты сообщения:', attrs);
                            // });
                        });

                        fetch.once('error', (err) => {
                            console.error('Ошибка fetch:', err);
                            logWarning(err.toString());
                            imapConnection.end();
                            reject(err);
                        });

                        fetch.once('end', () => {
                            console.log('Завершена выборка сообщений');
                            imapConnection.end();
                            resolve();
                        });
                    });
                });
            });

            imapConnection.once('error', (err) => {
                console.error('Ошибка IMAP подключения:', err);
                logWarning(err.toString());
                reject(err);
            });

            imapConnection.once('end', () => {
                console.log('Соединение IMAP закрыто');
            });

            imapConnection.connect();
        });
    }
}