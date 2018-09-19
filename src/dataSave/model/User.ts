import {NedbModel} from "ppspider";

export class User extends NedbModel {

    name: string;

    age: number;

    gender: "boy" | "girl" | "";

}