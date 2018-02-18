const zlib = require('zlib')
const serverlessHttp = require('serverless-http')
const caseless = require('caseless')
const koa = require('koa')
const koaBody = require('koa-body')
const compress = require('koa-compress')
const app = new koa()
app.use(compress())
app.use(koaBody())
app.use(ctx => {
  console.log('this is lambda, over', ctx.request.body)
  ctx.compress = true
  ctx.body = {
    body: JSON.stringify(ctx.request.body).repeat(1000)
  }
})

module.exports.joke = serverlessHttp(app, {
  request: (request, event, context) => {
    if (typeof event.body === 'string') {
      console.log('LOADING BASE64')
      const enc = event.isBase64Encoded ? 'base64' : 'utf8'
      event.body = new Buffer(event.body, enc)
    }

    const headers = caseless(request.headers)
    if (!process.env.IS_OFFLINE && headers.get('content-encoding') === 'gzip') {
      console.log('SETTING CONTENT ENCODING')
      headers.set('content-encoding', 'identity')
      event.headers = request.headers
    }
  }
})
