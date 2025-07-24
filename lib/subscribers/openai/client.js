'use strict'
const Subscriber = require('../base')
class OpenAIClientSubscriber extends Subscriber {
  constructor(agent) {
    super(agent, 'openai:nr_makeRequest')
    this.events = ['asyncEnd']
    this.requireActiveTx = true
  }

  handler(data, ctx) {
    const { self } = data
    ctx.extras = { apiKey: self.apiKey }
    return ctx
  }
  asyncEnd(data) {
    const { result } = data
    const ctx = this._agent.tracer.getContext()
    if (ctx?.segment) {
      const headers = result?.response?.headers ?
        Object.fromEntries(result.response.headers) :
        { ...result?.headers }
      ctx.extras = { headers }
    }
  }
}

const clientConfig = [
  {
    channelName: 'nr_makeRequest',
    module: { name: 'openai', versionRange: '>=4.0.0', filePath: 'core.js' },
    functionQuery: {
      className: 'APIClient',
      methodName: 'makeRequest',
      kind: 'Async'
    }
  },
  {
    channelName: 'nr_makeRequest',
    module: { name: 'openai', versionRange: '>=4.0.0', filePath: 'client.js' },
    functionQuery: {
      className: 'OpenAI',
      methodName: 'makeRequest',
      kind: 'Async'
    }
  }
]

module.exports = {
  clientConfig,
  OpenAIClientSubscriber
}
