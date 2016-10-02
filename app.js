const express        = require('express')
const cors           = require('cors')
const bodyParser     = require('body-parser')
const path           = require('path')
const uuid           = require('node-uuid')
const _              = require('lodash')
const winston        = require('winston')
const expressWinston = require('express-winston')
const app            = express()
const validate       = require('./lib/middlewares/validationMiddleware')
const storage        = require('./lib/storage')
const mapping        = require('./mapping')
const samples        = require('./samples')
const render         = require('./lib/render')


app.enable('trust proxy')
app.set('json spaces', 4)
app.use(cors())
app.use(bodyParser.json())
app.use(expressWinston.logger({
    transports: [
        new winston.transports.Console({
            json:     false,
            colorize: true,
        })
    ],
    meta:          false,
    expressFormat: true,
    colorize:      true,
}))

app.get('/', (req, res) => {
    res.sendFile(path.resolve('api.yml'))
})

app.get('/status', (req, res) => {
    res.status(200).json({
        status:   'ok',
        uptime:   `${process.uptime()} second(s)`,
        protocol: req.protocol,
        host:     req.get('host'),
        env:      {
            NODE_ENV: process.NODE_ENV,
        },
    })
})

_.forOwn(mapping, ({ schema }, type) => {
    app.post(`/charts/${type}`, validate(schema), (req, res) => {
        const props = req.payload
        const id    = uuid.v4()
        const url   = `${req.protocol}://${req.get('host')}/r/${id}`

        storage.set(id, {
            type,
            props,
            url,
        })

        res.status(201).json({ id, url })
    })
})

app.get('/r', (req, res) => {
    res.status(200).json(storage.dump())
})

app.get('/r/:id', (req, res) => {
    const { id } = req.params
    const config = storage.get(req.params.id)

    if (!config) {
        return res.status(404).send(`no chart found for id "${id}"`)
    }

    const rendered = render.chart(config, req.query)

    res.status(200).send(rendered)
})

_.forOwn(samples, (config, id) => {
    app.get(`/samples/${id}`, (req, res) => {
        const rendered = render.chart(config, req.query)

        res.status(200).send(rendered)
    })
})

const port = process.env.PORT || 3000
app.listen(port, () => {
    console.log(`nivo api listening on port ${port}`)
})