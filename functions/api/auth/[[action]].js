import{clearSession,createSession,getSessionUser,hashPassword,isSameOrigin,jsonResponse,normalizeEmail,publicUser,readJson,sha256Hex,validEmail,verifyPassword}from"../../_lib/auth.js";
import{notifyAdmins}from"../../_lib/notifications.js";
async function register(ctx){
const{request,env}=ctx;
if(env.AUTH_ENABLED!=="true")return jsonResponse({error:"Registration is not enabled yet."},503);
if(!isSameOrigin(request))return jsonResponse({error:"Invalid request origin."},403);
if(!env.DB)return jsonResponse({error:"Authentication database is not configured."},503);
let body;try{body=await readJson(request);}catch{return jsonResponse({error:"Submit a valid registration form."},400);}
const name=String(body.name||"").trim(),email=normalizeEmail(body.email),password=String(body.password||""),confirmPassword=String(body.confirmPassword||"");
if(name.length<2||name.length>80)return jsonResponse({error:"Enter your full name (2–80 characters)."},400);
if(!validEmail(email))return jsonResponse({error:"Enter a valid work email address."},400);
if(password.length<12||password.length>128)return jsonResponse({error:"Password must be 12–128 characters."},400);
if(password!==confirmPassword)return jsonResponse({error:"The passwords do not match."},400);
const id=crypto.randomUUID(),now=Date.now(),hash=await hashPassword(password);
try{
  await env.DB.prepare("INSERT INTO users(id,name,email,password_hash,role,status,created_at,must_change_password) VALUES(?,?,?,?,'member','pending',?,0)")
    .bind(id,name,email,hash,now).run();
}catch(e){
  if(/unique|constraint/i.test(String(e&&e.message||"")))return jsonResponse({error:"An account with this email already exists. Try signing in."},409);
  return jsonResponse({error:"Registration could not be saved. Please retry."},500);
}
try{await notifyAdmins(env.DB,{type:"new-registration",title:"New account awaiting approval",message:name+" ("+email+") has requested Knowledge Base access.",targetUrl:"/admin#users",createdAt:now});}catch(e){}
return jsonResponse({status:"pending"},202);
}
async function login(ctx){const{request,env}=ctx;if(env.AUTH_ENABLED!=="true"||!env.DB)return jsonResponse({error:"Authentication is not enabled."},503);if(!isSameOrigin(request))return jsonResponse({error:"Invalid request origin."},403);let body;try{body=await readJson(request);}catch{return jsonResponse({error:"Enter your email and password."},400);}
const email=normalizeEmail(body.email),password=String(body.password||"");if(!email||!password||password.length>128)return jsonResponse({error:"Enter your email and password."},400);
const ip=request.headers.get("CF-Connecting-IP")||"unknown",key=await sha256Hex(email+"|"+ip),now=Date.now(),throttle=await env.DB.prepare("SELECT attempts,window_started_at FROM login_throttles WHERE key=?").bind(key).first();
if(throttle&&now-Number(throttle.window_started_at)<900000&&Number(throttle.attempts)>=8)return jsonResponse({error:"Too many sign-in attempts. Wait 15 minutes and try again."},429);
let user;try{user=await env.DB.prepare("SELECT u.id,u.name,u.email,u.password_hash,u.role,u.status,u.must_change_password,COALESCE(ap.avatar,u.avatar) AS avatar FROM users u LEFT JOIN user_avatar_preferences ap ON ap.user_id=u.id WHERE u.email=? COLLATE NOCASE LIMIT 1").bind(email).first();}catch{user=await env.DB.prepare("SELECT id,name,email,password_hash,role,status,must_change_password,avatar FROM users WHERE email=? COLLATE NOCASE LIMIT 1").bind(email).first();}
if(!user||!(await verifyPassword(password,user.password_hash))){await env.DB.prepare("INSERT INTO login_throttles(key,attempts,window_started_at) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET attempts=CASE WHEN login_throttles.window_started_at<? THEN 1 ELSE login_throttles.attempts+1 END,window_started_at=CASE WHEN login_throttles.window_started_at<? THEN excluded.window_started_at ELSE login_throttles.window_started_at END").bind(key,now,now-900000,now-900000).run();return jsonResponse({error:"Email or password is incorrect."},401);}
if(user.status==="pending")return jsonResponse({error:"Your registration is awaiting administrator approval."},403);if(user.status!=="active")return jsonResponse({error:"This account is suspended. Contact the administrator."},403);
await env.DB.prepare("DELETE FROM login_throttles WHERE key=?").bind(key).run();await env.DB.prepare("UPDATE users SET last_login_at=? WHERE id=?").bind(now,user.id).run();return jsonResponse({user:publicUser(user)},200,{"Set-Cookie":await createSession(env.DB,user.id)});
}
async function requestPasswordReset(ctx){
const{request,env}=ctx;
if(env.AUTH_ENABLED!=="true"||!env.DB)return jsonResponse({error:"Password recovery is not available."},503);
if(!isSameOrigin(request))return jsonResponse({error:"Invalid request origin."},403);
let body;try{body=await readJson(request,2048);}catch{return jsonResponse({error:"Enter the email address used for your account."},400);}
const email=normalizeEmail(body.email);
if(validEmail(email)){
  try{
    const user=await env.DB.prepare("SELECT id,name,email,status FROM users WHERE email=? COLLATE NOCASE LIMIT 1").bind(email).first();
    if(user&&user.status==="active"){
      const now=Date.now();
      const recent=await env.DB.prepare("SELECT id FROM password_reset_requests WHERE user_id=? AND (status='pending' OR created_at>?) LIMIT 1").bind(user.id,now-900000).first();
      if(!recent){
        const id=crypto.randomUUID();
        await env.DB.prepare("INSERT INTO password_reset_requests(id,user_id,created_at,status) VALUES(?,?,?,'pending')").bind(id,user.id,now).run();
        try{await notifyAdmins(env.DB,{type:"password-reset",title:"Password recovery requested",message:user.name+" ("+user.email+") needs help signing in.",targetUrl:"/admin#password-requests",createdAt:now});}catch(e){}
      }
    }
  }catch(e){return jsonResponse({error:"Password recovery is not ready. An administrator must apply database migration 0006 first."},503);}
}
return jsonResponse({ok:true,message:"If an active account matches that email address, an administrator has been notified. They will arrange a secure password reset."});
}
async function updateProfile(ctx){
const{request,env}=ctx;
if(env.AUTH_ENABLED!=="true"||!env.DB)return jsonResponse({error:"Authentication is not enabled."},503);
if(!isSameOrigin(request))return jsonResponse({error:"Invalid request origin."},403);
const current=await getSessionUser(request,env);
if(!current)return jsonResponse({error:"Please sign in again."},401);
let body;try{body=await readJson(request,2048);}catch{return jsonResponse({error:"Choose a valid profile avatar."},400);}
const allowed=new Set(["👤","🦁","🐼","🦊","🐺","🐸","🐧","🐯","🐨","🦉","🐙","🐬","🦭","🦄","🐻","🐮","🐵","🐹","🐰","🦝","🦓","🦒","🐘","🦛","🦔","🐢","🐳","🦈","🦋","🐝","🐞","🐲","🐉","🦖","🦕","🦜","🦩","🦚","🐦","🐱","🐶","🐴","🐭","🦇","🦦","🦥","🦨","🦡","🦫","🦢","🦤","🚗","🚙","🏎️","🚕","🚓","🚑","🚌","🚚","🚀","🌟","🔥","⚡","🎯","🎮","🧠","🛠️","🌈","💎","🎧","🏁"]);
const avatar=String(body.avatar||"");
if(!allowed.has(avatar))return jsonResponse({error:"Choose one of the available avatars."},400);
try{await env.DB.prepare("INSERT INTO user_avatar_preferences(user_id,avatar,updated_at) VALUES(?,?,?) ON CONFLICT(user_id) DO UPDATE SET avatar=excluded.avatar,updated_at=excluded.updated_at").bind(current.id,avatar,Date.now()).run();}catch{return jsonResponse({error:"Expanded avatars are not ready. An administrator must apply database migration 0006 first."},503);}
const updated=await env.DB.prepare("SELECT u.id,u.name,u.email,u.role,u.status,u.must_change_password,COALESCE(ap.avatar,u.avatar) AS avatar FROM users u LEFT JOIN user_avatar_preferences ap ON ap.user_id=u.id WHERE u.id=?").bind(current.id).first();
return jsonResponse({ok:true,user:publicUser(updated)});
}
async function changePassword(ctx){const{request,env}=ctx;if(env.AUTH_ENABLED!=="true"||!env.DB)return jsonResponse({error:"Authentication is not enabled."},503);if(!isSameOrigin(request))return jsonResponse({error:"Invalid request origin."},403);const user=await getSessionUser(request,env);if(!user)return jsonResponse({error:"Please sign in again."},401);let body;try{body=await readJson(request);}catch{return jsonResponse({error:"Enter a valid new password."},400);}const password=String(body.password||"");if(password.length<12||password.length>128)return jsonResponse({error:"Password must be 12–128 characters."},400);
if(!user.mustChangePassword){const old=String(body.currentPassword||""),row=await env.DB.prepare("SELECT password_hash FROM users WHERE id=?").bind(user.id).first();if(!old||!row||!(await verifyPassword(old,row.password_hash)))return jsonResponse({error:"Your current password is incorrect."},403);}
await env.DB.prepare("UPDATE users SET password_hash=?,must_change_password=0 WHERE id=?").bind(await hashPassword(password),user.id).run();await env.DB.prepare("DELETE FROM sessions WHERE user_id=? AND token_hash!=?").bind(user.id,user.tokenHash).run();return jsonResponse({ok:true});
}
export async function onRequest(ctx){const action=Array.isArray(ctx.params.action)?ctx.params.action[0]:ctx.params.action;const method=ctx.request.method;
if(action==="register"&&method==="POST")return register(ctx);if(action==="login"&&method==="POST")return login(ctx);if(action==="forgot-password"&&method==="POST")return requestPasswordReset(ctx);if(action==="logout"&&method==="POST"){if(!isSameOrigin(ctx.request))return jsonResponse({error:"Invalid request origin."},403);return jsonResponse({ok:true},200,{"Set-Cookie":await clearSession(ctx.request,ctx.env)});}
if(action==="me"&&method==="GET"){if(ctx.env.AUTH_ENABLED!=="true"||!ctx.env.DB)return jsonResponse({user:null,configured:false});const user=await getSessionUser(ctx.request,ctx.env);return jsonResponse({user:user?publicUser(user):null,configured:true});}
if(action==="profile"&&method==="POST")return updateProfile(ctx);if(action==="change-password"&&method==="POST")return changePassword(ctx);return jsonResponse({error:"Not found."},404);
}