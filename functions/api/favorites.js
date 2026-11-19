import{getSessionUser,isSameOrigin,jsonResponse,readJson}from"../_lib/auth.js";

export async function onRequest(ctx){
  const{request,env}=ctx;
  if(env.AUTH_ENABLED!=="true"||!env.DB)return jsonResponse({error:"Favorites are not enabled."},503);
  const user=await getSessionUser(request,env);
  if(!user)return jsonResponse({error:"Please sign in to use favorites."},401);

  if(request.method==="GET"){
    const rows=await env.DB.prepare("SELECT article_id FROM article_favorites WHERE user_id=? ORDER BY created_at DESC").bind(user.id).all();
    return jsonResponse({favorites:(rows.results||[]).map(row=>String(row.article_id))});
  }
  if(request.method!=="POST")return jsonResponse({error:"Method not allowed."},405);
  if(!isSameOrigin(request))return jsonResponse({error:"Invalid request origin."},403);

  let body;
  try{body=await readJson(request);}catch{return jsonResponse({error:"Submit a valid favorites request."},400);}
  const articleId=String(body.articleId??"");
  if(!/^\\d{1,12}$/.test(articleId))return jsonResponse({error:"Invalid article identifier."},400);
  if(typeof body.favorite!=="boolean")return jsonResponse({error:"Choose whether to save or remove this article."},400);

  if(body.favorite){
    await env.DB.prepare("INSERT OR IGNORE INTO article_favorites(user_id,article_id,created_at) VALUES(?,?,?)").bind(user.id,articleId,Date.now()).run();
  }else{
    await env.DB.prepare("DELETE FROM article_favorites WHERE user_id=? AND article_id=?").bind(user.id,articleId).run();
  }
  return jsonResponse({ok:true,articleId,favorite:body.favorite});
}
