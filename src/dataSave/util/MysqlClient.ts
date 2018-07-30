import * as mysql from "mysql";
import {Pool, PoolConfig, PoolConnection} from "mysql";

export class MysqlClient {

    private pool: Pool;

    constructor(config: PoolConfig | string) {
        this.pool = mysql.createPool(config);
    }

    private async getConnection() {
        return await new Promise<PoolConnection>(resolve => {
           this.pool.getConnection((err, connection) => {
              if (err) console.warn("get connection fail: " + JSON.stringify(err, null, 4));
              resolve(connection);
           });
        });
    }

    async insert(table: string, data: any) {
        const connection = await this.getConnection();
        return await new Promise<any>(resolve => {
            connection.query("INSERT INTO " + table + " SET ?", data, (err, results, fields) => {
                this.pool.releaseConnection(connection);
                resolve(err || results);
            });
        });
    }

    async countById(table: string, id: any) {
        const connection = await this.getConnection();
        return await new Promise<any>(resolve => {
            connection.query("SELECT COUNT(*) FROM " + table + " WHERE id = ?", id, (err, results, fields) => {
                this.pool.releaseConnection(connection);
                resolve(err || results[0]["COUNT(*)"]);
            });
        });
    }

}
