import express from 'express'
import * as auth from '../middlewares/auth.js'
import * as upload from '../services/upload.js'
import * as db from '../services/db.js'
import * as utils from '../services/utils.js'
import * as s3Store from '../services/s3storage.js'
import * as fileStuff from '../services/file_stuff.js'

import { createHash, randomBytes } from 'node:crypto';
import { pipeline } from 'node:stream/promises';

import fs from "fs"

export const router = express.Router();

const makeSHA256 = async (filePath) => {
    const hash = createHash("sha256")
    try {
        const stream = fs.createReadStream(filePath);
        await pipeline(stream, hash)
        const hex = hash.digest('hex')
        return hex
    } catch (err) {
        throw err
    }
}

const checkFileExists = async (req, res, next) => {
    try {
        const lookup = {
            ownerId: req.requestUserData.userId,
            fileName: req.file.originalname,
        }
        const fileInfo = await db.getFileInfo(lookup)
        req.oldFileInfo = fileInfo[0]
        next()
    } catch (err) {
        throw err
    }
}

const checkFileExistsId = async (req, res, next) => {
    try {
        const lookup = {
            ownerId: req.requestUserData.userId,
            fileId: req.params.id,
        }
        const fileInfo = await db.getFileInfoId(lookup)
        req.oldFileInfo = fileInfo[0]
        if (!req.oldFileInfo){
            res.status(404).json(utils.MakeErrorJSON("File not found."))
            return
        }
        next()
    } catch (err) {
        throw err
    }
}

// Download file Local
// router.get('/files/download/:id', auth.authVerifyJWT, checkFileExistsId, async (req, res, next) => {
//     if (!req.oldFileInfo){
//         res.status(404).json(utils.MakeErrorJSON("File not found."))
//     } else {
//         const downloadPath = upload.GetDownloadPath(req.oldFileInfo.s3_key)
//         const resDat = {
//             file_name: req.oldFileInfo.file_name,
//             file_size: req.oldFileInfo.file_size,
//         }
//         res.status(200).download(downloadPath, resDat.file_name, (err) => {
//             if (err) {
//                 console.log(err)
//                 res.status(500).json(utils.MakeErrorJSON("Unable to download file."))
//             } else {
                
//             }
//         })
//     }
// })

// Download file from S3
router.post('/files/download/:id', auth.authVerifyJWT, checkFileExistsId, async (req, res, next) => {
    if (!req.oldFileInfo){
        res.status(404).json(utils.MakeErrorJSON("File not found."))
    } else {
        try {
            if (process.env.USE_S3 == "true"){
                const resp = await db.getStorageObjectInfoFromId(req.oldFileInfo.storage_object_id)
                const url = await s3Store.makePresignedURL(resp[0].s3_key, req.oldFileInfo.file_name)
                res.status(200).json(utils.MakeSuccessJSON("Presigned URL for file download.", {url:url}))
            } else {
                res.status(200).json(utils.MakeSuccessJSON("Downloaded file: ", {file: req.oldFileInfo}))
            }
            
        } catch (err) {
            console.log(err)
            res.status(500).json(utils.MakeErrorJSON("Unable to download file."))
        }
    }
})

// Delete file Local Store
// router.delete('/files/:id', auth.authVerifyJWT, checkFileExistsId, async (req, res, next) => {
//     if (!req.oldFileInfo){
//         res.status(404).json(utils.MakeErrorJSON("File not found."))
//     } else {
//         try {
//             await upload.deleteFile(req.oldFileInfo.s3_key)
//             const deleteInfo = await db.deleteFileRecord(req.oldFileInfo.id)

//             res.status(200).json(utils.MakeSuccessJSON("File deleted", {id:req.oldFileInfo.id, file_name: req.oldFileInfo.file_name, file_size: req.oldFileInfo.file_size}))

//         } catch (err) {
//             console.log(err)
//             res.status(500).json(utils.MakeErrorJSON("Unable to delete file."))
//         }
//     }
// })

// Delete file S3
// Delete file (Soft Delete / Move to Trash)
router.delete('/files/:id', auth.authVerifyJWT, checkFileExistsId, async (req, res, next) => {
    if (!req.oldFileInfo){
        res.status(404).json(utils.MakeErrorJSON("File not found."))
    } else {
        try {
            await db.softDeleteFileRecord(req.oldFileInfo.id);
            res.status(200).json(utils.MakeSuccessJSON("File moved to trash.", {id:req.oldFileInfo.id, file_name: req.oldFileInfo.file_name, file_size: req.oldFileInfo.file_size}))
        } catch (err) {
            console.log(err)
            res.status(500).json(utils.MakeErrorJSON("Unable to move file to trash."))
        }
    }
})

