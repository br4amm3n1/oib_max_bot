import sqlite3 from 'sqlite3';


const verbose = sqlite3.verbose();

class BaseDBManager {
    constructor(dbPath = "./data/auth.sqlite3") {
        this.dbPath = dbPath;
        this.db = null;
    }

    connect() {
        return new Promise((resolve, reject) => {
            this.db = new verbose.Database(this.dbPath, (err) => {
                if (err) {
                    console.error("Ошибка открытия базы: ", err.message, this.dbPath);
                    reject(err);
                } else {
                    console.log('Подключение к базе данных установлено.');
                    resolve(this.db);
                }
            });
        });
    }

    close() {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                resolve();
                return;
            }

            this.db.close((err) => {
                if (err) {
                    console.error("Ошибка закрытия базы: ", err.message);
                    reject(err);
                } else {
                    console.log('Соединение с базой закрыто.');
                    this.db = null;
                    resolve();
                }
            });
        });
    }

    runQuery(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.run(sql, params, function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve({ changes: this.changes, lastID: this.lastID });
                }
            });
        });
    }

    getQueryDB(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.get(sql, params, (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(row);
                }
            });
        });
    }

    allQuery(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.all(sql, params, (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }

    async exists(sql, params = []) {
        const row = await this.getQueryDB(sql, params);
        return row ? row.user_exists === 1 : false;
    }

    async updateWithCheck(sql, params = []) {
        const result = await this.runQuery(sql, params);
        if (result.changes === 0) {
            console.log("Запись не найдена для обновления.");
            return false;
        }
        return true;
    }
}

export default BaseDBManager;
