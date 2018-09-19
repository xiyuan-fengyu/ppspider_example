import {NedbModel} from "ppspider";

export class GithubUser extends NedbModel {

    name: string;

    area: string;

    email: string;

    url: string;

    repositories: string[];

    stars: string[];

    // 是否对爬虫感兴趣
    spiderInterested: boolean;

    // 是否使用中文
    useChinese: boolean;

}
