import {
    AddToQueue,
    appInfo,
    DataUi,
    DataUiRequest,
    DbHelperUi,
    FromQueue,
    Job,
    Launcher,
    OnStart,
    RequestUtil
} from "ppspider";
import * as Cheerio from "cheerio";
import * as url from "url";

@DataUi({
    label: "User Agents 导出",
    // language=CSS
    style: `
    
    `,
    // language=Angular2HTML
    template: `
    <div class="container" style="padding: 12px 0">
        <button #exportTsBtn (click)="exportTsBtn.enable = false; exportUserAgentsTs(exportTsBtn)" 
                [attr.disable]="exportTsBtn.enable ? null : true"
                class="btn btn-primary">导出为 UserAgents.ts</button>
    </div>
    `
})
class UserAgentsUi {

    async exportUserAgentsTs(btn: any) {
        const tsStr = await this.generateUserAgentsTs();
        const blob = new Blob([tsStr], {
            type: 'text/plain'
        });
        this.downloadBlob(blob, "UserAgents.ts");
        btn.enable = true;
    }

    downloadBlob(blob: Blob, file: string) {
        const url= (window.URL || window["webkitURL"]).createObjectURL(blob);
        const a = document.createElement("a") as any;
        document.body.appendChild(a);
        a.style = "display: none";
        a.href = url;
        a.download = file;
        a.click();
        window.URL.revokeObjectURL(url);
    }

    generateUserAgentsTs(): Promise<string> {
        // just a stub
        return null;
    }

}

class UserAgentsTask {

    @DataUiRequest(UserAgentsUi.prototype.generateUserAgentsTs)
    async generateUserAgentsTs() {
        const userAgents = await appInfo.db.findList("userAgents", {});
        return `

export interface UserAgent {
    _id: string,
    type: string,
    shortName?: string,
    version: number | string,
    os: string,
    hardware: string
}        

const userAgents: UserAgent[] = ${JSON.stringify(userAgents, null, 4)};

export class UserAgents {

    private static userAgents: UserAgent[] = userAgents;
    
    private static randomUserAgentInArr(arr: UserAgent[]) {
        return arr.length == 0 ? null : arr[Math.floor(arr.length * Math.random())]._id;
    }
    
    static random() {
        return this.randomUserAgentInArr(this.userAgents);
    }

    static filterByRegex(reg: string | RegExp) {
        return this.userAgents.filter(item => item._id.match(reg));
    }

    static randomByRegex(reg: string | RegExp) {
        return this.randomUserAgentInArr(this.filterByRegex(reg));
    }

    static filterByPredict(predict: (item: UserAgent) => boolean) {
        return this.userAgents.filter(predict);
    }

    static randomByPredict(predict: (item: UserAgent) => boolean) {
        return this.randomUserAgentInArr(this.filterByPredict(predict));
    }
    
}
        `;
    }

    @OnStart({urls: ""})
    @AddToQueue({name: "browser_userAgent_urls"})
    async addBrowsers() {
        return `
        https://developers.whatismybrowser.com/useragents/explore/software_name/chrome/1
        https://developers.whatismybrowser.com/useragents/explore/software_name/edge/1
        https://developers.whatismybrowser.com/useragents/explore/software_name/qihoo-360/1
        https://developers.whatismybrowser.com/useragents/explore/software_name/qq-browser/1
        https://developers.whatismybrowser.com/useragents/explore/software_name/firefox/1
        https://developers.whatismybrowser.com/useragents/explore/software_name/opera/1
        `.split("\n").map(line => line.trim()).filter(line => line);
    }

    @FromQueue({name: "browser_userAgent_urls", parallel: 1, exeInterval: 500, timeout: 10000})
    @AddToQueue({name: "browser_userAgent_urls"})
    async getUserAgents(job: Job) {
        const [ , browser, pageIndex] = /https:\/\/developers\.whatismybrowser\.com\/useragents\/explore\/software_name\/(.*?)\/(\d+)/.exec(job.url);
        const htmlRes = await RequestUtil.simple({
            url: job.url,
            headerLines: `
            accept: text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3
            accept-encoding: gzip, deflate, br
            accept-language: zh-CN,zh;q=0.9
            cache-control: max-age=0
            referer: https://developers.whatismybrowser.com/useragents/explore/software_name/${browser}/${pageIndex == '1' ? 2 : +pageIndex - 1}
            upgrade-insecure-requests: 1
            user-agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/74.0.3729.169 Safari/537.36
            `,
            proxy: "http://127.0.0.1:2007"
        });
        const $ = Cheerio.load(htmlRes.body);

        const userAgents = $("table.table-useragents tbody tr").map((trI, tr) => {
            const $tds = $(tr).find("> td");
            const fullName = $($tds[0]).text().trim();
            const $versonTd = $($tds[1]);
            const shortName = $versonTd[0].attribs.title;
            let version: any = $versonTd.text().trim();
            if (+version) {
                version = +version;
            }
            const os = $($tds[2]).text().trim();
            const hardware = $($tds[3]).text().trim();
            return {
                _id: fullName,
                type: browser,
                shortName,
                version,
                os,
                hardware
            };
        }).get();

        for (let userAgent of userAgents) {
            await appInfo.db.save("userAgents", userAgent);
        }

        return $("#pagination > a[href^='/useragents/explore/software_name/']")
            .map((aI, a) => url.resolve(job.url, a.attribs.href))
            .get();
    }

}

@Launcher({
    workplace: "workplace",
    tasks: [
        UserAgentsTask
    ],
    dataUis: [
        DbHelperUi,
        UserAgentsUi
    ],
    workerFactorys: [],
    webUiPort: 9002
})
class UserAgentsApp {}
