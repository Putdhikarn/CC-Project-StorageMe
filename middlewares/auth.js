import jwt from 'jsonwebtoken';
import argon2 from 'argon2';

export const authVerifyJWT = async (req, res, next) => {
    const authData = req.headers['authorization'];
    // check if header is valid
    if (authData == null || !authData.startsWith("Bearer ")){
        res.status(401).json(
            {
                success : false,
                error : "User Authentication Failed, Missing or invalid request token.",
            }
        )
        return
    }
    // get token from header
    const token = authData.split(" ")[1]
    const options = {}
    // verify token
    jwt.verify(token, process.env.JWT_SECRET_KEY, options, (err, decoded) => {
        if (err){
                res.status(401).json(
                {
                    success : false,
                    error : "User Authentication Failed, Missing or invalid request token.\n" + err,
                }
            )
            return
        }
        req.requestUserData = {
            userId: decoded.userid,
            userEmail: decoded.useremail,
        }
        if (req.requestUserData.userId == null || req.requestUserData.userEmail == null){
            res.status(401).json(
                {
                    success : false,
                    error : "User Authentication Failed, Missing or invalid request token.\n",
                }
            )
        }
        next()
    })
}