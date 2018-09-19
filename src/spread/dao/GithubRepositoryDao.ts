import {GithubRepository} from "../model/GithubRepository";
import {NedbDao} from "ppspider/lib/common/nedb/NedbDao";

export class GithubRepositoryDao extends NedbDao<GithubRepository> {

}

export const githubRepositoryDao = new GithubRepositoryDao(__dirname);
