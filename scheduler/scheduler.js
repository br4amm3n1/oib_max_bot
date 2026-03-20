class Scheduler {
    constructor() {
        this.tasks = new Map();
        this.taskId = 0;
    }

    /**
     * Запускает повторяющееся выполнение асинхронной функции
     * @param {Function} asyncFunc - асинхронная функция для выполнения
     * @param {number} intervalSeconds - интервал в секундах между запусками
     * @param {Date|number|string} firstRun - точка отсчета для первого запуска:
     *        - Date объект: конкретная дата и время
     *        - number: количество секунд от текущего момента
     *        - 'now': запустить немедленно
     *        - 'midnight': запустить в следующий полночь
     *        - string в формате 'HH:MM' (например, '09:00'): запустить в указанное время
     * @returns {number} ID задачи для возможности остановки
     */

    runRepeating(asyncFunc, intervalSeconds, firstRun = 'now') {
        if (typeof asyncFunc !== 'function') {
            throw new Error('asyncFunc должен быть функцией');
        }

        if (intervalSeconds <= 0) {
            throw new Error('intervalSeconds должен быть положительным числом');
        }

        const taskId = ++this.taskId;
        const intervalMs = intervalSeconds * 1000;

        const firstRunDelay = this._calculateFirstRunDelay(firstRun);

        console.log(`[Scheduler] Задача ${taskId} запланирована:`);
        console.log(`  - Интервал: ${intervalSeconds} сек`);
        console.log(`  - Первый запуск через: ${firstRunDelay} мс (${new Date(Date.now() + firstRunDelay).toLocaleString()})`);

        const timeoutId = setTimeout(async () => {
            await this._runTask(taskId, asyncFunc);

            const intervalId = setInterval(async () => {
                await this._runTask(taskId, asyncFunc);
            }, intervalMs);

            const task = this.tasks.get(taskId);
            if (task) {
                task.intervalId = intervalId;
                task.timeoutId = null;
            }
        }, firstRunDelay);

        this.tasks.set(taskId, {
            id: taskId,
            asyncFunc,
            intervalSeconds,
            intervalMs,
            firstRun,
            timeoutId,
            intervalId: null,
            lastRun: null,
            nextRun: new Date(Date.now() + firstRunDelay),
            createdAt: new Date()
        });

        return taskId;
    }

    /**
     * Вычисляет задержку до первого запуска
     * @private
     */
    _calculateFirstRunDelay(firstRun) {
        const now = new Date();

        if (typeof firstRun === 'number') {
            return Math.max(0, firstRun * 1000);
        }

        if (firstRun instanceof Date) {
            const delay = firstRun.getTime() - now.getTime();
            return Math.max(0, delay);
        }
        if (typeof firstRun === 'string') {
            if (firstRun === 'now') {
                return 0;
            }

            if (firstRun === 'midnight') {
                const midnight = new Date(now);
                midnight.setHours(24, 0, 0, 0);
                return midnight.getTime() - now.getTime();
            }

            const timeMatch = firstRun.match(/^([0-9]{1,2}):([0-9]{2})$/);
            if (timeMatch) {
                const [_, hours, minutes] = timeMatch;
                const targetTime = new Date(now);
                targetTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);
                
                if (targetTime <= now) {
                    targetTime.setDate(targetTime.getDate() + 1);
                }
                
                return targetTime.getTime() - now.getTime();
            }
        }

        console.warn(`[Scheduler] Неизвестный формат firstRun: ${firstRun}, используется 'now'`);
        return 0;
    }

    /**
     * Запускает задачу и обрабатывает результаты
     * @private
     */
    async _runTask(taskId, asyncFunc) {
        const task = this.tasks.get(taskId);
        if (!task) return;

        const startTime = Date.now();
        console.log(`[Scheduler] Запуск задачи ${taskId} в ${new Date(startTime).toLocaleString()}`);

        try {
            const result = await asyncFunc();
            
            const endTime = Date.now();
            const executionTime = endTime - startTime;
            
            task.lastRun = new Date(startTime);
            task.lastResult = result;
            task.lastError = null;
            task.nextRun = new Date(startTime + task.intervalMs);
            
            console.log(`[Scheduler] Задача ${taskId} выполнена успешно за ${executionTime}мс`);
            console.log(`  - Следующий запуск: ${task.nextRun.toLocaleString()}`);
            
            return result;
        } catch (error) {
            const endTime = Date.now();
            const executionTime = endTime - startTime;
            
            task.lastRun = new Date(startTime);
            task.lastError = error;
            task.nextRun = new Date(startTime + task.intervalMs);
            
            console.error(`[Scheduler] Ошибка в задаче ${taskId} после ${executionTime}мс:`, error.message);
            console.log(`  - Следующий запуск: ${task.nextRun.toLocaleString()}`);
            
            throw error;
        }
    }

    /**
     * Останавливает выполнение задачи
     * @param {number} taskId - ID задачи
     * @returns {boolean} - true если задача была остановлена
     */
    stopTask(taskId) {
        const task = this.tasks.get(taskId);
        if (!task) {
            console.log(`[Scheduler] Задача ${taskId} не найдена`);
            return false;
        }

        if (task.timeoutId) {
            clearTimeout(task.timeoutId);
        }

        if (task.intervalId) {
            clearInterval(task.intervalId);
        }

        this.tasks.delete(taskId);
        console.log(`[Scheduler] Задача ${taskId} остановлена`);
        
        return true;
    }

    /**
     * Останавливает все задачи
     */
    stopAllTasks() {
        console.log(`[Scheduler] Остановка всех задач (${this.tasks.size})...`);
        
        for (const [taskId, task] of this.tasks) {
            this.stopTask(taskId);
        }
        
        this.tasks.clear();
        console.log('[Scheduler] Все задачи остановлены');
    }

    /**
     * Возвращает список всех задач
     * @returns {Array} массив задач
     */
    getTasks() {
        return Array.from(this.tasks.values()).map(task => ({
            id: task.id,
            intervalSeconds: task.intervalSeconds,
            firstRun: task.firstRun,
            lastRun: task.lastRun,
            nextRun: task.nextRun,
            hasError: !!task.lastError,
            lastError: task.lastError ? task.lastError.message : null,
            createdAt: task.createdAt
        }));
    }

    /**
     * Возвращает информацию о конкретной задаче
     * @param {number} taskId - ID задачи
     * @returns {Object|null} информация о задаче
     */
    getTaskInfo(taskId) {
        const task = this.tasks.get(taskId);
        if (!task) return null;

        return {
            id: task.id,
            intervalSeconds: task.intervalSeconds,
            firstRun: task.firstRun,
            lastRun: task.lastRun,
            nextRun: task.nextRun,
            hasError: !!task.lastError,
            lastError: task.lastError ? task.lastError.message : null,
            createdAt: task.createdAt
        };
    }
}

const scheduler = new Scheduler();

export default scheduler;