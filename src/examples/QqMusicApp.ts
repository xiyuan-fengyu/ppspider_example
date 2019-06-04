import {
    AddToQueue,
    AddToQueueData,
    appInfo,
    DbHelperUi,
    FromQueue,
    Job,
    JobOverride,
    Launcher,
    OnStart,
    PuppeteerUtil,
    PuppeteerWorkerFactory
} from "ppspider";
import {Page} from "puppeteer";

/**
 * 抓取 https://y.qq.com/ 歌曲信息和评论
 */
class QqMusicTask {

    @JobOverride("qq_music_detail")
    overrideKey(job: Job) {
        // 重写 job 的key，增强去重的效果
        const match = job.url.match("https://y.qq.com/n/yqq/song/(.*?)\\.html.*");
        if (match) job.key = match[1];
    }

    @OnStart({
        urls: "https://y.qq.com/",
        workerFactory: PuppeteerWorkerFactory
    })
    @FromQueue({
        name: "qq_music_other",
        workerFactory: PuppeteerWorkerFactory,
        parallel: 1,
        exeInterval: 1500
    })
    @AddToQueue([
        {name: "qq_music_detail"},
        {name: "qq_music_other"}
    ])
    async index(page: Page, job: Job): AddToQueueData {
        await PuppeteerUtil.defaultViewPort(page);
        await PuppeteerUtil.setImgLoad(page, false);
        await page.goto(job.url);
        return await PuppeteerUtil.links(page, {
            qq_music_detail: "https://y.qq.com/n/yqq/song/.*",
            qq_music_other: "https://y.qq.com/.*"
        });
    }

    @FromQueue({
        name: "qq_music_detail",
        workerFactory: PuppeteerWorkerFactory,
        parallel: 1
    })
    @AddToQueue([
        {name: "qq_music_detail"},
        {name: "qq_music_other"}
    ])
    async detail(page: Page, job: Job): AddToQueueData {
        // logger.debugValid && logger.debug(job.key + "    " + job.url);

        const songId = job.key;

        await PuppeteerUtil.defaultViewPort(page);
        await PuppeteerUtil.setImgLoad(page, false);

        let songInfo: any = {
            _id: songId
        };

        // 歌曲信息
        const waigSongInfoRes = PuppeteerUtil.onceResponse(page,
            "https://u.y.qq.com/cgi-bin/musicu.fcg\\?-=.*music.pf_song_detail_svr.*", async response => {
                Object.assign(songInfo, (await response.json()).songinfo.data);
            });

        // 歌词
        const waitLyricRes = PuppeteerUtil.onceResponse(page,
            "https://c.y.qq.com/lyric/fcgi-bin/fcg_query_lyric_yqq.fcg\\?.*", async response => {
                songInfo.lyric = (await response.json()).lyric;
            });

        // 第一页评论
        const waitCommentRes = PuppeteerUtil.onceResponse(page,
            "https://c.y.qq.com/base/fcgi-bin/fcg_global_comment_h5.fcg\\?.*pagesize=[1-9].*", async response => {
                const comments = (await response.json()).comment.commentlist;
                await this.saveComments(songId, comments);
            }, 2);

        await page.goto(job.url);
        // 等待基本信息和第一页的评论抓取完成
        await Promise.all([waigSongInfoRes, waitLyricRes, waitCommentRes]);

        await appInfo.db.save("song", songInfo);

        // 如果有多页评论，可以找到 $(".mod_page_nav.js_pager_comment .current") 这种节点
        // 如果只有一页评论，可以找到 $(".comment__show_all_link") 这种节点
        const hasMorePage = await new Promise(resolve => {
            page.waitForSelector(".mod_page_nav.js_pager_comment .current", {timeout: 1000})
                .then(() => resolve(true)).catch();
            page.waitForSelector(".comment__show_all_link", {timeout: 1000})
                .then(() => resolve(false)).catch();
        });

        if (hasMorePage) {
            // 抓取前 config.commentPages 页的评论
            let nextCommentPageNum = 2;
            while (nextCommentPageNum <= config.commentPages) {
                const selector = `a.js_pageindex[data-index='${nextCommentPageNum}']`;
                const nexPageBtnCount = await PuppeteerUtil.count(page, selector);
                if (nexPageBtnCount) {
                    const waitNextCommentPageRes = PuppeteerUtil.onceResponse(page,
                        "https://c.y.qq.com/base/fcgi-bin/fcg_global_comment_h5.fcg\\?.*", async response => {
                            const comments = (await response.json()).comment.commentlist;
                            await this.saveComments(songId, comments);
                        });
                    page.tap(selector);
                    await waitNextCommentPageRes;
                }
                else break;
                nextCommentPageNum++;
            }
        }

        return await PuppeteerUtil.links(page, {
            qq_music_detail: "https://y.qq.com/n/yqq/song/.*",
            qq_music_other: "https://y.qq.com/.*"
        });
    }

    private saveComments(songId: string, comments: any[]) {
        if (!comments || !comments.length) {
            return;
        }

        const ps = [];
        for (let comment of comments) {
            comment._id = comment.commentid;
            comment.songId = songId;
            ps.push(appInfo.db.save("comment", comment));
        }
        return Promise.all(ps);
    }

}

@Launcher({
    workplace: "workplace",
    queueCache: "workplace/queueCache_qq_music.txt",
    dbUrl: "nedb://workplace/nedb_qq_music",
    tasks: [
        QqMusicTask
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
    commentPages: 10
};