// Get user files list
router.get('/files', auth.authVerifyJWT, async (req, res, next) => {
    try {
        let fileListing = null
        if (req.query.file_name == null) {
            const lookup = {
                ownerId: req.requestUserData.userId,
            }
            fileListing = await db.getUserAllFilesList(lookup)
            fileListing = await Promise.all(fileListing.map(async (f) => ({ ...f, file_tags: await db.getFilesTags(f.id) })))
        } else {
            const lookup = {
                ownerId: req.requestUserData.userId,
                fileName: req.query.file_name
            }
            fileListing = await db.getUserAllFilesListWithName(lookup)
            fileListing = await Promise.all(fileListing.map(async (f) => ({ ...f, file_tags: await db.getFilesTags(f.id) })))
        }
        
        res.status(200).json({
            success : true,
            message : "User file listing",
            data: fileListing,
        })
    } catch (err) {
        // throw err
        console.log(err)
        res.status(500).json({
                success : false,
                error : "Unable to get file listing for user.",
        })
    }
})

// Get user files list with tag
router.get('/files/tags/', auth.authVerifyJWT, async (req, res, next) => {
    try {
        if (req.query.tags == null) {
            res.status(400).json(
                {
                    success : false,
                    error : "Failed to get files, Missing tags in query request.",
                }
            )
            return
        }
        if (req.query.match_type == null || !['any','all'].includes(req.query.match_type)) {
            res.status(400).json(
                {
                    success : false,
                    error : "Failed to get files, Missing match_type in query request.",
                }
            )
            return
        }
        const lookup = {
            ownerId: req.requestUserData.userId,
            fileTags: req.query.tags,
            matchType: req.query.match_type
        }
        if (!Array.isArray(lookup.fileTags)){
            lookup.fileTags = [lookup.fileTags]
        }
        const fileListing = await db.getUserAllFilesListWithTags(lookup)
        res.status(200).json({
            success : true,
            message : "User file listing",
            data: fileListing,
        })
    } catch (err) {
        // throw err
        console.log(err)
        res.status(500).json({
                success : false,
                error : "Unable to get file listing for user.",
        })
    }
})

// Rename file
router.post('/files/name/:id', auth.authVerifyJWT, checkFileExistsId, async (req, res, next) => {
    const renameData = req.body
    if (!Object.hasOwn(renameData, 'new_filename') || !renameData.new_filename == null || renameData.new_filename.length <= 0){
        res.status(400).json(
            {
                success : false,
                error : "Failed to rename file, Missing new_filename in request.",
            }
        )
        return
    }
    try {
        const renameInfo = {
            fileId: req.oldFileInfo.id,
            fileName: renameData.new_filename
        }
        await db.setFileNewName(renameInfo)
        res.status(200).json(utils.MakeSuccessJSON("File renamed.", {id:req.oldFileInfo.id, file_name: renameInfo.fileName}))
    } catch (err) {
        console.log(err)
        if (err.code = 'ERR_DUPE_ENTRY') {
            res.status(400).json(utils.MakeErrorJSON("Unable to rename file, File with that name already exists.", err.errno))
        } else {
            res.status(500).json(utils.MakeErrorJSON("Unable to rename file."))
        }
    }
    
})

