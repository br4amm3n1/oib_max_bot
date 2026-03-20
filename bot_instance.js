import { Bot } from '@maxhub/max-bot-api';
import dotenv from 'dotenv';

dotenv.config();

const token = process.env.BOT_TOKEN;
if (!token) throw new Error('Токен не подходит');

export const CHAT_ID = process.env.CHAT_ID;
export const IMAP_SERVER = process.env.IMAP_SERVER;
export const LOGIN = process.env.LOGIN;
export const PASSWORD = process.env.PASSWORD;

const bot = new Bot(token);

export default bot;