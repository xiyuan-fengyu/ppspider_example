export const config = {
    dev: {
        puppeteer: {
            headless: false,
            devtools: true
        },
        mysql: {
            host: "192.168.1.150",
            user: "root",
            password: "123456",
            database: "test"
        },
        remote: {
            host: "192.168.1.150",
            port: 22,
            username: "root",
            password: "123456",
            keepaliveInterval: 30000, // 每隔 n 毫秒发送一个心跳包，用于保活
            keepaliveCountMax: 60 // 在确认连接断开之前，发送心跳包的最大数量
        },
        uploadDir: "/data/test/imgUpload"
    },
    prod: {
        puppeteer: {
            args: [
                "--no-sandbox"
            ]
        },
    }
}[(process.argv.find(item => item.startsWith("-env=")) || "-env=dev").substring(5)];