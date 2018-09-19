import {NedbModel} from "ppspider/lib/common/nedb/NedbDao";

export class GithubRepository extends NedbModel {

    watching: number;

    starred: number;

    forked: number;

    issues: number;

    pullRequests: number;

    about: string;

    url: string;

    tags: string[];

    isSpider: boolean;

    commits: number;

    branches: number;

    releases: number;

    contributors: number;

    license: string;

    isChinese: boolean;

}