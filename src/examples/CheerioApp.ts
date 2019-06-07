import {
    AddToQueue,
    appInfo,
    DbHelperUi,
    FileUtil,
    FromQueue,
    Job,
    Launcher,
    NoneWorkerFactory,
    OnStart,
    RequestUtil
} from "ppspider";
import * as cheerio from "cheerio";

class MziTuTask {

    private userAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/73.0.3683.86 Safari/537.36";

    @OnStart({
        urls: "https://www.mzitu.com/",
        workerFactory: NoneWorkerFactory // 由于使用 Request + cheerio 获取网页并解析
    })
    @FromQueue({
        name: "img_list_pages",
        workerFactory: NoneWorkerFactory
    })
    @AddToQueue([
        {name: "img_list_pages"},
        {name: "img_detail_pages"}
    ])
    async list(useless: any, job: Job) {
        const referer = job.datas.referer || "https://www.mzitu.com/";
        const htmlRes = await RequestUtil.simple({
            url: job.url,
            headers: {
                "Referer": referer,
                "User-Agent": this.userAgent
            }
        });

        const $ = cheerio.load(htmlRes.body);

        const detailUrls = [];
        $("#pins > li > a").each((index, element) => {
            const href = element.attribs.href;
            if (href && href.match("^https://www\\.mzitu\\.com/\\d+/?$")) {
                detailUrls.push(href);
            }
        });

        const listUrls = [];
        $("nav div.nav-links a.page-numbers").each((index, element) => {
            const href = element.attribs.href;
            if (href && href.match("^https://www\\.mzitu\\.com/page/\\d+/?$")) {
                listUrls.push(href);
            }
        });

        return {
            img_list_pages: listUrls.map(url => {
                const subJob = new Job(url);
                subJob.datas.referer = job.url;
                return subJob;
            }),
            img_detail_pages: detailUrls.map(url => {
                const subJob = new Job(url);
                subJob.datas.referer = job.url;
                return subJob;
            })
        };
    }

    @FromQueue({
        name: "img_detail_pages",
        workerFactory: NoneWorkerFactory
    })
    @AddToQueue([
        {name: "img_detail_pages"}
    ])
    async detail(useless: any, job: Job) {
        const htmlRes = await RequestUtil.simple({
            url: job.url,
            headers: {
                "Referer": job.datas.referer,
                "User-Agent": this.userAgent
            }
        });

        const $ = cheerio.load(htmlRes.body);

        const idpM = job.url.match("^https://www\\.mzitu\\.com/(\\d+)(/(\\d+))?/?$");
        job.datas.id = parseInt(idpM[1]);
        job.datas.p = parseInt(idpM[3]) || 1;
        job.datas.img = $("div.main-image a > img")[0].attribs.src;

        // 下载图片
        const imgRes = await RequestUtil.simple({
            url: job.datas.img,
            headers: {
                "Referer": job.datas.referer,
                "User-Agent": this.userAgent
            }
        });
        // 保存图片
        FileUtil.write(appInfo.workplace + "/mzitu/" + job.datas.id + "_" + job.datas.p + ".jpg", imgRes.body as any);

        const detailUrls = [];
        $("div.pagenavi > a, div.hotlist > dd > a").each((index, element) => {
            const href = element.attribs.href;
            if (href && href.match("^https://www\\.mzitu\\.com/\\d+(/\\d+)/?$")) {
                detailUrls.push(href);
            }
        });

        return {
            img_detail_pages: detailUrls.map(url => {
                const subJob = new Job(url);
                subJob.datas.referer = job.url;
                return subJob;
            })
        };
    }

}

@Launcher({
    workplace: __dirname + "/workplace_mzitu",
    tasks: [
        MziTuTask
    ],
    dataUis: [
        DbHelperUi
    ],
    workerFactorys: []
})
class App {}