// Upload path
// Upload path (รวมระบบ Deduplication เดิม + Versioning ของคุณเข้าไปแบบเบ็ดเสร็จ)
router.post('/files', auth.authVerifyJWT, upload.upload.single("file"), checkFileExists, async (req, res, next) => {
    try {
        const fileExpDate = typeof req.body.expire_at !== "undefined" ? new Date(req.body.expire_at) : null
        if (!req.file) {
            res.status(400).json(
                { 
                    success : false,
                    error: "Upload Failed, No File provided."
                }
            )
            return
        }
        // upload to s3
        const checksum = await makeSHA256(req.file.path)
        const checksumDuplicate = await db.getStorageObjectInfo(checksum)
        const s3key = await s3Store.makeS3key(req.requestUserData.userId)
        
        // เช็กว่าเป็นไฟล์เก่าที่เคยอัปโหลดไว้ไหม เพื่อทำ Versioning
        const lookup = { ownerId: req.requestUserData.userId, fileName: req.file.originalname };
        const existingFiles = await db.getFileInfo(lookup);
        const isUpdate = existingFiles && existingFiles.length > 0;
        const oldStorageObjId = isUpdate ? existingFiles[0].storage_object_id : null;

        let store_obj_id = -1
        if (checksumDuplicate.length <= 0){
            if (process.env.USE_S3 == "true"){
                await s3Store.upload(req.file, s3key)
            }

            const storeObjectInfo = {
                checksum: checksum,
                s3Key: s3key,
                fileSize: req.file.size,
                uploadDate: new Date(),
            }
            const resp = await db.addStorageObjectInfo(storeObjectInfo)
            store_obj_id = resp.insertId
        } else {
            store_obj_id = checksumDuplicate[0].id
            if (!req.oldFileInfo) {
                await db.incrementStorageObjectRefCount(store_obj_id)
            } else {
                if (req.oldFileInfo && req.oldFileInfo.storage_object_id != store_obj_id) {
                    await db.incrementStorageObjectRefCount(store_obj_id)
                }
            }
        }

        // update file meta data
        try {
            const fileInfo = {
                ownerId: req.requestUserData.userId,
                fileName: req.file.originalname,
                storageObjectId: store_obj_id,
                fileSize: req.file.size,
                mimetype: req.file.mimetype,
                uploadDate: new Date(),
                expireAt: fileExpDate,
                checksum: checksum,
            }
            await db.updateFileInfo(fileInfo)

            // 👇👇 บันทึกประวัติ Versioning (ฟีเจอร์ของคุณ) ลงตรงนี้เลย 👇👇
            const updatedFiles = await db.getFileInfo(lookup);
            const fileId = updatedFiles[0].id;

            if (!isUpdate) {
                // อัปโหลดไฟล์นี้ครั้งแรก -> จด Version 1
                await db.addFileVersion(fileId, store_obj_id, 1);
            } else if (oldStorageObjId !== store_obj_id) {
                // อัปโหลดทับชื่อเดิม แต่เนื้อหาเปลี่ยน (Checksum ไม่ซ้ำ) -> รัน Version ถัดไป
                const maxV = await db.getMaxFileVersion(fileId);
                await db.addFileVersion(fileId, store_obj_id, maxV + 1);
            }
            // 👆👆 ------------------------------------------------ 👆👆

        } catch (err) {
            throw err
        }

        // ปิดการลบไฟล์เก่าทิ้ง เพื่อให้เก็บประวัติ Version ไว้ได้ (ไม่ให้ S3 พังและเก็บ ref ได้ถูกต้อง)
        if (req.oldFileInfo && req.oldFileInfo.storage_object_id != store_obj_id) {
            try {
                // เรียกใช้เฉพาะตอนลด Ref Count ของก้อนเก่า แต่ไม่ลบประวัติทิ้ง
                if (typeof fileStuff.deleteOrDecrementStoreObjRef === 'function') {
                    // ป้องกันไม่ให้ลบ record เด็ดขาดเพื่อให้ Version History ยังอ้างอิงถึงได้
                    const oldObjInfo = await db.getStorageObjectInfoFromId(req.oldFileInfo.storage_object_id);
                    if (oldObjInfo && oldObjInfo.length > 0) {
                        if (oldObjInfo[0].ref_count > 1) {
                            await db.decrementStorageObjectRefCount(req.oldFileInfo.storage_object_id);
                        }
                    }
                }
            } catch (err) {
                console.log("Ref count adjustment note:", err);
            }
        }

        // delete the temporary file on local disk
        await upload.deleteFileAbsolute(req.file.path)
        
        // upload success
        res.status(200).send({
                success : true,
                message : "File Uploaded Successfully with Versioning",
                data : {
                    fileInfo: req.file,
                    checksum: checksum,
                }
        })

    } catch (err) {
        console.log(err)
        if (req.file && req.file.path){
            await upload.deleteFileAbsolute(req.file.path)
        }
        res.status(500).json({
                success : false,
                error : "File Upload Failed, " + err,
        })
    }
})

// get file's tags 
router.get('/file/:id/tags/', auth.authVerifyJWT, checkFileExistsId, async (req, res, next) => {
    try {
        const fileTags = await db.getFilesTags(req.params.id)
        res.status(200).json({
            success : true,
            message : "Tags succesfully added to file",
            data: fileTags,
        })
    } catch (err) {
        console.log(err)
        res.status(500).json({
            success : false,
            error : "Failed to Add tags to file.",
        })
    }
})


