import * as Nedb from "nedb";
import {NedbModel} from "./NedbModel";
import {Pager} from "./Pager";

export class NedbDao<T extends NedbModel> {

    protected nedb: Nedb;

    private actionCount = 0;

    private compactRateForSave = 10000;

    constructor() {
        const dbFile = __dirname + "/" + this.constructor.name + ".db";
        this.nedb = new Nedb({
            filename: dbFile,
            autoload: true,
            onload: error => {
                if (error) {
                    throw new Error("nedb load fial: " + dbFile);
                }
                else {
                    this.compact();
                }
            }
        });
    }

    /**
     * 对 nedb 的数据进行压缩整理，这个源于nedb的数据存储方式
     * 数据更新都是 append 操作，删除是增加一个 delete记录，更新数据是增加一个 update记录，这些记录都会添加到持久化文件末尾
     * compat之后，会将最新的数据记录保存到持久化文件中，delete/update记录就不会存在了，从而达到压缩体积的目的
     * 系统启动时否认会压缩一次数据
     */
    private compact() {
        this.nedb.persistence.compactDatafile();
    }

    /**
     * 记录更新操作的次数，达到一定次数，执行compact操作
     * @param {number} actionNum
     */
    private afterAction(actionNum: number = 1) {
        this.actionCount += actionNum;
        if (this.actionCount >= this.compactRateForSave) {
            this.compact();
            this.actionCount = 0;
        }
    }

    /**
     * 将查询语句中的regex string转换为Regex对象实例，因为nedb的$regex操作只接受 Regex对象实例
     * @param query
     * @returns {any}
     */
    private castRegexInMatch(query: any) {
        if (query == null) return query;
        if (query instanceof Array) {
            for (let i = 0, len = query.length; i < len; i++) {
                query[i] = this.castRegexInMatch(query[i]);
            }
        }
        else if (typeof query == "object") {
            for (let key of Object.keys(query)) {
                if (key == "$regex") {
                    query[key] = new RegExp(query[key]);
                }
                else query[key] = this.castRegexInMatch(query[key]);
            }
        }
        return query;
    }

    private ifErrorRejectElseResolve(err: Error | any, reject: any, resolve?: any, res?: any) {
        if (err && err.constructor == Error) {
            reject(err);
        }
        else if (resolve) {
            resolve(res);
        }
    };

    save(item: T, justUpdate: boolean = false): Promise<boolean> {
        return new Promise<boolean>((resolve, reject) => {
            item.updateTime = new Date().getTime();
            if (!justUpdate) {
                this.nedb.insert(item, (err: any) => {
                    if (err) {
                        if (err.errorType == "uniqueViolated") {
                            this.nedb.update({_id: item._id}, item, {}, err1 => {
                                this.ifErrorRejectElseResolve(err1, reject, resolve, true);
                                this.afterAction();
                            });
                        }
                        else {
                            reject(err);
                        }
                    }
                    else {
                        resolve(true);
                        this.afterAction();
                    }
                });
            }
            else {
                this.nedb.update({_id: item._id}, item, {}, err1 => {
                    this.ifErrorRejectElseResolve(err1, reject, resolve, true);
                    this.afterAction();
                });
            }
        });
    }

    private find(query: any, projection: any, justOne: boolean, sort?: { by: string; order: -1 | 1 }): Promise<any> {
        return new Promise<any>((resolve, reject) => {
            if (!projection) {
                projection = {};
            }
            if (justOne) {
                this.nedb.findOne(query, projection, (error, doc) => {
                    this.ifErrorRejectElseResolve(error, reject, resolve, doc);
                });
            }
            else {
                const cursor = this.nedb.find(query, projection);
                if (sort && sort.by && sort.order != null) {
                    const _sort: any = {};
                    _sort[sort.by] = sort.order;
                    cursor.sort(_sort);
                }
                cursor.exec((error, docs) => {
                    this.ifErrorRejectElseResolve(error, reject, resolve, docs);
                });
            }
        });
    }

    findById(_id: string, projection?: any): Promise<T> {
        return this.find({_id: _id}, projection, true);
    }

    findOne(query: any, projection?: any): Promise<T> {
        return this.find(query, projection, true);
    }

    findList(query: any, projection?: any, sort?: { by: string; order: -1 | 1 }): Promise<T[]>  {
        return this.find(query, projection, false, sort);
    }

    count(query: any): Promise<number> {
        return new Promise<number>((resolve, reject) => {
            this.nedb.count(query, (error, num) => {
                this.ifErrorRejectElseResolve(error, reject, resolve, num);
            });
        });
    }

    remove(query: any, multi: boolean = true): Promise<number> {
        return new Promise<number>((resolve, reject) => {
            this.nedb.remove(query,  {
                multi: multi
            },(error, num) => {
                this.ifErrorRejectElseResolve(error, reject, resolve, num);
            });
        });
    }

    update(query: any, updateQuery: any, options?: Nedb.UpdateOptions): Promise<number> {
        return new Promise<number>((resolve, reject) => {
            this.nedb.update(query, updateQuery, options || {},(error, num) => {
                this.ifErrorRejectElseResolve(error, reject, resolve, num);
            });
        });
    }

    page(pager: Pager<T>): Promise<Pager<T>> {
        return new Promise<any>(async (resolve, reject) => {
            const match = this.castRegexInMatch(pager.match || {});

            const total = await new Promise<any>(resolve1 => {
                this.nedb.count(match, (err, n) => {
                    resolve1(err || n);
                });
            });
            this.ifErrorRejectElseResolve(total, resolve);

            let pageSize = pager.pageSize || 10;
            let pageIndex = Math.min(pager.pageIndex || 0, parseInt("" + (total - 1) / 10));
            const list = await new Promise<any>(resolve1 => {
                const cursor = this.nedb.find(match, pager.projection || {});
                if (pager.sort && pager.sort.by && pager.sort.order != null) {
                    const sort: any = {};
                    sort[pager.sort.by] = pager.sort.order;
                    cursor.sort(sort);
                }
                cursor .skip(pageIndex * pageSize)
                    .limit(pageSize)
                    .exec( (err, docs) => {
                        resolve1(err || docs);
                    });
            });
            this.ifErrorRejectElseResolve(list, reject);

            pager.pageIndex = pageIndex;
            pager.total = total;
            pager.list = list;
            resolve(pager);
        });
    }

}