export default {
  type: 'object',
  properties: {
    ip: {
      type: 'string'
    },
    port: {
      type: 'integer',
      minimum: 1,
      maximum: 65535
    },
    state: {
      type: 'integer',
      minimum: 0,
      maximum: 3
    },
    os: {
      type: 'string'
    },
    version: {
      type: 'string'
    },
    dapp_id: {
      type: 'string',
      length: 64
    }
  },
  required: ['ip', 'port', 'state']
}
