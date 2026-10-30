import type { NextFunction, Request, Response } from 'express'
import { userDb } from './supabase.js'

export type Role = 'student'|'teacher'|'admin'
export type AuthContext = { userId:string; email:string; role:Role; token:string }
declare global { namespace Express { interface Request { auth?:AuthContext } } }

export async function authenticate(req:Request,res:Response,next:NextFunction) {
  const header=req.header('authorization')
  if(!header?.startsWith('Bearer ')){res.status(401).json({error:{code:'UNAUTHENTICATED',message:'Sign in to continue.'}});return}
  const token=header.slice(7)
  try {
    const scoped = userDb(token)
    const {data,error}=await scoped.auth.getUser(token)
    if(error||!data.user){res.status(401).json({error:{code:'INVALID_SESSION',message:'Your session has expired. Please sign in again.'}});return}
    const {data:profile,error:profileError}=await scoped.from('profiles').select('role,is_active').eq('id',data.user.id).maybeSingle()
    if(profileError||!profile||profile.is_active===false){res.status(403).json({error:{code:'ACCOUNT_UNAVAILABLE',message:'This account is not active. Contact your administrator.'}});return}
    req.auth={userId:data.user.id,email:data.user.email||'',role:profile.role as Role,token}
    req.userDb=scoped
    next()
  } catch {res.status(503).json({error:{code:'AUTH_UNAVAILABLE',message:'Authentication is temporarily unavailable.'}})}
}

export function allow(...roles:Role[]){return(req:Request,res:Response,next:NextFunction)=>{
  if(!req.auth||!roles.includes(req.auth.role)){res.status(403).json({error:{code:'FORBIDDEN',message:'You do not have permission to perform this action.'}});return}
  next()
}}

declare global { namespace Express { interface Request { userDb?: ReturnType<typeof userDb> } } }
