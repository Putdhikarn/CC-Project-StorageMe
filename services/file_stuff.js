import * as upload from './upload.js'
import * as db from './db.js'
import * as utils from './utils.js'
import * as s3Store from './s3storage.js'

export const deleteRecordOrDecrementStoreObjRef = async (fileRecordId, storageObjectId) => {
    try {
        const strObjInfo = await db.getStorageObjectInfoFromId(storageObjectId)
        // Only delete the file if ref_count is <= 1
        if (strObjInfo[0].ref_count > 1) {
            await db.decrementStorageObjectRefCount(storageObjectId)
            await db.removeAllTagsFromFile(fileRecordId)
            await db.deleteFileRecord(fileRecordId)
        } else {
            if (process.env.USE_S3 == "true"){
                const deleteres = await s3Store.deleteFile(strObjInfo[0].s3_key)
                console.log(deleteres)
            }
            await db.removeAllTagsFromFile(fileRecordId)
            await db.deleteFileRecord(fileRecordId)
            await db.deleteStorageObjectRecord(storageObjectId)
        }
    } 
    catch (err) {
        throw err
    }
} 

export const deleteOrDecrementStoreObjRef = async (storageObjectId) => {
    try {
        const strObjInfo = await db.getStorageObjectInfoFromId(storageObjectId)
                    
        if (strObjInfo[0].ref_count > 1) {
            await db.decrementStorageObjectRefCount(storageObjectId)
        } else {
            if (process.env.USE_S3 == "true"){
                const deleteres = await s3Store.deleteFile(strObjInfo[0].s3_key)
                console.log(deleteres)
            }
            await db.deleteStorageObjectRecord(strObjInfo[0].id)
        }
    } 
    catch (err) {
        throw err
    }
}

export const doExpiredTempFilesCleanUp = async (currTime) => {
    try {
        let delCount = 0
        const exped = await db.getExpiredFileRecords(currTime)
        for (const ex of exped){
            await deleteRecordOrDecrementStoreObjRef(ex.id, ex.storage_object_id)
            delCount++
        }
        console.log(`[${currTime}] - Scheduled temp files cleanup done, deleted : ${delCount} files`)
    } catch (err) {
        console.error(`[${currTime}] - Error`)
        console.error(err)
    }
}