// Add tags to file
router.post('/file/:id/addtag/', auth.authVerifyJWT, checkFileExistsId, async (req, res, next) => {
    const tagData = req.body
    if (!Object.hasOwn(tagData, 'tag_to_add') || !tagData.tag_to_add == null || tagData.tag_to_add.length <= 0){
        res.status(400).json(
            {
                success : false,
                error : "Failed to Add tags to file, Missing tag_to_add in request.",
            }
        )
        return
    }
    try {
        let toAdd = []
        for (const tg of tagData.tag_to_add){
            toAdd.push([tg, req.params.id])
        }
        await db.addTagsToFile(toAdd)
        res.status(200).json({
            success : true,
            message : "Tags succesfully added to file",
            data: toAdd,
        })
    } catch (err) {
        console.log(err)
        if (err.code == "ER_DUP_ENTRY"){
            res.status(400).json({
                success : false,
                error : "Failed to Add tags to file, Tag already added to file",
            })
        } else if (err.code == "ER_NO_REFERENCED_ROW_2"){
            res.status(400).json({
                success : false,
                error : "Failed to Add tags to file, Tag or file don't exist",
            })
        } 
        else {
            res.status(500).json({
                success : false,
                error : "Failed to Add tags to file.",
            })
        }
    }
})

// Remove tag from files
router.post('/file/:id/rmtag/',  auth.authVerifyJWT, checkFileExistsId, async (req, res, next) => {
    const tagData = req.body
    if (!Object.hasOwn(tagData, 'tag_to_rm') || !tagData.tag_to_rm == null){
        res.status(400).json(
            {
                success : false,
                error : "Fail to Remove tag, Missing tag_to_rm in request.",
            }
        )
        return
    }
    try {
        const tagInfo = {
            tagId: tagData.tag_to_rm,
            fileId: req.params.id,
        }
        await db.removeTagFromFile(tagInfo)
        res.status(200).json({
            success : true,
            message : "Tag Removed succesfully",
            data: tagInfo.tagName,
        })
    } catch (err) {
        console.log(err)
        res.status(500).json({
                success : false,
                error : "Failed to Remove tag from file.",
        })
    }
})



// -------------------------------------------------------------------------
// NEW ROUTE: Get Version History & Rollback 
// -------------------------------------------------------------------------
router.get('/files/versions/:id', auth.authVerifyJWT, checkFileExistsId, async (req, res) => {
    try {
        const history = await db.getFileVersionsHistory(req.oldFileInfo.id);
        res.status(200).json(utils.MakeSuccessJSON("File version history retrieved.", { 
            fileName: req.oldFileInfo.file_name,
            currentStorageId: req.oldFileInfo.storage_object_id,
            history: history 
        }));
    } catch (err) {
        console.error("Get Versions Failed:", err);
        res.status(500).json(utils.MakeErrorJSON("Unable to fetch version history."));
    }
});

router.post('/files/rollback/:id', auth.authVerifyJWT, checkFileExistsId, async (req, res) => {
    try {
        const { targetVersion } = req.body;
        if (!targetVersion) return res.status(400).json(utils.MakeErrorJSON("Missing targetVersion."));

        const history = await db.getFileVersionsHistory(req.oldFileInfo.id);
        const targetData = history.find(v => v.version === parseInt(targetVersion));

        if (!targetData) return res.status(404).json(utils.MakeErrorJSON("Target version not found."));

        // 1. สลับไฟล์หลักให้ชี้กลับไปหา Object ต้นฉบับ
        await db.rollbackFileToVersion(req.oldFileInfo.id, targetData.storage_object_id);
        
        // 2. บันทึกการย้อนเวลาเป็นเวอร์ชันใหม่สุด
        const maxV = await db.getMaxFileVersion(req.oldFileInfo.id);
        await db.addFileVersion(req.oldFileInfo.id, targetData.storage_object_id, maxV + 1);
        
        // 3. เพิ่ม Ref Count เพราะมี Version อ้างอิงถึง Storage Object นี้เพิ่มขึ้น
        await db.incrementStorageObjectRefCount(targetData.storage_object_id);

        res.status(200).json(utils.MakeSuccessJSON(`Successfully rolled back to version ${targetVersion}.`, { newVersion: maxV + 1 }));
    } catch (err) {
        console.error("Rollback Failed:", err);
        res.status(500).json(utils.MakeErrorJSON("Unable to rollback file."));
    }
});

