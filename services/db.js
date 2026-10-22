import mysql from 'mysql2/promise';

let pool = {}

export const initDBPool = async () => {
    pool = mysql.createPool({
        host: process.env.DB_HOST,
        port: process.env.DB_PORT,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        waitForConnections: true,
        connectionLimit: 16,
        queueLimit: 0,
        timezone: 'Z'
    });
}

export const addUserInfo = async (userData) => {
    const query = "INSERT INTO users (username, email, password, created_at) VALUES (?, ?, ?, ?)"
    const data = [userData.username, userData.email, userData.password, new Date().toISOString()]
    try {
        const [rows] = await pool.execute(query, data);
    } catch (err) {
        throw err
    }
    
}

export const getUserInfo = async (email) => {
    const query = "SELECT * FROM users WHERE email = ?"
    const data = [email]
    try {
        const [rows] = await pool.execute(query, data);
        return rows
    } catch (err) {
        throw err
    }
}

export const getUserInfoUserView = async (email) => {
    const query = "SELECT username, email FROM users WHERE email = ?"
    const data = [email]
    try {
        const [rows] = await pool.execute(query, data);
        return rows
    } catch (err) {
        throw err
    }
}

export const getFileInfo = async (fileInfo) => {
    const query = `
    SELECT * FROM files WHERE owner_id = ? AND file_name = ? AND (expire_at IS NULL OR expire_at > ?);
    `
    const data = [fileInfo.ownerId, fileInfo.fileName, new Date()]
    try {
        const [rows] = await pool.execute(query, data);
        return rows
    } catch (err) {
        throw err
    }
}

export const getFileInfoId = async (fileInfo) => {
    const query = `
    SELECT * FROM files WHERE owner_id = ? AND id = ? AND (expire_at IS NULL OR expire_at > ?) AND deleted_at IS NULL;
    `
    const data = [fileInfo.ownerId, fileInfo.fileId, new Date()]
    try {
        const [rows] = await pool.execute(query, data);
        return rows
    } catch (err) {
        throw err
    }
}

export const getFileInfoOnlyId = async (fileInfo) => {
    const query = `
    SELECT * FROM files WHERE id = ? AND (expire_at IS NULL OR expire_at > ?) AND deleted_at IS NULL;
    `
    const data = [fileInfo.fileId, new Date()]
    try {
        const [rows] = await pool.execute(query, data);
        return rows
    } catch (err) {
        throw err
    }
}

export const getUserAllFilesList =  async (userInfo) => {
    const query = `
    SELECT * 
    FROM files 
    WHERE owner_id = ? AND (expire_at IS NULL OR expire_at > ?) AND deleted_at IS NULL;
    `
    const data = [userInfo.ownerId, new Date()]
    try {
        const [rows] = await pool.execute(query, data);
        return rows
    } catch (err) {
        throw err
    }
}

export const getUserAllFilesListWithName =  async (userInfo) => {
    const query = `
    SELECT * 
    FROM files 
    WHERE owner_id = ? AND (expire_at IS NULL OR expire_at > ?) AND deleted_at IS NULL AND file_name LIKE ?;
    `
    const data = [userInfo.ownerId, new Date(), `%${userInfo.fileName}%`]
    try {
        const [rows] = await pool.query(query, data);
        return rows
    } catch (err) {
        throw err
    }
}

export const getUserAllFilesListWithTags =  async (userInfo) => {
    let query = ``
    let data = null
    if (userInfo.matchType == 'any'){
        query = `
        (SELECT DISTINCT files.id AS file_id, files.owner_id, files.file_name, files.storage_object_id, files.file_size, files.upload_date, files.updated_at, files.mime_type, file_tags.tag_id, tags.name AS tag_name FROM files INNER JOIN file_tags ON file_tags.file_id = files.id INNER JOIN tags ON file_tags.tag_id = tags.id WHERE files.owner_id = ? AND file_tags.tag_id IN ? AND (files.expire_at IS NULL OR files.expire_at > ?) AND files.deleted_at IS NULL) ;
        `
        data = [userInfo.ownerId, [userInfo.fileTags], new Date()]
    } else if (userInfo.matchType == 'all') {
        query = `
        SELECT file_id, file_owner_id, file_fname, file_store_object_id, file_file_size, file_upload_date, file_updated_at, file_mime_type, COUNT(DISTINCT files_tag_id) AS tags_count
        FROM (SELECT DISTINCT files.id AS file_id, files.owner_id AS file_owner_id, files.file_name AS file_fname, files.storage_object_id AS file_store_object_id, files.file_size AS file_file_size, files.upload_date AS file_upload_date, files.updated_at AS file_updated_at, files.mime_type AS file_mime_type, file_tags.tag_id AS files_tag_id, tags.name AS tag_name FROM files INNER JOIN file_tags ON file_tags.file_id = files.id INNER JOIN tags ON file_tags.tag_id = tags.id WHERE files.owner_id = ? AND file_tags.tag_id IN ? AND (files.expire_at IS NULL OR files.expire_at > ?) AND files.deleted_at IS NULL) AS filesub
        GROUP BY file_id
        HAVING tags_count = ?;
        `
        data = [userInfo.ownerId, [userInfo.fileTags], new Date(), userInfo.fileTags.length]
    }
    try {
        const [rows] = await pool.query(query, data);
        return rows
    } catch (err) {
        throw err
    }
}

