
export class Pager<T> {

    pageIndex: number = 0;

    pageSize: number = 10;

    match: any = {};

    projection: any;

    sort: {
      by: string;
      order: number;
    };

    total: number;

    list: T[];

}