import BaseDBManager from "./db_manager.js";

class UserDBManager extends BaseDBManager {
    constructor(dbPath = "./data/auth.sqlite3") {
        super(dbPath);
    }

    async checkUserExists(last_name, first_name, patronymic) {
        const sql = `
            SELECT EXISTS(
                SELECT 1 FROM users 
                WHERE last_name = ? 
                    AND first_name = ? 
                    AND patronymic = ?
            ) AS user_exists
        `;
        return await this.exists(sql, [last_name, first_name, patronymic]);
    }

    async verifyUserCode(last_name, first_name, patronymic, code) {
        const sql = `
            SELECT EXISTS(
                SELECT 1 
                FROM users 
                WHERE last_name = ? 
                    AND first_name = ? 
                    AND patronymic = ?
                    AND code = ?
            ) AS code_valid
        `;
        const row = await this.getQueryDB(sql, [last_name, first_name, patronymic, code]);
        return row ? row.code_valid === 1 : false;
    }

    async setDateOfBirth(max_id, date_of_birth) {
        const sql = `
            UPDATE users
            SET date_of_birth = ?
            WHERE max_id = ?
        `;
        return await this.updateWithCheck(sql, [date_of_birth, max_id]);
    }

    async getDateOfBirth(max_id) {
        const sql = `
            SELECT date_of_birth
            FROM users
            WHERE max_id = ?
        `;
        const row = await this.getQueryDB(sql, [max_id]);
        return row ? row.date_of_birth : null;
    }

    async deleteDateOfBirth(max_id) {
        const sql = `
            UPDATE users
            SET date_of_birth = NULL
            WHERE max_id = ?
        `;
        return await this.updateWithCheck(sql, [max_id]);
    }

    async setWorkPosition(max_id, work_position) {
        const sql = `
            UPDATE users
            SET work_position = ?
            WHERE max_id = ?
        `;
        return await this.updateWithCheck(sql, [work_position, max_id]);
    }

    async setMaxIdForUser(code, max_id) {
        const sql = `
            UPDATE users
            SET max_id = ?
            WHERE code = ?
        `;
        return await this.updateWithCheck(sql, [max_id, code]);
    }

    async getUserByMaxId(max_id) {
        const sql = `
            SELECT last_name, first_name, patronymic, work_position, date_of_birth
            FROM users
            WHERE max_id = ?
        `;
        const row = await this.getQueryDB(sql, [max_id]);
        
        if (!row) return null;
        
        return {
            lastName: row.last_name,
            firstName: row.first_name,
            patronymic: row.patronymic,
            workPosition: row.work_position,
            dateOfBirth: row.date_of_birth
        };
    }

    async getAllUsers() {
        const sql = `
            SELECT id, last_name, first_name, patronymic, code, max_id, date_of_birth, work_position 
            FROM users
        `;
        return await this.allQuery(sql);
    }
}

const userDBManager = new UserDBManager();

export default userDBManager;