export const getUserAllTagList = async (userInfo) => {
    const query = `
    SELECT * FROM tags WHERE owner_id = ?;
    `
    const data = [userInfo.userId]
    try {
        const [rows] = await pool.execute(query, data);
        return rows
    } catch (err) {
        throw err
    }
}

export const addTagForUser = async (tagInfo) => {
    const query = `
    INSERT INTO tags (name, owner_id)
    VALUES (?,?);
    `
    const data = [tagInfo.tagName, tagInfo.ownerId]
    try {
        const [rows] = await pool.execute(query, data);
        return rows
    } catch (err) {
        throw err
    }
}

export const getTagInfo = async (tagLookUp) => {
    const query = `
    SELECT * FROM tags WHERE id = ? AND owner_id = ?;
    `
    const data = [tagLookUp.tagId, tagLookUp.ownerId]
    try {
        const [rows] = await pool.execute(query, data);
        return rows
    } catch (err) {
        throw err
    }
}

export const updateTagInfo = async (tagInfo) => {
    const query = `
    UPDATE tags SET name = ?
    WHERE id = ?;
    `
    const data = [tagInfo.tagName, tagInfo.tagId]
    try {
        const [rows] = await pool.execute(query, data);
        return rows
    } catch (err) {
        throw err
    }
}

export const deleteTagForUser = async (tagInfo) => {
    const query = `
    DELETE FROM tags
    WHERE owner_id = ? AND id = ?;
    `
    const data = [tagInfo.ownerId, tagInfo.tagId]
    try {
        const [rows] = await pool.execute(query, data);
        return rows
    } catch (err) {
        throw err
    }
}

export const deleteFileRecord = async (fileId) => {
    const query = `
    DELETE FROM files WHERE id = ?;
    `
    const data = [fileId]
    try {
        const [rows] = await pool.execute(query, data);
        return rows
    } catch (err) {
        throw err
    }
}

export const deleteStorageObjectRecord = async (objId) => {
    const query = `
    DELETE FROM storage_objects WHERE id = ?;
    `
    const data = [objId]
    try {
        const [rows] = await pool.execute(query, data);
        return rows
    } catch (err) {
        throw err
    }
}

export const updateFileInfo = async (fileInfo) => {
    const query = `
    INSERT INTO files (owner_id, file_name, storage_object_id, file_size, upload_date, updated_at, mime_type, checksum_sha256, expire_at) VALUES (?,?,?,?,?,?,?,?,?)
    ON DUPLICATE KEY UPDATE 
    owner_id = VALUES(owner_id),
    storage_object_id = VALUES(storage_object_id),
    file_size = VALUES(file_size),
    updated_at = VALUES(updated_at),
    mime_type = VALUES(mime_type),
    checksum_sha256 = VALUES(checksum_sha256),
    expire_at = VALUES(expire_at),
    deleted_at = NULL;
    `
    const data = [fileInfo.ownerId, fileInfo.fileName, fileInfo.storageObjectId, fileInfo.fileSize, fileInfo.uploadDate, fileInfo.uploadDate, fileInfo.mimetype, fileInfo.checksum, fileInfo.expireAt]
    try {
        const [rows] = await pool.execute(query, data);
    } catch (err) {
        throw err
    }
}

export const setFileNewName = async (renameInfo) => {
    const query = `
    UPDATE files SET file_name = ?, updated_at = ? WHERE id = ?;
    `
    const data = [renameInfo.fileName, new Date(), renameInfo.fileId]
    try {
        const [rows] = await pool.execute(query, data);
    } catch (err) {
        throw err
    }
}

export const getStorageObjectInfo = async (objChecksum) => {
    const query = `
    SELECT * FROM storage_objects WHERE checksum_sha256 = ?
    `
    const data = [objChecksum]
    try {
        const [rows] = await pool.execute(query, data);
        return rows
    } catch (err) {
        throw err
    }
}

export const getStorageObjectInfoFromId = async (objId) => {
    const query = `
    SELECT * FROM storage_objects WHERE id = ?
    `
    const data = [objId]
    try {
        const [rows] = await pool.execute(query, data);
        return rows
    } catch (err) {
        throw err
    }
}

