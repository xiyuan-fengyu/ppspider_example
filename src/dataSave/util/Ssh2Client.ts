import {Client, ClientChannel, ConnectConfig, SFTPWrapper} from "ssh2";
import {FileUtil} from "ppspider";

export class Ssh2Client {

    private client: Client;

    private shell: ClientChannel;

    private sftp: SFTPWrapper;

    private config: ConnectConfig;

    constructor(config: ConnectConfig) {
        this.config = config;
    }

    private resetConnection() {
        if (this.client) {
            this.client.destroy();
        }
        this.client = null;
        this.sftp = null;
        this.shell = null;
    }

    private async initClient() {
        if (!this.client) {
            this.client = await new Promise<any>(resolve => {
                const client = new Client();
                client.on("ready", () => {
                    resolve(client);
                }).on("error", () => {
                    this.resetConnection();
                }).connect(this.config);
            });
        }
        return this.client;
    }

    private async initSftp() {
        if (!this.sftp) {
            this.sftp = await new Promise<any>(resolve => {
                this.client.sftp((err, sftp) => {
                    if (err) {
                        resolve(null);
                    }
                    else {
                        sftp.on("close", () => this.sftp = null);
                        resolve(sftp);
                    }
                });
            });
        }
        return this.sftp;
    }

    private async initShell() {
        if (!this.shell) {
            this.shell = await new Promise<any>(resolve => {
                this.client.shell((err, shell) => {
                    if (err) {
                        resolve(null);
                    }
                    else {
                        shell.on("close", () => this.shell = null);
                        resolve(shell);
                    }
                });
            });
        }
        return this.shell;
    }

    private async initSsh() {
        let retry = 3;
        while (retry-- > 0) {
            try {
                await this.initClient();
                if (!this.client) {
                    console.warn("ssh2 client connection fail");
                    continue;
                }

                await this.initSftp();
                if (!this.sftp) {
                    console.warn("ssh2 sftp connection fail");
                    continue;
                }

                await this.initShell();
                if (!this.shell) {
                    console.warn("ssh2 shell connection fail");
                    continue;
                }

                break;
            }
            catch (e) {
                console.warn("ssh init error: " + e.message + "\n" + e.stack);
            }
        }
    }

    async uploadFile(localPath: string, remotePath: string) {
        try {
            await this.initSsh();
            const remoteDir = FileUtil.parent(remotePath);
            const upload = () => new Promise(resolve => {
                this.sftp.fastPut(localPath, remotePath, err => {
                    resolve(!err);
                });
            });
            const mkdir = () => new Promise(resolve => {
                try {
                    this.shell.write("mkdir -p " + remoteDir + "\n", () => {
                        setTimeout(() => resolve(), 500);
                    });
                }
                catch (e) {
                    console.warn("ssh mkdir error: " + e.message + "\n" + e.stack);
                    resolve(false);
                }
            });

            let retry = 3;
            while (retry-- > 0) {
                const uploadSuccess = await upload();
                if (!uploadSuccess) {
                    await mkdir();
                }
                else break;
            }
            return true;
        }
        catch (e) {
            return e;
        }
    }

}
