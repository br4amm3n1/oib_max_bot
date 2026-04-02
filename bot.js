import { Keyboard } from '@maxhub/max-bot-api';
import bot from './bot_instance.js';
import { subscribeBtn, unsubscribeBtn, checkBirthdays } from './jobs/birthdays_job.js';
import { checkEmailJob } from './jobs/email_job.js';
import { checkSites, sendNotificationsForSitesChecking } from './jobs/parser_job.js';
import userDBManager from './db_manager/users_db_manager.js';
import { camelCase } from './shared/utils.js'
import scheduler from './scheduler/scheduler.js';
import { checkExpiryDateOfDs } from './jobs/DS_check_expiry_date_job.js';


scheduler.runRepeating(checkBirthdays, 86400, '09:00');
scheduler.runRepeating(checkEmailJob, 86400, '07:05');
scheduler.runRepeating(checkSites, 14400, 14400);
// scheduler.runRepeating(sendNotificationsForSitesChecking, 14520, 45);
scheduler.runRepeating(checkExpiryDateOfDs, 86400, '09:00');

const authorizedUsers = new Set();

bot.use(async (ctx, next) => {
    const userId = ctx?.user?.user_id;

    ctx.authorizationContext = {
        isAuthorized: authorizedUsers.has(userId),
    };

    await next();
});

export const userSessions = new Map();

export const BUTTON_ACTIONS = {
    SUBSCRIBE: "subscribe",
    AUTHORIZE: "authorize",
};

export const STEPS_SUBSCRIPTION = {
    AWAITING_WORK_POSITION: "awating_work_position",
    AWAITING_DATE_OF_BIRTH: "awaiting_date_of_birth",
};

export const STEPS_AUTHORIZATION = {
    AWAITING_PATRONYMIC: "awating_patronymic",
    AWAITING_CODE: "awaiting_code",
};

const getMainMenuKeyboard = (ctx) => {
    const isAuthorized = ctx.authorizationContext?.isAuthorized || false;

    const buttons = isAuthorized 
    ? [
        [
            Keyboard.button.callback('Подписаться на уведомления о днях рождений', 'subscribeBtn'),
        ],
        [
            Keyboard.button.callback('Отписаться от уведомлений', 'unsubscribeBtn'),
        ],
      ] 
    : [
        [
            Keyboard.button.callback('Пройти авторизацию', 'authorizeBtn'),
        ], 
      ];

    return Keyboard.inlineKeyboard(buttons);
}


bot.api.setMyCommands([
  { 
    name: 'start',
    description: 'Открыть меню бота'
  },
]);

bot.on('bot_started', async (ctx) => {
  return ctx.reply("Привет.\n\nЧтобы взаимодействовать со мной, откройте меню, нажав на кнопку « ⍁ », находящуюся справа от поля ввода текста.");
});

bot.command('start', (ctx) => {
    return ctx.reply('Выберите действие:', {attachments: [getMainMenuKeyboard(ctx)]});
});

bot.action("authorizeBtn", (ctx) => {
    const userId = ctx?.user?.user_id;

    userSessions.set(userId, {
        step: STEPS_AUTHORIZATION.AWAITING_PATRONYMIC,
        action: BUTTON_ACTIONS.AUTHORIZE,
        data: {},
    })

    return ctx.answerOnCallback({
        message: {
        text: "Введите свое отчество: ",
        attachments: [],
        },
    });
});

bot.action("subscribeBtn", subscribeBtn);
bot.action("unsubscribeBtn", unsubscribeBtn);

