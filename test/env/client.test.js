const Client = require('../../lib')

const client = new Client()
const { env } = client

// const envId = 'dev-97eb6c'

test('列出所有环境：tcb list', async () => {
    const data = await env.list()

    expect(data.length).toBeGreaterThanOrEqual(1)
})