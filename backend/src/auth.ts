//给鉴权中间件写的，拓展Request，让代码稳定健壮

import {Request, Response, NextFunction} from 'express'
import jwt from 'jsonwebtoken'


export interface AuthRequest extends Request{
    user?: any
}

export function authenticateToken(req:AuthRequest, res:Response, next:NextFunction){
    //从请求头拿Authorization
    const authHeader = req.headers['authorization']

    //标准格式“Bearer <token>”,要把token拆出来
    const token = authHeader && authHeader.split(' ')[1]

    //没有token不行
    if(!token){
        return res.status(401).json({
            code: 401,
            message: '未提供令牌,拒绝访问',
            data: null
        })
    }

    //看看
    jwt.verify(token, process.env.JWT_SECRET as string, (err, decoded) => {
        if(err){
            return res.status(401).json({
                code: 401,
                message: '令牌无效或已过期',
                data: null
            })
        }
        
        //有效，把用户信息挂在req上
        req.user = decoded
        next()
    })
}