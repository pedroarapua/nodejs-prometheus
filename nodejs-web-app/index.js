const os = require("os")
const http = require('http')
const url = require('url')
const pkg = require('./package.json')
const client = require('prom-client')

const port = process.env.PORT || 8080
const hostname = os.hostname()
const register = new client.Registry()

register.setDefaultLabels({
  app: pkg.name
})

const httpRequestDurationMicroseconds = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'code'],
  buckets: [0.1, 0.3, 0.5, 0.7, 1, 3, 5, 7, 10] // 0.1 to 10 seconds
})

register.registerMetric(httpRequestDurationMicroseconds)

client.collectDefaultMetrics({ register })

const createOrderHandler = async (req, res) => {
  // return an error 1% of the time
  if ((Math.floor(Math.random() * 100)) === 0) {
    throw new Error('Internal Error')
  }

  // delay for 3-6 seconds
  const delaySeconds = Math.floor(Math.random() * (6 - 3)) + 3
  await new Promise(res => setTimeout(res, delaySeconds * 1000))

  res.end('Order created successfully');
}

const server = http.createServer(async (req, res) => {
  const end = httpRequestDurationMicroseconds.startTimer();
  const route = url.parse(req.url).pathname;
  console.info(`Received request HOST => ${hostname}, ROUTE => ${route}`)
  try {
      if (route === '/metrics') {
        res.setHeader('Content-Type', register.contentType)
        res.end(register.metrics())
      }

      if (route === '/order') {
        await createOrderHandler(req, res)
      }

  } catch (error) {
    res.writeHead(500).end()
  }

  if (!res.finished) {
    res.writeHead(404).end() // Default 404 handler
  }

  end({ route, code: res.statusCode, method: req.method })
})

server.listen(port, () => {
  console.log(`Server is running on http://${hostname}:${port}, metrics are exposed on http://${hostname}:${port}/metrics`)
})
