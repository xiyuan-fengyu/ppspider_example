import {
    AddToQueue,
    appInfo,
    DbHelperUi,
    FromQueue,
    Job,
    Launcher, logger,
    OnStart,
    RequestUtil
} from "ppspider";
import * as cheerio from "cheerio";
import * as url from "url";
import * as crypto from "crypto";

function md5(text: string) {
    return crypto.createHash("md5").update(Buffer.from(text)).digest('hex');
}

class QuotesTask {

    @OnStart({
        urls: "http://quotes.toscrape.com/"
    })
    @FromQueue({
        name: "quote_pages",
        exeInterval: 0
    })
    @AddToQueue({name: "quote_pages"})
    async getQuotes(job: Job) {
        job.depth == 0 && logger.info("open http://localhost:9000/#/dataUi/DbHelperUi, choose quotes collection and submit, you will say the quotes.");

        const htmlRes = await RequestUtil.simple({url: job.url});
        const $ = cheerio.load(htmlRes.body);

        const quotes = $("div.quote").map((quoteI, quoteEle) => {
            const $quoteEle = $(quoteEle);
            return {
                text: $quoteEle.find(".text").text().replace(/^[“"]|[”"]$/g, ""),
                author: $quoteEle.find(".author").text(),
                tags: $quoteEle.find(".tags .tag").map((tagI, tagEle) => $(tagEle).text()).get()
            };
        }).get();

        for (let item of quotes) {
            item._id = md5(item.text);
            await appInfo.db.save("quotes", item);
        }

        // 只添加到一个队列中，所以不需要通过 {quote_pages: urls} 的方式具体指明加到哪个队列
        // 由于 href 属性是 /page/2/ 这种不完整的格式，需要通过 url.resolve 计算出完整路径
        return $("nav > ul.pager > li.next > a")
            .map((index, element) => url.resolve(job.url, element.attribs.href)).get();
    }

}

@Launcher({
    workplace: "workplace_quotes",
    tasks: [
        QuotesTask
    ],
    dataUis: [
        DbHelperUi
    ],
    workerFactorys: []
})
class App {}
