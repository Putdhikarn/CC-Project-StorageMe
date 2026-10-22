import express from 'express'
import * as auth from '../middlewares/auth.js'
import * as upload from '../services/upload.js'
import * as db from '../services/db.js'
import * as utils from '../services/utils.js'
import * as s3Store from '../services/s3storage.js'
import * as fileStuff from '../services/file_stuff.js'
import argon2 from 'argon2'

export const router = express.Router();

// get user info
router.get('/userinfo', auth.authVerifyJWT, async (req, res) => {
    try {
        const userInfo = await db.getUserInfoUserView(req.requestUserData.userEmail)
        res.status(200).json(utils.MakeSuccessJSON("User info", userInfo))
    } catch (err) {
        console.log(err)
        res.status(500).json(utils.MakeErrorJSON("User get info Failed."))
        return
    }
})

// set user new email
router.post('/userinfo/email', auth.authVerifyJWT, async (req, res) => {
    try {
        const userReq = req.body
        // validate request
        if (userReq == null){
            res.status(400).json(utils.MakeErrorJSON("User Set new email Failed, Missing request body."))
            return
        }
        if (!Object.hasOwn(userReq, 'old_email') || !userReq.old_email || userReq.old_email.trim().length <= 0){
            res.status(400).json(utils.MakeErrorJSON("User Set new email Failed, Missing old_email in request."))
            return
        }
        if (!Object.hasOwn(userReq, 'new_email') || !userReq.new_email || userReq.new_email.trim().length <= 0){
            res.status(400).json(utils.MakeErrorJSON("User Set new email Failed, Missing new_email in request."))
            return
        }
        if (!Object.hasOwn(userReq, 'password') || !userReq.password || userReq.password.trim().length <= 0){
            res.status(400).json(utils.MakeErrorJSON("User Set new email Failed, Missing password in request."))
            return
        }
        if (req.requestUserData.userEmail != userReq.old_email){
            res.status(401).json(utils.MakeErrorJSON("User Authentication Failed, Missing or invalid request token."))
            return
        }

        let userData = await db.getUserInfo(userReq.old_email)
        if (!userData || userData.length <= 0 || !Object.hasOwn(userData[0], 'password')){
            res.status(400).json(utils.MakeErrorJSON("User Set new email Failed, Invalid old_email in request."))
            return
        }
        if (await argon2.verify(userData[0].password, userReq.password)) {
            await db.setUserNewEmail(userReq.old_email, userReq.new_email)
            res.status(200).json({
                success: true,
                message: "User new email set.",
                data: {
                    newEmail: userReq.new_email
                },
            })
        } else {
            res.status(403).json(utils.MakeErrorJSON("User Set new email Failed, Invalid password."))
            return
        }
    } catch (err) {
        // throw err
        console.log(err)
        if (err.code == "ER_DUP_ENTRY") {
            res.status(400).json(utils.MakeErrorJSON("User Set new email Failed, That email is already in use."))
            return
        }
        res.status(500).json(utils.MakeErrorJSON("User Set new email Failed."))
        return
    }
})

// set user new username
router.post('/userinfo/username', auth.authVerifyJWT, async (req, res) => {
    try {
        const userReq = req.body
        // validate request
        if (userReq == null){
            res.status(400).json(utils.MakeErrorJSON("User Set new username Failed, Missing request body."))
            return
        }
        if (!Object.hasOwn(userReq, 'email') || !userReq.email || userReq.email.trim().length <= 0){
            res.status(400).json(utils.MakeErrorJSON("User Set new username Failed, Missing email in request."))
            return
        }
        if (!Object.hasOwn(userReq, 'new_username') || !userReq.new_username || userReq.new_username.trim().length <= 0){
            res.status(400).json(utils.MakeErrorJSON("User Set new username Failed, Missing new_username in request."))
            return
        }
        if (!Object.hasOwn(userReq, 'password') || !userReq.password || userReq.password.trim().length <= 0){
            res.status(400).json(utils.MakeErrorJSON("User Set new username Failed, Missing password in request."))
            return
        }
        if (req.requestUserData.userEmail != userReq.email){
            res.status(401).json(utils.MakeErrorJSON("User Authentication Failed, Missing or invalid request token."))
            return
        }

        let userData = await db.getUserInfo(userReq.email)
        if (!userData || userData.length <= 0 || !Object.hasOwn(userData[0], 'password')){
            res.status(400).json(utils.MakeErrorJSON("User Set new username Failed, Invalid email in request."))
            return
        }
        if (await argon2.verify(userData[0].password, userReq.password)) {
            await db.setUserNewUsername(userReq.new_username, userReq.email)
            res.status(200).json({
                success: true,
                message: "User new username set.",
                data: {
                    newUsername: userReq.new_username
                },
            })
        } else {
            res.status(403).json(utils.MakeErrorJSON("User Set new username Failed, Invalid password."))
            return
        }
    } catch (err) {
        // throw err
        console.log(err)
        if (err.code == "ER_DUP_ENTRY") {
            res.status(400).json(utils.MakeErrorJSON("User Set new username Failed, That username is already in use."))
            return
        }
        res.status(500).json(utils.MakeErrorJSON("User Set new username Failed."))
        return
    }
})

// set user new password
router.post('/userinfo/password', auth.authVerifyJWT, async (req, res) => {
    try {
        const userReq = req.body
        // validate request
        if (userReq == null){
            res.status(400).json(utils.MakeErrorJSON("User Set new email Failed, Missing request body."))
            return
        }
        if (!Object.hasOwn(userReq, 'email') || !userReq.email || userReq.email.trim().length <= 0){
            res.status(400).json(utils.MakeErrorJSON("User Set new password Failed, Missing email in request."))
            return
        }
        if (!Object.hasOwn(userReq, 'old_password') || !userReq.old_password || userReq.old_password.trim().length <= 0){
            res.status(400).json(utils.MakeErrorJSON("User Set new password Failed, Missing old_password in request."))
            return
        }
        if (!Object.hasOwn(userReq, 'new_password') || !userReq.new_password || userReq.new_password.trim().length <= 0){
            res.status(400).json(utils.MakeErrorJSON("User Set new password Failed, Missing new_password in request."))
            return
        }
        if (req.requestUserData.userEmail != userReq.email){
            res.status(401).json(utils.MakeErrorJSON("User Authentication Failed, Missing or invalid request token."))
            return
        }

        let userData = await db.getUserInfo(userReq.email)
        if (!userData || userData.length <= 0 || !Object.hasOwn(userData[0], 'password')){
            res.status(400).json(utils.MakeErrorJSON("User Set new password Failed, Invalid email in request."))
            return
        }
        if (await argon2.verify(userData[0].password, userReq.old_password)) {

            // hash password
            let hash = ""
            try {
                hash = await argon2.hash(userReq.new_password)
            } catch (err) {
                res.status(400).json(
                    {
                        success : false,
                        error : "User Set new password Failed, Invalid new password.",
                    }
                )
                return
            }
            
            if (hash.length <= 0){
                res.status(500).json(
                    {
                        success : false,
                        error : "User Set new password Failed, Unable to process new password.",
                    }
                )
                return
            }


            await db.setUserNewPassword(hash, userReq.email)
            res.status(200).json({
                success: true,
                message: "User new password set.",
                data: {
                },
            })
        } else {
            res.status(403).json(utils.MakeErrorJSON("User Set new password Failed, Invalid password."))
            return
        }
    } catch (err) {
        // throw err
        console.log(err)
        res.status(500).json(utils.MakeErrorJSON("User Set new password Failed."))
        return
    }
})