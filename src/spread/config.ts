import * as fs from "fs";
import {SetCookie} from "puppeteer";

function parseCookie(cookieFile: string, domain: string): SetCookie[] {
    const cookies: SetCookie[] = [];
    const cookieStr = fs.readFileSync(cookieFile, "utf-8");
    cookieStr.split(";").forEach(keyValue => {
       keyValue = keyValue.trim();
       if (keyValue) {
           const equalIndex = keyValue.indexOf("=");
           if (equalIndex > -1) {
               cookies.push({
                   name: keyValue.substring(0, equalIndex),
                   value: keyValue.substring(equalIndex + 1),
                   domain: domain
               });
           }
       }
    });
    return cookies;
}

const githubCookies = parseCookie("github.cookie.local.txt", "github.com");

export const config = {
    dev: {
        puppeteer: {
            headless: false,
            devtools: false
        },
        logger: {
            level: "info"
        },
        workplace: __dirname + "/workplace",
        github: {
            cookies: githubCookies,
            user: {
                repositories: {
                    // 用户的 repositories 列表最多抓取多少页
                    maxPage: 3
                },
                stars: {
                    // 用户的 stars 列表最多抓取多少页
                    maxPage: 3
                }
            }
        }
    },
    prod: {
        puppeteer: {
            args: [
                "--no-sandbox"
            ]
        },
        logger: {
            level: "info"
        },
        workplace: __dirname + "/workplace",
        github: {
            cookies: githubCookies,
            user: {
                repositories: {
                    // 用户的 repositories 列表最多抓取多少页
                    maxPage: 3
                },
                stars: {
                    // 用户的 stars 列表最多抓取多少页
                    maxPage: 3
                }
            }
        }
    }
}.dev;