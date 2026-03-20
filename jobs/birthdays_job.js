import { userSessions, STEPS_SUBSCRIPTION, BUTTON_ACTIONS } from "../bot.js"
import { formatDate, formatDateFull, parseDate } from "../shared/utils.js";
import userDBManager from "../db_manager/users_db_manager.js";
import bot from "../bot_instance.js";
import { logWarning } from "../shared/utils.js";

export const subscribeBtn = async (ctx) => {
    const userId = ctx.user.user_id;
    let [dateOfBirth, textMessage] = ["", ""];

    if (ctx.authorizationContext?.isAuthorized || false) {
        try {
            await userDBManager.connect();
            dateOfBirth = await userDBManager.getDateOfBirth(userId);

        } catch (err) {
            console.log(err.message);

        } finally {
            if (userDBManager.db) {
                userDBManager.close();
            };
        }

        if (dateOfBirth) {
            textMessage = "Вы уже подписаны.";
        } else {
            userSessions.delete(userId);

            userSessions.set(userId, {
                step: STEPS_SUBSCRIPTION.AWAITING_WORK_POSITION,
                action: BUTTON_ACTIONS.SUBSCRIBE,
                data: {},
            })
            
            textMessage = "Введите свою должность в отделе ИБ:";
        }

        return ctx.answerOnCallback({
            message: {
            text: textMessage,
            attachments: [],
            },
        });
        
    } else {
        return ctx.answerOnCallback({
            message: {
            text: "Вы не авторизованы.",
            attachments: [],
            },
        });
    }
    
};

export const unsubscribeBtn = async (ctx) => {
    const userId = ctx.user.user_id;
    let textMessage = "";

    if (ctx.authorizationContext?.isAuthorized || false) {
        try {
            await userDBManager.connect();

            const dateOfBirth = await userDBManager.getDateOfBirth(userId);

            if (dateOfBirth) {
                await userDBManager.deleteDateOfBirth(userId);

                userSessions.delete(userId);

                textMessage = "Вы успешно отписались от уведомлений.";

            } else {
                textMessage = "Вы не подписаны на уведомления."
            };

            return ctx.answerOnCallback({
                message: {
                text: textMessage,
                attachments: [],
                },
            });

        } catch (err) {
            console.error(err.message);

        } finally {
            if (userDBManager.db) {
                userDBManager.close();
            }
        }

    } else {
        return ctx.answerOnCallback({
            message: {
            text: "Вы не авторизованы.",
            attachments: [],
            },
        });
    }
    
};

export function compareDates(userData) {
    const today = new Date();
    const nextWeek = new Date(today);
    nextWeek.setDate(today.getDate() + 7);

    const todayStr = formatDate(today);
    const nextWeekStr = formatDate(nextWeek);

    const periods = {
        todayStr: todayStr,
        nextWeekStr: nextWeekStr,
    };

    const birthdayDate = parseDate(userData.dateOfBirth);
    const birthdayStr = formatDate(birthdayDate);

    for (const [name, period] of Object.entries(periods)) {
        if (birthdayStr === period) {
            if (name === "todayStr") {
                return `Сегодня день рождения у ${userData.firstName} ${userData.lastName} (${userData.workPosition})! 🎉`;
            }
            if (name === "nextWeekStr") {
                return `Через неделю (${formatDateFull(birthdayDate)}) день рождения у ${userData.firstName} ${userData.lastName} (${userData.workPosition})! 🎉`;
            }
        }
    }

    return "";
}

export const checkBirthdays = async () => {   
    try {
        await userDBManager.connect();
        const users = await userDBManager.getAllUsers();

        for (const user of users) {
            if (user.date_of_birth) {
                const userData = {
                    maxId: user.max_id,
                    lastName: user.last_name,
                    firstName: user.first_name,
                    patronymic: user.patronymic,
                    dateOfBirth: user.date_of_birth,
                    workPosition: user.work_position,
                }

                const text = compareDates(userData)

                if (text.length > 0) {
                    for (const otherUser of users) {
                        if (otherUser.date_of_birth && otherUser.max_id !== userData.maxId) {
                            try {
                                await bot.api.sendMessageToUser(otherUser.max_id, text);
                                await new Promise(resolve => setTimeout(resolve, 100));

                            } catch (error) {
                                console.error(error.message);
                                logWarning(error.toString());
                            }
                            
                        };
                    };
                };
            } 
        };

    } catch (err) {
        console.error(err);
        logWarning(error.toString());

    } finally {
        if (userDBManager.db) {
            userDBManager.close();
        };
    }
}
