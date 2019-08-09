import  NodeSSH from 'node-ssh'
import  path from 'path'
import Logger from '../logger'
import { INodeDeployConfig } from '../deploy/node'
import chalk from 'chalk'

const logger = new Logger('NodeController')

const GET_VEMO_ENTRY = 'npm run vemo -- main | tail -n 1'
const PM2_OPTIONS = '-o out.log -e err.log'
export class NodeController {
    ssh: any
    _options: INodeDeployConfig
    constructor(config: INodeDeployConfig) {
        config = {
            username: 'root',
            port: 22,
            remotePath: `/data/tcb-service/${config.name}`,
            ...config
        }
        this.ssh = new NodeSSH()
        this._options = config
    }

    async connect() {
        const { host, username, port, password } = this._options
        await this.ssh.connect({ host, username, port, password })
    }

    async start({ vemo }) {
        await this.connect()
        await this.installDependencies()
        logger.log('Starting application...')

        const secret = this.injectSecret()
        const { remotePath, name } = this._options

        // 清理pm2进程
        await this.ssh.execCommand('pm2 delete all')

        if (vemo) {
            logger.log('start vemo')
            const { stdout, stderr } = await this.ssh.execCommand(secret + `pm2 start $(${GET_VEMO_ENTRY}) ${PM2_OPTIONS} --name ${name}`, {
                cwd: remotePath
            })
            console.log(stdout || stderr)
        } else {
            const entryPath = path.posix.resolve(remotePath, 'index.js')
            logger.log(`start ${entryPath}`)
            const { stdout, stderr } = await this.ssh.execCommand(secret + `pm2 start ${entryPath} ${PM2_OPTIONS} --name ${name}`, {
                cwd: remotePath
            })
            console.log(stdout || stderr)
        }

        this.ssh.dispose()
    }

    async installDependencies() {
        const { remotePath } = this._options
        logger.log('Installing dependencies...')
        await this.ssh.execCommand('rm -rf node_modules', {
            cwd: remotePath
        })
        const installResult = await this.ssh.execCommand('npm install --production', {
            cwd: remotePath
        })
        console.log(installResult.stdout || installResult.stderr)
    }

    injectSecret() {
        const { secretId, secretKey } = this._options
        return `export TENCENTCLOUD_SECRETID=${secretId} && export TENCENTCLOUD_SECRETKEY=${secretKey} && `
    }

    async logs({ lines }) {
        await this.connect()

        const { remotePath } = this._options
        const { stdout: logContent, stderr: logFail } = await this.ssh.execCommand(`tail -n ${lines} out.log`, { cwd: remotePath })
        const { stdout: errContent, stderr: errFail } = await this.ssh.execCommand(`tail -n ${lines} err.log`, { cwd: remotePath })

        console.log(chalk.gray(`${remotePath}/out.log last ${lines} lines:`))
        console.log(logContent || logFail)
        console.log('\n')
        console.log(chalk.gray(`${remotePath}/err.log last ${lines} lines:`))
        console.log(errContent || errFail)
        this.ssh.dispose()
    }

    async delete() {
        await this.connect()
        const { remotePath, name } = this._options
        const { stdout, stderr } = await this.ssh.execCommand(`pm2 delete ${name}`, { cwd: remotePath })
        console.log(stdout || stderr)
        this.ssh.dispose()
    }

    async show() {
        await this.connect()
        const { stdout, stderr } = await this.ssh.execCommand('pm2 list')
        console.log(stdout || stderr)
        this.ssh.dispose()
    }
}
