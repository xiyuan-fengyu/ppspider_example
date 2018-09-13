import {NedbDao} from "../nedb/NedbDao";
import {GithubUser} from "../model/GithubUser";
import {GithubRepository} from "../model/GithubRepository";

export class GithubRepositoryDao extends NedbDao<GithubRepository> {

}

export const githubRepositoryDao = new GithubRepositoryDao();
