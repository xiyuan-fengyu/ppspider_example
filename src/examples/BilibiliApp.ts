import {
    AddToQueue,
    AddToQueueData,
    appInfo, DbHelperUi,
    FromQueue,
    Job,
    JobOverride,
    Launcher, NetworkTracing,
    OnStart,
    PuppeteerUtil,
    PuppeteerWorkerFactory
} from "ppspider";
import {Page} from "puppeteer";

/**
 * 抓取 https://www.bilibili.com/ 视频信息和评论
 */
class BilibiliTask {

    @JobOverride("videos")
    overrideVideoJobKey(job: Job) {
        const match = job.url.match("/video/av(\\d+)");
        if (match) {
            // 获取av id 和分页信息，组合成新的唯一key，用于BloonFilter过滤
            const avId = match[1];
            job.key = avId; // 设置 key，每个视频只抓取 1p
            job.datas.id = parseInt(avId);
        }
    }

    @OnStart({
        urls: "https://www.bilibili.com/",
        workerFactory: PuppeteerWorkerFactory
    })
    @AddToQueue({ name: "videos" })
    async roam(page: Page, job: Job): AddToQueueData {
        await PuppeteerUtil.defaultViewPort(page); // 设置分辨率 1920 * 1080
        await PuppeteerUtil.setImgLoad(page, false); // 禁用图片加载
        await page.goto(job.url); // 跳转网页
        await PuppeteerUtil.scrollToBottom(page); // 滚动到网页底部，以触发所有资源的加载
        return await PuppeteerUtil.links(page, {
            videos: ".*bilibili.*/video/av.*"
        });
    }

    @FromQueue({
        name: "videos",
        workerFactory: PuppeteerWorkerFactory,
        exeInterval: 5000,
        parallel: 1
    })
    @AddToQueue({ name: "videos" })
    async video(page: Page, job: Job) {
        await PuppeteerUtil.defaultViewPort(page);
        await PuppeteerUtil.setImgLoad(page, false);

        const aid = job.datas.id || 52511233;
        const videoInfo: any = {
            _id: aid
        };

        // 抓取视频的tags
        const tagsResWait = PuppeteerUtil.onceResponse(page, "api.bilibili.com/x/tag/archive/tags", async response => {
            videoInfo.tags = PuppeteerUtil.jsonp(await response.text()).data;
        });

        await page.goto(job.url);
        await PuppeteerUtil.addJquery(page);

        // 抓取视频的基本信息 https://api.bilibili.com/x/web-interface/view?aid=avId
        const info = await this.getVideoInfo(page, aid);
        Object.assign(videoInfo, info.data);
        // 抓取相关视频列表
        videoInfo.related = (await this.getRelated(page, aid)).data;
        await tagsResWait;

        // 保存视频信息
        await appInfo.db.save("video", videoInfo);

        // 抓取评论
        let savePs = [];
        let mainPageSize = 20;
        let mainCount = 20;
        for (let mainPageIndex = 1;
             mainPageIndex <= config.maxReplyPageIndex && mainPageIndex * mainPageSize <= mainCount;
             mainPageIndex++) {
            // 获取主楼评论分页
            let now = new Date().getTime();
            const res = await this.get(page, `https://api.bilibili.com/x/v2/reply?callback=jQuery1720985759999224225_${now}&jsonp=jsonp&pn=${mainPageIndex}&type=1&oid=${aid}&sort=2&_=${now}`);
            mainPageSize = res.data.page.size;
            mainCount = res.data.page.count;

            for (let reply of res.data.replies) {
                if (reply.rcount > 3) {
                    // 需要获取楼中楼分页
                    let subPageSize = 10;
                    let subCount = 10;
                    for (let subPageIndex = 1;
                         subPageIndex * subPageSize <= subCount;
                         subPageIndex++) {
                        // 获取楼中楼评论分页
                        let now = new Date().getTime();
                        const res = await this.get(page, `https://api.bilibili.com/x/v2/reply/reply?callback=jQuery1720628291533221834_${now}&jsonp=jsonp&pn=${subPageIndex}&type=1&oid=${aid}&ps=10&root=${reply.rpid}&_=${now}`);
                        subPageSize = res.data.page.size;
                        subCount = res.data.page.count;
                        savePs.push(this.saveReplies(res.data.replies));
                    }
                }
                else {
                    // 直接存储
                    const subReplies = reply.replies;
                    delete reply.replies;
                    savePs.push(this.saveReplies(subReplies));
                }
            }

            savePs.push(this.saveReplies(res.data.replies));
        }
        await Promise.all(savePs);

        if (videoInfo.related instanceof Array) {
            return videoInfo.related.map(item => `https://www.bilibili.com/video/av${item.aid}`);
        }
    }

    /**
     * 保存评论和用户信息
     * @param replies
     */
    private saveReplies(replies: any) {
        const waitArr = [];
        if (replies instanceof Array) {
            for (let reply of replies) {
                // 单独存储用户信息
                const member = reply.member;
                delete reply.member;
                member._id = member.mid;
                waitArr.push(appInfo.db.save("member", member));

                // 删除不必要的信息
                delete reply.folder;
                delete reply.replies;

                waitArr.push(appInfo.db.save("reply", reply));
            }
        }
        return Promise.all(waitArr);
    }

    private getVideoInfo(page: Page, aid: number) {
        return this.get(page, `https://api.bilibili.com/x/web-interface/view?aid=${aid}`);
    }

    private getRelated(page: Page, aid: number) {
        return this.get(page, `https://api.bilibili.com/x/web-interface/archive/related?aid=${aid}&jsonp=jsonp`);
    }

    private async get(page: Page, url: string) {
        const res = await page.evaluate(url => new Promise<string>(resolve => {
            $.get(url, res => {
                resolve(res);
            }, "text");
        }), url);
        if (res.startsWith("{")) {
            return JSON.parse(res);
        }
        else {
            return PuppeteerUtil.jsonp(res);
        }
    }

}

@Launcher({
    workplace: __dirname + "/workplace",
    // dbUrl: "mongodb://192.168.1.150:27017/bilibili",
    tasks: [
        BilibiliTask
    ],
    dataUis: [
        DbHelperUi
    ],
    workerFactorys: [
        new PuppeteerWorkerFactory({
            headless: false,
            devtools: true
        })
    ]
})
class App {}

const config = {
    maxReplyPageIndex: 3, // 最多只抓取前两页的评论
};
