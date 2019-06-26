import {
    AddToQueue,
    appInfo,
    Bean,
    DataUi,
    DataUiRequest,
    DbHelperUi,
    FileUtil,
    FromQueue,
    Job,
    Launcher,
    logger,
    OnStart,
    Page,
    Pager,
    PromiseUtil,
    PuppeteerUtil,
    PuppeteerWorkerFactory,
    RequestUtil
} from "ppspider";
import {Request, Response} from "puppeteer";

class Music163Task {

    @OnStart({urls: "https://music.163.com/"})
    @FromQueue({name: "music_163_other", parallel: 1, exeInterval: 1000})
    @AddToQueue([
        {name: "music_163_songs"},
        {name: "music_163_other"}
    ])
    async roaming(page: Page, job: Job) {
        await PuppeteerUtil.defaultViewPort(page);
        await PuppeteerUtil.setImgLoad(page, false);
        await page.goto(job.url, {waitUntil: "networkidle2"});
        const contentFrame = page.frames().find(item => item.name() == "contentFrame");
        return await PuppeteerUtil.links(contentFrame as any, {
            music_163_songs: "https://music.163.com/song\\?id=\\d+",
            music_163_other: "https://music.163.com/.+"
        });
    }

    @FromQueue({name: "music_163_songs", parallel: 1, exeInterval: 1000})
    @AddToQueue([
        {name: "music_163_songs"},
        {name: "music_163_other"}
    ])
    async song(page: Page, job: Job) {
        await PuppeteerUtil.defaultViewPort(page);
        await PuppeteerUtil.setImgLoad(page, false);

        const songId = job.url.match("[&?]id=(\\d+)([&].*)?$")[1];
        let audioUrl;
        let lyric;
        const [audioUrlPromise, audioUrlResolve] = PromiseUtil.createPromiseResolve();
        page.on("request", async (req: Request) => {
            // 监听歌曲下载地址
            // https://m801.music.126.net/20190626114445/96285a44f2618cd962c355739b1f2dc6/jdyyaac/0f59/555e/0e0f/833374b804b4211e7e719ec1b083a339.m4a
            if (req.method() == "GET" && req.url().match(".*/([0-9a-z]{4}/){3}[0-9a-z]{32}\\.[0-9a-z]{1,5}$")) {
                if (!audioUrl) {
                    audioUrl = req.url();
                    audioUrlResolve();
                }

                if (req.url() == audioUrl) {
                    // 阻止歌曲下载
                    await req.abort();
                }
            }
        });
        page.on("response", async (res: Response) => {
            if (res.url().startsWith("https://music.163.com/weapi/song/lyric")) {
                const json = await res.json();
                lyric = json.lrc.lyric;
            }
        });
        await page.goto(job.url, {waitUntil: "networkidle2"});

        const contentFrame = page.frames().find(item => item.name() == "contentFrame");
        await PuppeteerUtil.addJquery(contentFrame as any);
        // 等待 contentFrame 加载完毕
        await contentFrame.waitForSelector("div#content-operation a[data-res-action='play']", {timeout: 3000});
        // 收集歌曲信息
        const songInfo: any = await contentFrame.evaluate(() => {
            const $ = jQuery;
            const vipOnly = $("div#content-operation a[data-res-action='play']").hasClass("u-btni-openvipply");
            const artistA = $("p.des a[href^='/artist?id=']");
            const albumA = $("p.des a[href^='/album?id=']");
            return {
                title: $("div.tit em").text().trim(),
                subTitle: $("div.tit div.subtit").text().trim(),
                artistId: +artistA.attr("href").match("\\?id=(\\d+)")[1],
                artistName: artistA.text(),
                albumId: +albumA.attr("href").match("\\?id=(\\d+)")[1],
                albumName: albumA.text(),
                vipOnly: vipOnly ? true : undefined
            };
        });
        songInfo._id = songId;
        songInfo.lyric = lyric;
        await appInfo.db.save("song", songInfo);

        if (!songInfo.vipOnly) {
            // 在 contentFrame 中点击 播放按钮
            await contentFrame.tap("div#content-operation a[data-res-action='play']");

            // 等待获取音乐下载链接
            await audioUrlPromise;

            // 用request下载歌曲
            logger.debugValid && logger.debug("\n" + songInfo.title + "\n" + job.url + "\n" + audioUrl + "\n");
            const aduioRes = await RequestUtil.simple({
                url: audioUrl,
                headers: {
                    "Origin": "https://music.163.com",
                    "Range": "bytes=0-",
                    "Referer": "https://music.163.com/",
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/74.0.3729.169 Safari/537.36"
                }
            });

            // 保存到文件
            FileUtil.write(appInfo.workplace + "/audio/" + songId + ".mp3", aduioRes.body);
        }

        // 删除 Application localStorage 中保存的 track-queue 信息，否则打空气其他歌曲页面的时候，会默认加载播放的歌曲的内容，导致接口判定错误
        await contentFrame.evaluate(() => localStorage.removeItem("track-queue"));

        return await PuppeteerUtil.links(contentFrame as any, {
            music_163_songs: "https://music.163.com/song\\?id=\\d+",
            music_163_other: "https://music.163.com/.+"
        });
    }

}

