"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const http_1 = require("http");
const os_1 = __importDefault(require("os"));
const portfinder_1 = __importDefault(require("portfinder"));
const query_string_1 = __importDefault(require("query-string"));
const open_1 = __importDefault(require("open"));
const ora_1 = __importDefault(require("ora"));
const request_1 = __importDefault(require("request"));
const crypto_1 = require("crypto");
const logger_1 = __importDefault(require("../logger"));
const logger = new logger_1.default('Auth');
const defaultPort = 9012;
const CliAuthBaseUrl = 'https://console.cloud.tencent.com/tcb/auth';
const refreshTokenUrl = 'https://iaas.cloud.tencent.com/tcb_refresh';
async function getPort() {
    const port = await portfinder_1.default.getPortPromise({
        port: defaultPort
    });
    return port;
}
function getMacAddress() {
    const networkInterfaces = os_1.default.networkInterfaces();
    const options = ['eth0', 'eth1', 'en0', 'en1'];
    let netInterface = [];
    options.some(key => {
        if (networkInterfaces[key]) {
            netInterface = networkInterfaces[key];
            return true;
        }
    });
    const mac = (netInterface.length && netInterface[0].mac) || '';
    return mac;
}
function md5(str) {
    const hash = crypto_1.createHash('md5');
    hash.update(str);
    return hash.digest('hex');
}
async function createLocalServer() {
    return new Promise(async (resolve, reject) => {
        const server = http_1.createServer();
        try {
            const port = await getPort();
            server.listen(port, () => {
                resolve({
                    port,
                    server
                });
            });
        }
        catch (err) {
            reject(err);
        }
    });
}
async function getAuthTokenFromWeb() {
    return new Promise(async (resolve, reject) => {
        const authSpinner = ora_1.default('正在打开腾讯云获取授权').start();
        try {
            const { server, port } = await createLocalServer();
            const mac = getMacAddress();
            const hash = md5(mac);
            const CliAuthUrl = `${CliAuthBaseUrl}?port=${port}&hash=${hash}`;
            await open_1.default(CliAuthUrl);
            authSpinner.succeed('已打开云开发 CLI 授权页面，请在云开发 CLI 授权页面同意授权！');
            server.on('request', (req, res) => {
                const { url } = req;
                const { query } = query_string_1.default.parseUrl(url);
                res.writeHead(200, {
                    'Access-Control-Allow-Origin': '*',
                    'Content-Type': 'text/plain',
                    Connection: 'close'
                });
                res.end('ok');
                if (query && query.tmpToken) {
                    server.close();
                }
                resolve(query);
            });
        }
        catch (err) {
            logger.error(err.message);
            authSpinner.fail('获取授权失败！');
            reject(err);
        }
    });
}
exports.getAuthTokenFromWeb = getAuthTokenFromWeb;
async function refreshTmpToken(metaData) {
    const mac = getMacAddress();
    const hash = md5(mac);
    metaData.hash = hash;
    return new Promise((resolve, reject) => {
        request_1.default({
            url: refreshTokenUrl,
            method: 'POST',
            json: metaData
        }, (err, res) => {
            if (err) {
                reject(err);
                return;
            }
            if (res.body.code !== 0) {
                reject(new Error(res.body.message));
                return;
            }
            const { data: credential } = res.body;
            resolve(credential);
        });
    });
}
exports.refreshTmpToken = refreshTmpToken;