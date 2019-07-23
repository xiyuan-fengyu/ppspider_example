import {AddToQueue, appInfo, DbHelperUi, FileUtil, FromQueue, Job, Launcher, OnStart, RequestUtil} from "ppspider";
import * as Cheerio from "cheerio";
import * as url from "url";

/*
从 https://pixabay.com/images/search 下载图片
*/

class PixabayImagesTask {

    @OnStart({urls: "https://pixabay.com/images/search/"})
    @FromQueue({name: "image_list", parallel: 1, exeInterval: 1000})
    @AddToQueue([
        {name: "image_list"},
        {name: "image_download"}
    ])
    async imageList(job: Job) {
        const htmlRes = await RequestUtil.simple({
            url: job.url,
            headerLines: `
            accept: text/html
            accept-encoding: gzip, deflate
            accept-language: zh-CN,zh;q=0.9
            referer: https://pixabay.com/
            user-agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/74.0.3729.169 Safari/537.36
            `
        });
        const $ = Cheerio.load(htmlRes.body);
        const imgSrcs = $(".media_list .search_results .item").find("img[srcset], img[data-lazy-srcset]").map((imgI, img) => {
            const set = (img.attribs.srcset || img.attribs["data-lazy-srcset"]).split(", ");
            return set[set.length - 1].split(" ")[0];
        }).get();
        const nextPageUrl = $(".media_list > a.pure-button[href^='/images/search/?pagi=']").map((aI, a) => {
            return url.resolve(job.url, a.attribs.href);
        }).get();
        return {
            image_list: nextPageUrl,
            image_download: imgSrcs
        };
    }

    @FromQueue({name: "image_download", parallel: 1, exeInterval: 100})
    async imageDownload(job: Job) {
        const imgRes = await RequestUtil.simple({
            url: job.url,
            headerLines: `
            referer: https://pixabay.com/
            user-agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/74.0.3729.169 Safari/537.36
            `
        });
        const [ , name, format] = /.*\/([^/]*?)__\d+\.(jpg|jpeg|png)/i.exec(job.url);
        FileUtil.mkdirs(appInfo.workplace + "/images/" + name);
        FileUtil.write(appInfo.workplace + "/images/" + name + "/source." + format, imgRes.body);
    }

}

@Launcher({
    workplace: "workplace_pixabay_images",
    tasks: [
        PixabayImagesTask
    ],
    dataUis: [
        DbHelperUi
    ],
    workerFactorys: []
})
class PixabayImagesApp {}