@DataUi({
    label: "网易云音乐",
    // language=CSS
    style: `
        audio {
            display: block;
            position: relative;
            margin: 12px auto;
        }
        
        ul.pagination {
            justify-content: center
        }
        ul.pagination li {
            margin: 0 4px;
            cursor: pointer;
        }    
            
        span.play {
            cursor: pointer;
        }    
    `,
    // language=Angular2HTML
    template: `
        <div class="container-fluid">
            <div class="col-sm-12">
                <audio [attr.src]="curAudio" autoplay controls="controls"></audio>
            </div>
            
            <table *ngIf="pager && pager.list" class="table table-hover">
                <thead>
                    <tr>
                        <th>#</th>
                        <th>Title</th>
                        <th>Sub Title</th>
                        <th>Artist</th>
                        <th>Album</th>
                        <th>Option</th>
                    </tr>
                </thead>
                <tbody>
                    <tr *ngFor="let item of pager.list">
                        <td>{{item._id}}</td>
                        <td>{{item.title}}</td>
                        <td>{{item.subTitle}}</td>
                        <td>{{item.artistName}}</td>
                        <td>{{item.albumName}}</td>
                        <td>
                            <span *ngIf="!item.vipOnly" (click)="changeAudio(item._id)"  class="play text-primary">Play</span>
                            <span *ngIf="item.vipOnly">VIP only</span>
                        </td>
                    </tr>
                </tbody>
            </table>
    
            <nav *ngIf="pager">
                <ul class="pagination">
                    <li [style.visibility]="pager.pageIndex > 0 ? 'visible' : 'hidden'" class="text-primary">
                        <a (click)="loadPage(pager.pageIndex - 1, 10)" aria-label="Previous">
                            Prev
                        </a>
                    </li>
                    <li class="text-primary">
                        <a (click)="loadPage(pager.pageIndex, 10)" aria-label="Refresh">
                            Refresh
                        </a>
                    </li>
                    <li [style.visibility]="pager.pageIndex < maxPageIndex ?  'visible' : 'hidden'" class="text-primary">
                        <a (click)="loadPage(pager.pageIndex + 1, 10)" aria-label="Next">
                            Next
                        </a>
                    </li>
                </ul>
            </nav>
        </div>
    `
})
class Music163Ui {

    pager: Pager;

    maxPageIndex: number = 0;

    curAudio: string;

    async ngOnInit() {
        await this.loadPage(0, 10);
    }

    changeAudio(_id: number) {
        this.curAudio = window.location.origin + "/audio/" + _id + ".mp3";
    }

    async loadPage(pageIndex: number, pageSize: number) {
        this.pager = await this.getSongPager(pageIndex, pageSize);
        this.maxPageIndex = parseInt("" + (this.pager.total - 1) / 10);
    }

    getSongPager(pageIndex: number, pageSize: number) {
        // just a stub
        return null;
    }

}

@Bean()
class Music163UiController {

    @DataUiRequest(Music163Ui.prototype.getSongPager)
    async getSongPager(pageIndex: number = 0, pageSize: number = 10) {
        const pager = new Pager();
        pager.pageIndex = pageIndex;
        pager.pageSize = pageSize;
        pager.projection = {lyric: false};
        await appInfo.db.page("song", pager);
        return pager;
    }

}

@Launcher({
    workplace: "workplace_music163",
    dbUrl: "mongodb://192.168.99.150:27017/music163",
    tasks: [
        Music163Task
    ],
    dataUis: [
        DbHelperUi,
        Music163Ui
    ],
    workerFactorys: [
        new PuppeteerWorkerFactory({
            headless: false,
            devtools: true
        })
    ]
})
class Music163App {}
