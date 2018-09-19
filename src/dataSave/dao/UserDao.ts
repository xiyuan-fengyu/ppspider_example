import {NedbDao} from "ppspider";
import {User} from "../model/User";

export class UserDao extends NedbDao<User> {

}

export const userDao = new UserDao(__dirname);
