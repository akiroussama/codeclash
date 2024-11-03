import * as os from 'os';

export async function getSystemInfo() {
    return {
        platform: os.platform(),
        release: os.release(),
        arch: os.arch(),
        memory: {
            total: os.totalmem(),
            free: os.freemem()
        },
        cpus: {
            model: os.cpus()[0].model,
            speed: os.cpus()[0].speed,
            cores: os.cpus().length
        }
    };
}
