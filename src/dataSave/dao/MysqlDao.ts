import {createPool, Pool, PoolConfig, PoolConnection} from "mysql";

export class MysqlDao {

    private pool: Pool;

    constructor(config: PoolConfig | string) {
        this.pool = createPool(config);
    }

    private getConncetion(): Promise<PoolConnection> {
        return new Promise<PoolConnection>((resolve, reject) => {
            this.pool.getConnection((error, connection) => {
               if (error) {
                   reject(error);
               }
               else {
                   resolve(connection);
               }
            });
        });
    }

    protected execute(
        action: (
            connection: PoolConnection,
            actionResolve: (res?: any) => void,
            actionReject: (error: any) => void
        ) => void): Promise<any> {
        let curConnection = null;
        return new Promise<any>((resolve, reject) => {
            this.getConncetion().then(connection => {
                curConnection = connection;
                action(connection, resolve, reject);
            }).catch(error => {
                reject(error);
            })
        }).then(res => {
            if (curConnection != null) {
                this.pool.releaseConnection(curConnection);
            }
            return res;
        }).catch(error => {
            if (curConnection != null) {
                this.pool.releaseConnection(curConnection);
            }
            throw error;
        });
    }

    insert(table: string, data: any, ignoreDup: boolean = true) {
        return this.execute((connection, actionResolve, actionReject) => {
            connection.query("INSERT INTO " + table + " SET ?", data, (err, results, fields) => {
                if (err) {
                    if (ignoreDup) {
                        actionResolve({
                            affectedRows: 0,
                            changedRows: 0
                        });
                    }
                    else {
                        actionReject(err);
                    }
                }
                else {
                    actionResolve(results);
                }
            });
        });
    }

}
