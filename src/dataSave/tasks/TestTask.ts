import {
    appInfo,
    DateUtil,
    FileUtil,
    Job,
    logger,
    OnStart,
    PuppeteerUtil,
    PuppeteerWorkerFactory,
    Transient
} from "ppspider";
import {Page} from "puppeteer";
import {Ssh2Client} from "../util/Ssh2Client";
import {config} from "../config";
import {MysqlClient} from "../util/MysqlClient";
import * as fs from "fs";

export class TestTask {

    @Transient() // 不参与序列化
    private ssh2Client = new Ssh2Client(config.remote);

    @Transient() // 不参与序列化
    private mysqlClient = new MysqlClient(config.mysql);

    @OnStart({
        urls: "http://www.baidu.com",
        workerFactory: PuppeteerWorkerFactory
    })
    async index(page: Page, job: Job) {
        await page.goto(job.url());
        const urls = await PuppeteerUtil.links(page, {
            "all": "http.*"
        });
        logger.debugValid && logger.debug(JSON.stringify(urls, null, 4));

        // 数据存入本地文件
        FileUtil.write(appInfo.workplace + "/data/test.json", JSON.stringify(urls));

        // 下载图片并上传到 linux 服务器
        const downloadImgRes = await PuppeteerUtil.downloadImg(page, ".index-logo-src", appInfo.workplace + "/download");
        if (downloadImgRes.success) {
            // 上传图片
            const saveName = downloadImgRes.savePath.substring(downloadImgRes.savePath.lastIndexOf("/") + 1);
            const uploadPath = config.uploadDir + "/" + saveName;
            const uploadRes = await this.ssh2Client.uploadFile(downloadImgRes.savePath, uploadPath);
            if (uploadRes === true) {
                logger.info(`upload img success: ${downloadImgRes.savePath} => ${uploadPath}`);
            }
            else {
                logger.warn(`upload img fail: ${downloadImgRes.savePath} => ${uploadPath}\n${uploadRes.message}`);
            }
            // 删除本地图片
            fs.unlinkSync(downloadImgRes.savePath);
        }

        // 存储数据到 mysql
        /*
        create table test.tb_log
        (
            id int auto_increment
                primary key,
            content text null,
            time datetime not null
        )
        engine=InnoDB charset=latin1
        ;
         */
        await this.mysqlClient.insert("tb_log", {
            content: "test",
            time: DateUtil.toStr()
        });
    }

}