export const addStorageObjectInfo = async (fileInfo) => {
    const query = `
    INSERT INTO storage_objects (checksum_sha256, s3_key, file_size, ref_count, created_at) VALUES (?,?,?,?,?);
    `
    const data = [fileInfo.checksum, fileInfo.s3Key, fileInfo.fileSize, 1, fileInfo.uploadDate]
    try {
        const [rows] = await pool.execute(query, data);
        return rows
    } catch (err) {
        throw err
    }
}

export const incrementStorageObjectRefCount = async (store_obj_id) => {
    const query = `
    UPDATE storage_objects SET
    ref_count = ref_count + 1
    WHERE id = ?;
    `
    const data = [store_obj_id]
    try {
        const [rows] = await pool.execute(query, data);
    } catch (err) {
        throw err
    }
}

export const decrementStorageObjectRefCount = async (store_obj_id) => {
    const query = `
    UPDATE storage_objects SET
    ref_count = ref_count - 1
    WHERE id = ?;
    `
    const data = [store_obj_id]
    try {
        const [rows] = await pool.execute(query, data);
    } catch (err) {
        throw err
    }
}

export const getFilesTags = async (fileId) => {
    const query = `
    SELECT * FROM file_tags
    INNER JOIN tags ON file_tags.tag_id = tags.id
    WHERE file_tags.file_id = ?
    `
    const data = [fileId]
    try {
        const [rows] = await pool.query(query, data);
        return rows
    } catch (err) {
        throw err
    }
}

export const addTagsToFile = async (tagInfo) => {
    const query = `
    INSERT INTO file_tags (tag_id, file_id) VALUES ?;
    `
    const data = tagInfo
    try {
        const [rows] = await pool.query(query, [data]);
        return rows
    } catch (err) {
        throw err
    }
}

export const removeTagFromFile = async (tagInfo) => {
    const query = `
    DELETE FROM file_tags WHERE tag_id = ? AND file_id = ?;
    `
    const data = [tagInfo.tagId, tagInfo.fileId]
    try {
        const [rows] = await pool.query(query, data);
        return rows
    } catch (err) {
        throw err
    }
}

export const removeAllTagsFromFile = async (fileId) => {
    const query = `
    DELETE FROM file_tags WHERE file_id = ?;
    `
    const data = [fileId]
    try {
        const [rows] = await pool.query(query, data);
        return rows
    } catch (err) {
        throw err
    }
}

export const getExpiredFileRecords = async (expiredDate) => {
    const query = `
    SELECT * FROM files WHERE expire_at <= ?;
    `
    const data = [expiredDate]
    try {
        const [rows] = await pool.query(query, data);
        return rows
    } catch (err) {
        throw err
    }
}

export const addDownloadLinkRecord = async (linkData) => {
    const query = `
    INSERT INTO download_links (file_id, token, max_downloads, password_hash, expire_at, created_at) VALUES (?,?,?,?,?,?);
    `
    const data = [linkData.fileId, linkData.token, linkData.maxDownload, linkData.passwordHash, linkData.expireAt, new Date()]
    try {
        const [rows] = await pool.query(query, data);
        return rows
    } catch (err) {
        throw err
    }
}

export const getFileDownloadLinkRecord = async (fileId) => {
    const query = `
    SELECT token, max_downloads, download_count, password_hash, expire_at, created_at FROM download_links WHERE file_id = ?;
    `
    const data = [fileId]
    try {
        const [rows] = await pool.query(query, data);
        return rows
    } catch (err) {
        throw err
    }
}

export const getFileDownloadLinkDataFromToken = async (linkToken) => {
    const query = `
    SELECT * FROM download_links WHERE token = ? AND (expire_at IS NULL OR expire_at > ?);
    `
    const data = [linkToken, new Date()]
    try {
        const [rows] = await pool.query(query, data);
        return rows
    } catch (err) {
        throw err
    }
}

export const incrementFileDownloadLinkCount = async (linkToken) => {
    const query = `
    UPDATE download_links SET download_count = download_count + 1 WHERE token = ?;
    `
    const data = [linkToken, new Date()]
    try {
        const [rows] = await pool.query(query, data);
        return rows
    } catch (err) {
        throw err
    }
}

export const removeFileDownloadLinkRecord = async (linkToken) => {
    const query = `
    DELETE FROM download_links WHERE token = ?;
    `
    const data = [linkToken]
    try {
        const [rows] = await pool.query(query, data);
        return rows
    } catch (err) {
        throw err
    }
}

export const setUserNewEmail = async (oldEmail, newEmail) => {
    const query = `
    UPDATE users SET email = ? WHERE email = ?;
    `
    const data = [newEmail, oldEmail]
    try {
        const [rows] = await pool.execute(query, data);
        return rows
    } catch (err) {
        throw err
    }
}

