import {NedbDao} from "../nedb/NedbDao";
import {GithubUser} from "../model/GithubUser";

export class GithubUserDao extends NedbDao<GithubUser> {

}

export const githubUserDao = new GithubUserDao();
