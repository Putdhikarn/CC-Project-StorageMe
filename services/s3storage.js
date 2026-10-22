import fs from "fs"
import crypto from "crypto"

import * as clientS3 from "@aws-sdk/client-s3" 
import * as presigner from "@aws-sdk/s3-request-presigner" 
import * as credentialProvider from "@aws-sdk/credential-providers";

const s3c = new clientS3.S3Client({
    region: process.env.AWS_REGION,
    // credential: fromInstanceMetadata(),
})

export const makePresignedURL = async (s3key, fileName) => {
    try {
        const command = new clientS3.GetObjectCommand({
            Bucket: process.env.S3_BUCKET,
            Key: s3key,
            ResponseContentDisposition: `attachment; filename=${fileName}`,
        })
        const url = await presigner.getSignedUrl(s3c, command, { expiresIn: 300 })
        return url
    } catch (err) {
        throw err
    }
    
}

export const makeS3key = (userId) => {
    return `uploads/${userId}/${crypto.randomUUID()}`
}

export const upload = async (file, s3key) => {
    try {
        const fsSteam = fs.createReadStream(file.path)

        const command = new clientS3.PutObjectCommand({
            Bucket: process.env.S3_BUCKET,
            Key: s3key,
            Body: fsSteam,
            ContentType: file.mimetype
        })

        await s3c.send(command)

        return s3key
    } catch (err) {
        throw err
    }
    
}

export const deleteFile = async (s3key) => {
    try {
        const command = new clientS3.DeleteObjectCommand({
            Bucket: process.env.S3_BUCKET,
            Key: s3key,
        })
        const response = await s3c.send(command)
        
        return response
    } catch (err) {
        throw err
    }
}

// ==========================================
// 1. สร้าง Pre-signed URL สำหรับ Upload ตรงขึ้น S3
// ==========================================
export const makePresignedUploadURL = async (s3key, contentType) => {
    try {
        const command = new clientS3.PutObjectCommand({
            Bucket: process.env.S3_BUCKET,
            Key: s3key,
            ContentType: contentType
        });
        // กำหนดอายุของตั๋วไว้ 15 นาที (900 วินาที)
        const url = await presigner.getSignedUrl(s3c, command, { expiresIn: 900 });
        return url;
    } catch (err) {
        throw err;
    }
};

