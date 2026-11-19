import{getSessionUser,isSameOrigin,jsonResponse,readJson}from"../_lib/auth.js";
import{normalizeArticle,safeJson}from"../_lib/content.js";

export async function onRequest(ctx){
  const{request,env}=ctx;
  if(env.AUTH_ENABLED!=="true"||!env.DB)return jsonResponse({error:"Content management is not configured."},503);
  const user=await getSessionUser(request,env);
  if(!user)return jsonResponse({error:"Please sign in to continue."},401);

  if(request.method==="GET"){
    const [published,overrides]=await Promise.all([
      env.DB.prepare("SELECT article_json FROM published_articles ORDER BY published_at DESC").all(),
      env.DB.prepare("SELECT article_json FROM article_overrides").all()
    ]);
    return jsonResponse({
      articles:(published.results||[]).map(row=>safeJson(row.article_json)).filter(Boolean),
      overrides:(overrides.results||[]).map(row=>safeJson(row.article_json)).filter(Boolean)
    });
  }
  if(request.method!=="POST")return jsonResponse({error:"Method not allowed."},405);
  if(!isSameOrigin(request))return jsonResponse({error:"Invalid request origin."},403);
  let body;
  try{body=await readJson(request,50000);}catch{return jsonResponse({error:"Submit a valid article request."},400);}
  const type=String(body.requestType||"new");
  if(!["new","edit"].includes(type))return jsonResponse({error:"Unknown request type."},400);
  const articleId=type==="edit"?String(body.articleId||""):"";
  if(type==="edit"&&!/^\d{1,16}$/.test(articleId))return jsonResponse({error:"The article to update is not valid."},400);
  let article;
  try{article=normalizeArticle(body,{edit:type==="edit"});}catch(error){return jsonResponse({error:error.message||"Check the article details."},400);}
  const id=crypto.randomUUID(),now=Date.now();
  const original=type==="edit"&&body.originalArticle&&typeof body.originalArticle==="object"?{
    id:body.originalArticle.id??articleId,
    title:String(body.originalArticle.title||"").slice(0,180),
    cat:Number(body.originalArticle.cat)||article.cat,
    tags:Array.isArray(body.originalArticle.tags)?body.originalArticle.tags.slice(0,8):[],
    text:String(body.originalArticle.html||"").replace(/<[^>]*>/g," ").replace(/\\s+/g," ").trim().slice(0,30000),
    source_url:String(body.originalArticle.source_url||"").slice(0,2000)
  }:null;
  await env.DB.prepare("INSERT INTO content_requests(id,request_type,article_id,submitted_by,submitter_name,submitter_email,payload_json,original_json,status,created_at) VALUES(?,?,?,?,?,?,?,?, 'pending',?)")
    .bind(id,type,articleId||null,user.id,user.name,user.email,JSON.stringify(article),original?JSON.stringify(original):null,now).run();
  return jsonResponse({ok:true,status:"pending",requestId:id,requestType:type},202);
}