bot.on('message_created', async (ctx) => {
    const userId = ctx.user.user_id;
    const userSession = userSessions.get(userId);
    const messageText = ctx.message.body.text;

    if (!userSession) {
        return;
    }

    if (userSession.action === BUTTON_ACTIONS.SUBSCRIBE) {
        switch (userSession.step) {
            case STEPS_SUBSCRIPTION.AWAITING_WORK_POSITION:
                userSession.data.workPosition = messageText;
                userSession.step = STEPS_SUBSCRIPTION.AWAITING_DATE_OF_BIRTH;

                try {
                    await userDBManager.connect();
                    
                    await userDBManager.setWorkPosition(userId, userSession.data.workPosition);

                } catch (error) {
                    console.error("Произошла ошибка.", error.message);

                } finally {
                    if (userDBManager.db) {
                        await userDBManager.close();
                    };
                }
                
                await ctx.reply("Введите свою дату рождения:");

                break;

            case STEPS_SUBSCRIPTION.AWAITING_DATE_OF_BIRTH:
                userSession.data.dateOfBirth = messageText;
                let user;

                try {
                    await userDBManager.connect();
                    user = await userDBManager.getUserByMaxId(userId);
                    await userDBManager.setDateOfBirth(userId, userSession.data.dateOfBirth);

                } catch (error) {
                    console.error("Произошла ошибка.", error.message);

                } finally {
                    if (userDBManager.db) {
                        await userDBManager.close();
                    };
                }

                if (user) {
                    await ctx.reply(
                        `<b>Ваше ФИО:</b> ${user.lastName} ${user.firstName} ${user.patronymic}.\n` +
                        `<b>Ваша должность:</b> ${user.workPosition}.\n` +
                        `<b>Дата рождения:</b> ${userSession.data.dateOfBirth}.`,
                        {format: "html"}
                    )

                    await ctx.reply(
                        "<b>Вы успешно подписаны на уведомления о днях рождений коллег!</b>",
                        {format: "html"}
                    );
                } else {
                    await ctx.reply(
                        "Произошла непредвиденная ошибка. Попробуйте подписаться еще раз."
                    );
                };
                
                break;

            default:
                userSessions.delete(userId);
                await ctx.reply("Произошла ошибка. Пожалуйста, начните заново.");
        }
    } else if (userSession.action === BUTTON_ACTIONS.AUTHORIZE) {
        switch (userSession.step) {
            case STEPS_AUTHORIZATION.AWAITING_PATRONYMIC:
                userSession.data.patronymic = messageText;
                let isExists = false;

                try {
                    await userDBManager.connect();

                    isExists = await userDBManager.checkUserExists(
                        camelCase(ctx?.user?.last_name), 
                        camelCase(ctx?.user?.first_name), 
                        camelCase(userSession.data.patronymic)
                    );

                } catch (error) {
                    console.error(error.message);

                } finally {
                    if (userDBManager.db) {
                        await userDBManager.close();
                    }
                }

                if (isExists) {
                    userSession.step = STEPS_AUTHORIZATION.AWAITING_CODE;

                    await ctx.reply("Введите код, полученный от Администратора: ");
                } else {
                    userSessions.delete(userId);

                    await ctx.reply("У вас нет доступа.");
                }
                
                break;

            case STEPS_AUTHORIZATION.AWAITING_CODE:
                userSession.data.code = messageText;
                let codeIsValid = false;

                try {
                    await userDBManager.connect();

                    codeIsValid = await userDBManager.verifyUserCode(
                        camelCase(ctx?.user?.last_name), 
                        camelCase(ctx?.user?.first_name), 
                        camelCase(userSession.data.patronymic),
                        userSession.data.code,
                    );

                    if (codeIsValid) await userDBManager.setMaxIdForUser(userSession.data.code, userId);

                } catch (error) {
                    console.error(error.message);
                } finally {
                    if (userDBManager.db) {
                        await userDBManager.close();
                    };
                }

                if (codeIsValid) {
                    userSessions.delete(userId);

                    authorizedUsers.add(userId);
                    
                    await ctx.reply(
                        "<b>Вы успешно авторизованы!</b>\n\nОткройте меню для взаимодействия с ботом.",
                        {format: "html"}
                    );

                } else {
                    await ctx.reply("Введен неправильный код. Повторите ввод: ");
                };

                break;

            default:
                userSessions.delete(userId);
                await ctx.reply("Произошла ошибка. Пожалуйста, начните заново.");
        };
    
    }
});

bot.start();
