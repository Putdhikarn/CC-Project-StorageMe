import express from 'express'
import * as auth from '../middlewares/auth.js'
import * as db from '../services/db.js'
import * as utils from '../services/utils.js'
import * as s3Store from '../services/s3storage.js'
import * as fileStuff from '../services/file_stuff.js'
import argon2 from 'argon2'

export const router = express.Router();

const checkFileExistsId = async (req, res, next) => {
    try {
        const lookup = {
            ownerId: req.requestUserData.userId,
            fileId: req.params.id,
        }
        const fileInfo = await db.getFileInfoId(lookup)
        req.oldFileInfo = fileInfo[0]
        next()
    } catch (err) {
        throw err
    }
}

// get file's all sharable download links
router.get('/api/files/download-link/:id', auth.authVerifyJWT, checkFileExistsId, async (req, res, next) => {
    if (!req.oldFileInfo){
        res.status(404).json(utils.MakeErrorJSON("File not found."))
    } else {
        try {
            const links = await db.getFileDownloadLinkRecord(req.oldFileInfo.id)
            let allLinks = []
            links.forEach(element => {
                allLinks.push(
                    {
                        token: element.token,
                        max_downloads: element.max_downloads,
                        download_count: element.download_count,
                        has_password: element.password_hash != null,
                        expire_at: element.expire_at,
                        created_at: element.created_at
                    }
                )
            });
            res.status(200).json(utils.MakeSuccessJSON("Sharable links for file download.", 
                {
                    links: allLinks,
                }
            ))
        } catch (err) {
            console.log(err)
            res.status(500).json(utils.MakeErrorJSON("Unable to get download link for file."))
        }
    }
})

// revoke a file's sharable download link
router.delete('/api/files/download-link/:id', auth.authVerifyJWT, checkFileExistsId, async (req, res, next) => {
    if (!req.oldFileInfo){
        res.status(404).json(utils.MakeErrorJSON("File not found."))
    } else {
        const linkRevokeToken = req.body.token
        if (!linkRevokeToken || linkRevokeToken == null) {
            res.status(400).json(utils.MakeErrorJSON("Unable to revoke download link for file, missing token to revoke."))
            return
        }
        try {
            await db.removeFileDownloadLinkRecord(linkRevokeToken)
            res.status(200).json(utils.MakeSuccessJSON("Download link revoked for file.", 
                {
                    fileId: req.oldFileInfo.id,
                }
            ))

        } catch (err) {
            console.log(err)
            res.status(500).json(utils.MakeErrorJSON("Unable to revoke download link for file."))
        }
    }
})

// Make a sharable download link
router.post('/api/files/download-link/:id', auth.authVerifyJWT, checkFileExistsId, async (req, res, next) => {
    if (!req.oldFileInfo){
        res.status(404).json(utils.MakeErrorJSON("File not found."))
    } else {
        const linkData = req.body
        if (!linkData || linkData == null) {
            res.status(400).json(utils.MakeErrorJSON("Unable to make download link for file, bad link request."))
            return
        }

        const linkExpDate = Object.hasOwn(linkData, 'expire_at') ? new Date(linkData.expire_at) : null
        const linkPassword = Object.hasOwn(linkData, 'password') ? `${linkData.password}` : null
        const linkMaxDownload = Object.hasOwn(linkData, 'max_downloads') ? linkData.max_downloads : null

        try {
            let pHash = null
            if (linkPassword != null){
                pHash = await argon2.hash(linkPassword)
            }

            const linkRecordData = {
                fileId: req.params.id,
                token: crypto.randomUUID(),
                maxDownload: linkMaxDownload,
                passwordHash: pHash,
                expireAt: linkExpDate,
            }

            await db.addDownloadLinkRecord(linkRecordData)
            
            const downloadLink = `/files/shared/download/${linkRecordData.token}`
            res.status(200).json(utils.MakeSuccessJSON("Sharable link for file download.", 
                {
                    link: downloadLink,
                    linkExpDate: linkExpDate,
                    linkMaxDownload: linkMaxDownload,
                    hasPassword: pHash ? true : false
                }
            ))

        } catch (err) {
            console.log(err)
            res.status(500).json(utils.MakeErrorJSON("Unable to make download link for file."))
        }
    }
})

