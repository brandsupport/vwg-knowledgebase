import{getSessionUser,jsonResponse}from"./_lib/auth.js";
const PUBLIC=new Set(["/login","/login.html","/signup","/signup.html","/api/auth/login","/api/auth/register","/api/auth/logout","/api/auth/me"]);
const PASSWORD_PATHS=new Set(["/change-password","/change-password.html","/api/auth/change-password","/api/auth/logout","/api/auth/me"]);
const ACCOUNT_WIDGET='<a href="/account" style="position:fixed;right:18px;bottom:18px;z-index:99999;padding:10px 15px;border-radius:999px;background:#172033;color:#fff;text-decoration:none;font:600 13px system-ui;box-shadow:0 5px 22px #0003;border:1px solid #ffffff30">Account&nbsp; ↗</a>';
export async function onRequest(ctx){const url=new URL(ctx.request.url),path=url.pathname.replace(/\/+$/,"")||"/";
if(ctx.env.AUTH_ENABLED!=="true")return ctx.next();
if(PUBLIC.has(path))return ctx.next();
if(!ctx.env.DB){if(path.startsWith("/api/"))return jsonResponse({error:"Authentication database is not configured."},503);return new Response("Authentication setup is incomplete. Contact the Knowledge Base administrator.",{status:503,headers:{"Content-Type":"text/plain; charset=utf-8","Cache-Control":"no-store"}});}
const user=await getSessionUser(ctx.request,ctx.env);
if(!user){if(path.startsWith("/api/"))return jsonResponse({error:"Please sign in to continue."},401);return Response.redirect(new URL("/login?next="+encodeURIComponent(path+url.search),url),302);}
if((path==="/admin"||path==="/admin.html")&&user.role!=="admin")return new Response("Administrator access required.",{status:403,headers:{"Cache-Control":"no-store"}});
if(user.mustChangePassword&&!PASSWORD_PATHS.has(path)){if(path.startsWith("/api/"))return jsonResponse({error:"Change your temporary password before continuing."},403);return Response.redirect(new URL("/change-password",url),302);}
ctx.data.user=user;const response=await ctx.next(),type=response.headers.get("Content-Type")||"";
if(response.status===200&&type.includes("text/html")&&typeof HTMLRewriter!=="undefined")return new HTMLRewriter().on("body",{element(el){el.append(ACCOUNT_WIDGET,{html:true});}}).transform(response);
return response;
}