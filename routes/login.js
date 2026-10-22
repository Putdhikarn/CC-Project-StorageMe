import express from 'express'
import argon2 from 'argon2'
import jwt from 'jsonwebtoken'
import * as db from '../services/db.js'

export const router = express.Router();

router.post('/register', async (req, res) => {
    const regData = req.body
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    // validate request
    if (regData == null){
        res.status(400).json(
            {
                success : false,
                error : "User Registration Failed, Missing request body.",
            }
        )
        return
    }
    if (!Object.hasOwn(regData, 'username') || !regData.username || regData.username.trim().length <= 0){
        res.status(400).json(
            {
                success : false,
                error : "User Registration Failed, Missing username in request.",
            }
        )
        return
    }
    if (!Object.hasOwn(regData, 'email') || !regData.email || regData.email.trim().length <= 0){
        res.status(400).json(
            {
                success : false,
                error : "User Registration Failed, Missing email in request.",
            }
        )
        return
    }
    if (!emailRegex.test(regData.email)){
        res.status(400).json(
            {
                success : false,
                error : "User Registration Failed, Email is not a valid email.",
            }
        )
        return
    }
    if (!Object.hasOwn(regData, 'password') || !regData.password || regData.password.trim().length <= 0){
        res.status(400).json(
            {
                success : false,
                error : "User Registration Failed, Missing password in request.",
            }
        )
        return
    }
    // hash password
    let hash = ""
    try {
        hash = await argon2.hash(regData.password)
    } catch (err) {
        res.status(500).json(
            {
                success : false,
                error : "User Registration Failed, Unable to process password.",
            }
        )
        return
    }
    
    if (hash.length <= 0){
        res.status(500).json(
            {
                success : false,
                error : "User Registration Failed, Unable to process password.",
            }
        )
        return
    }

    // put user in db
    const dbData = {
        username: regData.username,
        email: regData.email,
        password: hash,
    }
    try {
        await db.addUserInfo(dbData)
    } catch (err) {
        if (err.code == 'ER_DUP_ENTRY'){
            res.status(400).json(
            {
                success : false,
                error : "User Registration Failed, Username or Email already exist.",
            }
        )
        return
        }
    }

    const data = {
        success: true,
        message : "User Registration successful.",
        data : {
            username: regData.username,
            email: regData.email,
        }
    }
    res.status(200).json(data)
})

router.post('/login', async (req, res) => {
    const loginData = req.body
    // validate request
    if (loginData == null){
        res.status(400).json(
            {
                success : false,
                error : "User Login Failed, Missing request body.",
            }
        )
        return
    }
    if (!Object.hasOwn(loginData, 'email') || !loginData.email || loginData.email.trim().length <= 0){
        res.status(400).json(
            {
                success : false,
                error : "User Login Failed, Missing email in request.",
            }
        )
        return
    }
    if (!Object.hasOwn(loginData, 'password') || !loginData.password || loginData.password.trim().length <= 0){
        res.status(400).json(
            {
                success : false,
                error : "User Login Failed, Missing password in request.",
            }
        )
        return
    }
    // get user info
    let userData;
    try {
        userData = await db.getUserInfo(loginData.email)
        if (userData.length <= 0) {
            res.status(401).json(
                {
                    success : false,
                    error : "User Login Failed, Incorrect email or password.",
                }
            )
            return
        }
    } catch {
        res.status(500).json(
            {
                success : false,
                error : "User Login Failed, Unable to process login.",
            }
        )
        return
    }
    // verify password hash
    try {
        // correct password
        if (await argon2.verify(userData[0].password, loginData.password)) {
            const payload = {
                iss: "StorageMe",
                aud: "StorageMe",
                exp: Math.floor(Date.now() / 1000) + 86400,
                iat: Math.floor(Date.now() / 1000),
                userid: userData[0].id,
                useremail: loginData.email,
            }
            const token = jwt.sign(payload, process.env.JWT_SECRET_KEY)
            const data = {
                success: true,
                message : "Login successful",
                data : {
                    email: loginData.email,
                    token : token,
                }
            }
            res.status(200).json(data)
            return
        } 
        // incorrect password
        else {
            res.status(401).json(
                {
                    success : false,
                    error : "User Login Failed, Incorrect email or password.",
                }
            )
            return
        }
    } catch (err) {
        res.status(500).json(
            {
                success : false,
                error : "User Login Failed, Unable to process login.",
            }
        )
        return
    }
    
})