export const setUserNewPassword = async (newPassword, email) => {
    const query = `
    UPDATE users SET password = ? WHERE email = ?;
    `
    const data = [newPassword, email]
    try {
        const [rows] = await pool.execute(query, data);
        return rows
    } catch (err) {
        throw err
    }
}

export const setUserNewUsername = async (newUsername, email) => {
    const query = `
    UPDATE users SET username = ? WHERE email = ?;
    `
    const data = [newUsername, email]
    try {
        const [rows] = await pool.execute(query, data);
        return rows
    } catch (err) {
        throw err
    }
}

// =========================================================================
// FILE VERSIONING & ROLLBACK FUNCTIONS
// =========================================================================
export const addFileVersion = async (fileId, storageObjectId, version) => {
    const query = `INSERT INTO file_versions (file_id, storage_object_id, version, created_at) VALUES (?, ?, ?, ?)`;
    await pool.execute(query, [fileId, storageObjectId, version, new Date()]);
};

export const getMaxFileVersion = async (fileId) => {
    const query = `SELECT MAX(version) as max_v FROM file_versions WHERE file_id = ?`;
    const [rows] = await pool.execute(query, [fileId]);
    return rows[0].max_v || 0;
};

export const getFileVersionsHistory = async (fileId) => {
    const query = `
    SELECT fv.version, fv.created_at, so.file_size, so.checksum_sha256, so.id as storage_object_id
    FROM file_versions fv
    INNER JOIN storage_objects so ON fv.storage_object_id = so.id
    WHERE fv.file_id = ?
    ORDER BY fv.version DESC;
    `;
    const [rows] = await pool.execute(query, [fileId]);
    return rows;
};

export const rollbackFileToVersion = async (fileId, storageObjectId) => {
    const query = `UPDATE files SET storage_object_id = ?, updated_at = ? WHERE id = ?`;
    await pool.execute(query, [storageObjectId, new Date(), fileId]);
};

// =========================================================================
// SOFT DELETE & TRASH BIN FUNCTIONS (อัปเดตใหม่: ตั้งเวลา 30 วัน + ลบถาวร)
// =========================================================================

// 1. Soft Delete: ตั้งค่า expire_at เป็น 30 วันข้างหน้า (ซ่อนจากหน้าหลักแต่ยังไม่ลบไฟล์จริง)
export const softDeleteFileRecord = async (fileId) => {
    // deleted_at ใช้ซ่อนไฟล์จากหน้าหลัก / expire_at ยังตั้งไว้ +30 วัน เพื่อให้งานลบไฟล์หมดอายุเดิมมาเก็บกวาดให้
    const query = `UPDATE files SET deleted_at = ?, expire_at = ? WHERE id = ?`;
    const now = new Date();
    const thirtyDaysLater = new Date(now.getTime() + 30 * 86400000); // +30 วัน
    const [rows] = await pool.execute(query, [now, thirtyDaysLater, fileId]);
    return rows;
};

// 2. ดึงรายการไฟล์ในถังขยะ (ไฟล์ที่ expire_at มีค่า และเลยเวลาปัจจุบันมาแล้ว)
export const getTrashFilesList = async (ownerId) => {
    const query = `SELECT * FROM files WHERE owner_id = ? AND deleted_at IS NOT NULL ORDER BY deleted_at DESC`;
    const [rows] = await pool.execute(query, [ownerId]);
    return rows;
};

// 3. กู้คืนไฟล์จากถังขยะ (รีเซ็ต expire_at กลับเป็น NULL เพื่อให้กลับมาแสดงปกติ)
export const restoreFileFromTrash = async (fileId, ownerId) => {
    const query = `UPDATE files SET deleted_at = NULL, expire_at = NULL WHERE id = ? AND owner_id = ? AND deleted_at IS NOT NULL`;
    const [rows] = await pool.execute(query, [fileId, ownerId]);
    return rows;
};

// 4. ลบถาวรรายไฟล์ (Permanent Delete) - ต้องเป็นไฟล์ที่อยู่ในถังขยะแล้วเท่านั้น (expire_at ไม่เป็น NULL)
export const permanentDeleteFileRecord = async (fileId, ownerId) => {
    const query = `DELETE FROM files WHERE id = ? AND owner_id = ? AND deleted_at IS NOT NULL`;
    const [rows] = await pool.execute(query, [fileId, ownerId]);
    return rows;
};

// 5. ล้างถังขยะทั้งหมด (Empty Trash) - ลบเฉพาะไฟล์ที่อยู่ในถังขยะแล้วเท่านั้น
export const emptyTrashFiles = async (ownerId) => {
    const query = `DELETE FROM files WHERE owner_id = ? AND deleted_at IS NOT NULL`;
    const [rows] = await pool.execute(query, [ownerId]);
    return rows;
};