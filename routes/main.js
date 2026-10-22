import express from 'express';

export const router = express.Router();
import path from 'path'

const makeFilePath = (fpath) => {
    return path.join(import.meta.dirname, "../public", fpath)
}
// ALWAYS PUT THIS AT THE BOTTOM
router.get('/{*splat}', (req, res) => {
    res.status(200).sendFile(makeFilePath('index.html'))
})

