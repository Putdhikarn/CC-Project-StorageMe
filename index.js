await process.loadEnvFile()

// console.log(`${process.env.AWS_ACCESS_KEY_ID} ${process.env.AWS_SECRET_ACCESS_KEY} ${process.env.AWS_SESSION_TOKEN}`)
import fs from "fs"
import https from "https"
import express from 'express'
import cors from 'cors'
import path from 'path'

import cron from 'node-cron'

import * as db from './services/db.js'
import * as fileStuff from './services/file_stuff.js'

import * as MainRoute from './routes/main.js'
import * as ApiLogin from './routes/login.js'
import * as ApiFile from './routes/file.js'
import * as ApiTag from './routes/tags.js'
import * as ApiShareLink from './routes/sharelink.js'
import * as ApiUserInfo from './routes/user.js'


const pkey = fs.readFileSync('./cert/ccstorageme.key', 'utf8');
const cert = fs.readFileSync('./cert/ccstorageme.crt', 'utf8');

await db.initDBPool();

const app = express()

var httpsServer = https.createServer({key: pkey, cert: cert}, app);

const redirecthttps = (req, res, next) => {
    if (req.secure){
        return next()
    }
    return res.redirect('https://' + req.hostname + req.originalUrl)
}

app.use(redirecthttps)
app.use(express.static(path.join(import.meta.dirname, "./public")))
app.use(express.json())
app.use(cors())

app.use('/api', ApiLogin.router)
app.use('/api', ApiFile.router)
app.use('/api', ApiTag.router)
app.use('/', ApiShareLink.router)
app.use('/api', ApiUserInfo.router)
app.use('/', MainRoute.router)

// schedule a cleanup for temp files
// setInterval(async () => {
//     const currTime = new Date()
//     console.log(`[${currTime}] - Running scheduled temp files cleanup`)
//     fileStuff.doExpiredTempFilesCleanUp(currTime)
// }, 500)

// cron.schedule(process.env.TEMPFILE_CLEANUP_INTERVAL, async () => {
//     const currTime = new Date()
//     console.log(`[${currTime}] - Running scheduled temp files cleanup`)
//     fileStuff.doExpiredTempFilesCleanUp(currTime)
// })

// app.listen(process.env.PORT, () => {
//     console.log(`Server running on http://localhost:${process.env.PORT}`)
// })

httpsServer.listen(process.env.HTTPS_PORT, () => {
    console.log(`Server running on https://localhost`)
})