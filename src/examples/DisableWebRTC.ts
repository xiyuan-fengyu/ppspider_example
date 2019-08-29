import {DbHelperUi, Job, Launcher, OnStart, Page, PromiseUtil, PuppeteerWorkerFactory} from "ppspider";

class TestTask {

    @OnStart({urls: "https://ip.voidsec.com/", timeout: -1})
    async index(job: Job, page: Page) {
        await page.evaluateOnNewDocument(() => {
            class RTCPeerConnection {
                constructor() {}
                createOffer(){}
                createAnswer(){}
                setLocalDescription(){}
                setRemoteDescription(){}
                updateIce(){}
                addIceCandidate(){}
                getConfiguration(){}
                getLocalStreams(){}
                getRemoteStreams(){}
                getStreamById(){}
                addStream(){}
                removeStream(){}
                close(){}
                createDataChannel() {}
                createDTMFSender(){}
                getStats(){}
                setIdentityProvider(){}
                getIdentityAssertion(){}
            }
            window["RTCPeerConnection"] = window["webkitRTCPeerConnection"] = RTCPeerConnection;
        });
        await page.goto(job.url);
        await PromiseUtil.sleep(10000000);
    }

}

@Launcher({
    workplace: "workplace_quotes",
    tasks: [
        TestTask
    ],
    dataUis: [
        DbHelperUi
    ],
    workerFactorys: [
        new PuppeteerWorkerFactory({
            headless: false,
            args: [
                '--proxy-server=127.0.0.1:2007'
            ]
        })
    ]
})
class App {}