// -------------------------------------------------------------------------
// FEATURE 3: One-Time Burn Link (Download & Self-Destruct)
// -------------------------------------------------------------------------
router.post('/files/share-burn/:id', auth.authVerifyJWT, checkFileExistsId, async (req, res) => {
    try {
        const burnToken = randomBytes(24).toString('hex');

        if (typeof db.createBurnLink === 'function') {
            await db.createBurnLink(burnToken, req.oldFileInfo.id);
        }

        const downloadUrl = `${req.protocol}://${req.get('host')}/api/files/burn/${burnToken}`;
        res.status(200).json(utils.MakeSuccessJSON("One-Time Burn Link created.", {
            burnToken: burnToken,
            downloadUrl: downloadUrl,
            expiresNote: "Will self-destruct immediately after first download."
        }));
    } catch (err) {
        console.error("Create Burn Link Failed:", err);
        res.status(500).json(utils.MakeErrorJSON("Unable to create burn link."));
    }
});

router.get('/files/burn/:token', async (req, res) => {
    try {
        const { token } = req.params;
        let fileRecord = null;

        if (typeof db.getAndBurnLink === 'function') {
            fileRecord = await db.getAndBurnLink(token);
        }

        if (!fileRecord) {
            return res.status(404).json(utils.MakeErrorJSON("Link has already burned or does not exist."));
        }

        if (process.env.USE_S3 === "true") {
            const storageObj = await db.getStorageObjectInfoFromId(fileRecord.storage_object_id);
            if (storageObj && storageObj.length > 0) {
                const downloadUrl = await s3Store.makePresignedURL(storageObj[0].s3_key, fileRecord.file_name);
                return res.redirect(downloadUrl);
            }
        }

        res.status(200).json(utils.MakeSuccessJSON("Burn link consumed successfully.", { file: fileRecord }));
    } catch (err) {
        console.error("Burn Link Access Failed:", err);
        res.status(500).json(utils.MakeErrorJSON("Failed to access burn link."));
    }
});

// -------------------------------------------------------------------------
// FEATURE: Soft Delete / Trash Bin & Restore
// -------------------------------------------------------------------------
// -------------------------------------------------------------------------
// FEATURE: Soft Delete / Trash Bin, Restore & Permanent Delete
// -------------------------------------------------------------------------
router.get('/files/trash', auth.authVerifyJWT, async (req, res) => {
    try {
        const trashFiles = await db.getTrashFilesList(req.requestUserData.userId);
        res.status(200).json(utils.MakeSuccessJSON("Trash bin file listing.", { data: trashFiles }));
    } catch (err) {
        console.error("Get Trash Failed:", err);
        res.status(500).json(utils.MakeErrorJSON("Unable to get trash listing."));
    }
});

router.post('/files/restore/:id', auth.authVerifyJWT, async (req, res) => {
    try {
        const fileId = req.params.id;
        await db.restoreFileFromTrash(fileId, req.requestUserData.userId);
        res.status(200).json(utils.MakeSuccessJSON("File restored successfully from trash.", { fileId }));
    } catch (err) {
        console.error("Restore File Failed:", err);
        res.status(500).json(utils.MakeErrorJSON("Unable to restore file."));
    }
});

// 👉 เพิ่มใหม่ (ไม่ไปยุ่งกับของเดิม): ลบไฟล์ถาวรรายไฟล์
router.delete('/files/permanent/:id', auth.authVerifyJWT, async (req, res) => {
    try {
        const fileId = req.params.id;
        const userId = req.requestUserData.userId;

        const result = await db.permanentDeleteFileRecord(fileId, userId);
        
        if (result.affectedRows === 0) {
            return res.status(404).json(utils.MakeErrorJSON("File not found or unauthorized."));
        }

        res.status(200).json(utils.MakeSuccessJSON("File permanently deleted.", { id: fileId }));
    } catch (err) {
        console.error("Permanent Delete Failed:", err);
        res.status(500).json(utils.MakeErrorJSON("Unable to permanently delete file."));
    }
});

// 👉 เพิ่มใหม่ (ไม่ไปยุ่งกับของเดิม): ล้างถังขยะทั้งหมด (Empty Trash)
router.delete('/files/trash/empty', auth.authVerifyJWT, async (req, res) => {
    try {
        const userId = req.requestUserData.userId;
        const result = await db.emptyTrashFiles(userId);

        res.status(200).json(utils.MakeSuccessJSON("Trash bin emptied successfully.", { 
            deletedCount: result.affectedRows 
        }));
    } catch (err) {
        console.error("Empty Trash Failed:", err);
        res.status(500).json(utils.MakeErrorJSON("Unable to empty trash bin."));
    }
});