// get file's info from the sharable download link
router.post('/api/files/shared/download/info/:uuidtoken', async (req, res, next) => {
    const linkToken = req.params.uuidtoken
    let linkDownloadPass = req.body && Object.hasOwn(req.body, 'download_password') ? req.body.download_password : null
    if (!linkToken || linkToken == null) {
        res.status(400).json(utils.MakeErrorJSON("Invalid download link, File with that download link do not exist."))
        return
    }

    try {

        const linkData = await db.getFileDownloadLinkDataFromToken(linkToken)

        if (linkData.length <= 0){
            res.status(404).json(utils.MakeErrorJSON("Invalid get info link, File with that download link do not exist or has expired."))
            return
        }

        if (linkData[0].max_downloads != null && linkData[0].download_count >= linkData[0].max_downloads) {
            res.status(404).json(utils.MakeErrorJSON("Invalid get info link, File with that download link do not exist or has expired."))
            return
        }

        // link is password protected, redirect to enter password
        // console.log(`${linkData[0].password_hash} ${linkDownloadPass}`)
        if (linkData[0].password_hash != null ){
            if (linkData[0].password_hash != '' && (linkDownloadPass == null || linkDownloadPass == '')){
                res.status(401).json(utils.MakeErrorJSON("Need password to download this file.", 67))
                return
            } else {
                if (await argon2.verify(linkData[0].password_hash, linkDownloadPass)){

                } else {
                    res.status(401).json(utils.MakeErrorJSON("Invalid password for this file.", 68))
                    return
                }
            }
            
        }
        // res.status(200).json(utils.MakeSuccessJSON("Presigned URL for file download.", {url:linkData[0]}))
        const lookup = {
            fileId: linkData[0].file_id,
        }
        const fileData = await db.getFileInfoOnlyId(lookup)

        if (fileData.length <= 0){
            res.status(404).json(utils.MakeErrorJSON("File not found."))
            return
        }

        if (process.env.USE_S3 == "true"){
            const resp = await db.getStorageObjectInfoFromId(fileData[0].storage_object_id)
            // const url = await s3Store.makePresignedURL(resp[0].s3_key)

            res.status(200).json(utils.MakeSuccessJSON("File info.", {file_name: fileData[0].file_name, file_size: fileData[0].file_size}))
            // await db.incrementFileDownloadLinkCount(linkToken)
        } else {
            
            res.status(200).json(utils.MakeSuccessJSON("Downloaded file: ", {file: fileData[0]}))
            // await db.incrementFileDownloadLinkCount(linkToken)
        }
    } catch (err) {
        console.log(err)
        res.status(500).json(utils.MakeErrorJSON("Unable to get file info from that link."))
    }
})

// Download a file from the sharable download link
router.post('/api/files/shared/download/:uuidtoken', async (req, res, next) => {
    const linkToken = req.params.uuidtoken
    let linkDownloadPass = req.body && Object.hasOwn(req.body, 'download_password') ? req.body.download_password : null
    if (!linkToken || linkToken == null) {
        res.status(400).json(utils.MakeErrorJSON("Invalid download link, File with that download link do not exist."))
        return
    }

    try {

        const linkData = await db.getFileDownloadLinkDataFromToken(linkToken)

        if (linkData.length <= 0){
            res.status(404).json(utils.MakeErrorJSON("Invalid download link, File with that download link do not exist or has expired."))
            return
        }

        if (linkData[0].max_downloads != null && linkData[0].download_count >= linkData[0].max_downloads) {
            res.status(404).json(utils.MakeErrorJSON("Invalid download link, File with that download link do not exist or has expired."))
            return
        }

        // link is password protected, redirect to enter password
        // console.log(`${linkData[0].password_hash} ${linkDownloadPass}`)
        if (linkData[0].password_hash != null ){
            if (linkData[0].password_hash != '' && (linkDownloadPass == null || linkDownloadPass == '')){
                res.status(401).json(utils.MakeErrorJSON("Need password to download this file.", 67))
                return
            } else {
                if (await argon2.verify(linkData[0].password_hash, linkDownloadPass)){

                } else {
                    res.status(401).json(utils.MakeErrorJSON("Invalid password for this file.", 68))
                    return
                }
            }
            
        }
        // res.status(200).json(utils.MakeSuccessJSON("Presigned URL for file download.", {url:linkData[0]}))
        const lookup = {
            fileId: linkData[0].file_id,
        }
        const fileData = await db.getFileInfoOnlyId(lookup)

        if (fileData.length <= 0){
            res.status(404).json(utils.MakeErrorJSON("File not found."))
            return
        }

        if (process.env.USE_S3 == "true"){
            const resp = await db.getStorageObjectInfoFromId(fileData[0].storage_object_id)
            const url = await s3Store.makePresignedURL(resp[0].s3_key)

            res.status(200).json(utils.MakeSuccessJSON("Presigned URL for file download.", {file_name: fileData[0].file_name, file_size: fileData[0].file_size, url:url}))
            await db.incrementFileDownloadLinkCount(linkToken)
        } else {
            
            res.status(200).json(utils.MakeSuccessJSON("Downloaded file: ", {file: fileData[0]}))
            await db.incrementFileDownloadLinkCount(linkToken)
        }
    } catch (err) {
        console.log(err)
        res.status(500).json(utils.MakeErrorJSON("Unable to download file from that link."))
    }
})