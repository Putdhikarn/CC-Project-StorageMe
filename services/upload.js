import path from "path"
import fs from "fs"
import multer from "multer"

const uploadDir = './uploads'
if (!fs.existsSync(uploadDir)){
    fs.mkdirSync(uploadDir)
}

const absoluteUploadDir = path.join(import.meta.dirname, "../uploads")

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir)
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9)
        cb(null, file.fieldname + '-' + uniqueSuffix)
    }
})

export const upload = multer({ storage: storage })

export const GetDownloadPath = (fileStorePath) => {
    const filePath = path.join(absoluteUploadDir, fileStorePath);
    return filePath
}

export const deleteFile = async (filePath) => {
    const full = uploadDir + "/" + filePath
    fs.rm(full, {force:true}, (err) => {
        if (err) {
            throw err
        }
    });
}

export const deleteFileAbsolute = async (filePath) => {
    fs.rm(filePath, {force:true}, (err) => {
        if (err) {
            throw err
        }
    });
}