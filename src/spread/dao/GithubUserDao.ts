import {GithubUser} from "../model/GithubUser";
import {NedbDao} from "ppspider";

export class GithubUserDao extends NedbDao<GithubUser> {

}

export const githubUserDao = new GithubUserDao(__dirname);
