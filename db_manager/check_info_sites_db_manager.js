import BaseDBManager from "./db_manager.js";

class CheckInfoSitesDbManager extends BaseDBManager {
    constructor(dbPath="./data/check_info_sites.sqlite3") {
        super(dbPath);
    };

    async setCheckInfo(checkResult, text, createTime) {
        const sql_query = `
            INSERT INTO Checks (result, text, create_time) 
            VALUES (?, ?, ?)
        `;

        const { changes, lastID } = await this.runQuery(sql_query, [checkResult, text, createTime]);

        return { changes, lastID };
    };

    async getCheckInfo(time) {
        const sql_query = `
            SELECT * FROM Checks 
            WHERE create_time >= ? AND result = 0
            ORDER BY create_time DESC
            LIMIT 1
        `;

        const row = await this.getQueryDB(sql_query, [time]);

        return row;
    }

}

const checkInfoSitesDbManager = new CheckInfoSitesDbManager();

export default checkInfoSitesDbManager;