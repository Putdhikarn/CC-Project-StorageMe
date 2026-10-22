import express from 'express'
import * as auth from '../middlewares/auth.js'
import * as upload from '../services/upload.js'
import * as db from '../services/db.js'
import * as utils from '../services/utils.js'
import * as s3Store from '../services/s3storage.js'

export const router = express.Router();

// Get user tags list
router.get('/tags/',  auth.authVerifyJWT, async (req, res, next) => {
    try {
        const lookup = {
            userId: req.requestUserData.userId,
        }
        const tagList = await db.getUserAllTagList(lookup)
        res.status(200).json({
            success : true,
            message : "User tags list",
            data: tagList,
        })
    } catch (err) {
        console.log(err)
        res.status(500).json({
                success : false,
                error : "Unable to get tags listing for user.",
        })
    }
})

// Add tag for user
router.post('/tags/',  auth.authVerifyJWT, async (req, res, next) => {
    const tagData = req.body
    if (!Object.hasOwn(tagData, 'tag_name') || !tagData.tag_name || tagData.tag_name.trim().length <= 0){
        res.status(400).json(
            {
                success : false,
                error : "Fail to Add tag, Missing tag_name in request.",
            }
        )
        return
    }
    try {
        const tagInfo = {
            tagName: tagData.tag_name,
            ownerId: req.requestUserData.userId,
        }
        await db.addTagForUser(tagInfo)
        res.status(200).json({
            success : true,
            message : "Tag added succesfully",
            data: tagInfo.tagName,
        })
    } catch (err) {
        console.log(err)
        res.status(500).json({
                success : false,
                error : "Unable to get tags listing for user.",
        })
    }
})

// Modify tag for user
router.post('/modtags/',  auth.authVerifyJWT, async (req, res, next) => {
    const tagData = req.body
    if (!Object.hasOwn(tagData, 'tag_id') || tagData.tag_id == null){
        res.status(400).json(
            {
                success : false,
                error : "Fail to modify tag, Missing tag_id in request.",
            }
        )
        return
    }
    if (!Object.hasOwn(tagData, 'tag_name') || !tagData.tag_name || tagData.tag_name.trim().length <= 0){
        res.status(400).json(
            {
                success : false,
                error : "Fail to modify tag, Missing tag_name in request.",
            }
        )
        return
    }
    try {
        const lookup = {
            tagId: tagData.tag_id,
            ownerId: req.requestUserData.userId,
        }
        const tagInfo = await db.getTagInfo(lookup)

        if (!tagInfo || tagInfo.length <= 0){
            res.status(404).json(
                {
                    success : false,
                    error : "Fail to modify tag, Tag with that tag_id don't exists for the current user.",
                }
            )
            return
        }
        const newInfo = {
            tagId: tagInfo[0].id,
            tagName: tagData.tag_name
        }
        await db.updateTagInfo(newInfo)

        res.status(200).json({
            success : true,
            message : "Tag succesfully modified",
            data: newInfo.tagName,
        })
    } catch (err) {
        console.log(err)
        if (err.errno == 1062){
            res.status(400).json({
                success : false,
                error : "Unable to modify tag for user, Tag with that name already existed",
            })
        } else {
            res.status(500).json({
                success : false,
                error : "Unable to modify tag for user.",
            })
        }
        
    }
})

// Delete tag for user
router.delete('/tags/',  auth.authVerifyJWT, async (req, res, next) => {
    const tagData = req.body
    if (tagData == null && !Object.hasOwn(tagData, 'tag_id') || tagData.tag_id == null){
        res.status(400).json(
            {
                success : false,
                error : "Fail to delete tag, Missing tag_id in request.",
            }
        )
        return
    }
    try {
        const lookup = {
            tagId: tagData.tag_id,
            ownerId: req.requestUserData.userId,
        }
        const tagInfo = await db.getTagInfo(lookup)

        if (!tagInfo || tagInfo.length <= 0){
            res.status(404).json(
                {
                    success : false,
                    error : "Fail to delete tag, Tag with that tag_id don't exists for the current user.",
                }
            )
            return
        }

        const deleteTagInfo = {
            tagId: tagData.tag_id,
            ownerId: req.requestUserData.userId
        }
        await db.deleteTagForUser(deleteTagInfo)

        res.status(200).json({
            success : true,
            message : "Tag succesfully deleted",
            data: tagData.tag_name,
        })
    } catch (err) {
        console.log(err)
        if (err.errno == 1062){
            res.status(400).json({
                success : false,
                error : "Unable to delete tag for user, Tag with that name already existed",
            })
        } 
        else if (err.errno == 1451){
            res.status(400).json({
                success : false,
                error : "Unable to delete tag for user, There still a files that still use that tag",
            })
        }
        else {
            res.status(500).json({
                success : false,
                error : "Unable to delete tag for user.",
            })
        }
        
    }
})

