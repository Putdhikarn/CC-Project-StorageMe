
export const MakeErrorJSON = (msg, code = 0) => {
    const emsg = {
        success: false,
        errcode: code,
        error: msg,
    }
    return emsg
}

export const MakeSuccessJSON = (msg, data) => {
    const msggg = {
        success: true,
        message: msg,
        data: data,
    }
    return msggg
}