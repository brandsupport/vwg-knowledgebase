import{getSessionUser,isSameOrigin,jsonResponse,readJson}from"../../_lib/auth.js";
import{safeJson}from"../../_lib/content.js";

async function adminUser(request,env){
  const user=await getSessionUser(request,env);
  return user&&user.role==="admin"?user:null;
}
function requestRow(row){
  return {
    id:row.id,requestType:row.request_type,articleId:row.article_id,
    submitterName:row.submitter_name,submitterEmail:row.submitter_email,
    submittedAt:row.created_at,payload:safeJson(row.payload_json)||{},
    original:safeJson(row.original_json),status:row.status
  };
}
export async function onRequest(ctx){
  const{request,env}=ctx;
  if(env.AUTH_ENABLED!=="true"||!env.DB)return jsonResponse({error:"Content management is not configured."},503);
  const admin=await adminUser(request,env);
  if(!admin)return jsonResponse({error:"Administrator access required."},403);
  const action=Array.isArray(ctx.params.action)?ctx.params.action[0]:ctx.params.action;

  if(request.method==="GET"){
    if(action==="submissions"||action==="revisions"){
      const type=action==="submissions"?"new":"edit";
      const rows=await env.DB.prepare("SELECT id,request_type,article_id,submitter_name,submitter_email,payload_json,original_json,status,created_at FROM content_requests WHERE request_type=? AND status='pending' ORDER BY created_at ASC").bind(type).all();
      return jsonResponse({requests:(rows.results||[]).map(requestRow)});
    }
    if(action==="articles"){
      const [published,overrides]=await Promise.all([
        env.DB.prepare("SELECT id,article_json,published_at FROM published_articles WHERE id NOT IN (SELECT article_id FROM article_recycle_bin) ORDER BY published_at DESC").all(),
        env.DB.prepare("SELECT article_id,article_json,updated_at FROM article_overrides WHERE article_id NOT IN (SELECT article_id FROM article_recycle_bin) ORDER BY updated_at DESC").all()
      ]);
      return jsonResponse({
        published:(published.results||[]).map(row=>({id:row.id,publishedAt:row.published_at,article:safeJson(row.article_json)})).filter(x=>x.article),
        updated:(overrides.results||[]).map(row=>({id:row.article_id,updatedAt:row.updated_at,article:safeJson(row.article_json)})).filter(x=>x.article)
      });
    }
    if(action==="recycle-bin"){
      const rows=await env.DB.prepare("SELECT article_id,article_json,deleted_at,deleted_by FROM article_recycle_bin ORDER BY deleted_at DESC").all();
      return jsonResponse({items:(rows.results||[]).map(row=>({id:row.article_id,article:safeJson(row.article_json),deletedAt:row.deleted_at,deletedBy:row.deleted_by})).filter(x=>x.article)});
    }
    return jsonResponse({error:"Not found."},404);
  }

  if(request.method!=="POST")return jsonResponse({error:"Method not allowed."},405);
  if(!isSameOrigin(request))return jsonResponse({error:"Invalid request origin."},403);
  if(!["review","delete","restore","permanent-delete"].includes(action))return jsonResponse({error:"Not found."},404);
  let body;
  try{body=await readJson(request,50000);}catch{return jsonResponse({error:"Invalid admin request."},400);}
  if(action==="delete"){
    const articleId=String(body.articleId||""),article=body.article;
    if(!/^\\d{1,16}$/.test(articleId)||!article||String(article.id)!==articleId||!article.title)return jsonResponse({error:"A valid article is required."},400);
    await env.DB.prepare("INSERT INTO article_recycle_bin(article_id,article_json,source_type,deleted_at,deleted_by) VALUES(?,?,?,?,?) ON CONFLICT(article_id) DO NOTHING")
      .bind(articleId,JSON.stringify(article),"knowledge-base",Date.now(),admin.id).run();
    await env.DB.prepare("DELETE FROM article_favorites WHERE article_id=?").bind(articleId).run();
    return jsonResponse({ok:true,status:"deleted"});
  }
  if(action==="restore"){
    const articleId=String(body.articleId||"");
    if(!/^\\d{1,16}$/.test(articleId))return jsonResponse({error:"Invalid article identifier."},400);
    const result=await env.DB.prepare("DELETE FROM article_recycle_bin WHERE article_id=?").bind(articleId).run();
    if(!result.meta?.changes)return jsonResponse({error:"This article is not in the recycle bin."},404);
    return jsonResponse({ok:true,status:"restored"});
  }
  if(action==="permanent-delete"){
    const articleId=String(body.articleId||"");
    if(!/^\\d{1,16}$/.test(articleId))return jsonResponse({error:"Invalid article identifier."},400);
    const item=await env.DB.prepare("SELECT article_id FROM article_recycle_bin WHERE article_id=?").bind(articleId).first();
    if(!item)return jsonResponse({error:"This article is not in the recycle bin."},404);
    await env.DB.batch([
      env.DB.prepare("DELETE FROM published_articles WHERE id=?").bind(articleId),
      env.DB.prepare("DELETE FROM article_overrides WHERE article_id=?").bind(articleId),
      env.DB.prepare("DELETE FROM article_favorites WHERE article_id=?").bind(articleId),
      env.DB.prepare("DELETE FROM article_recycle_bin WHERE article_id=?").bind(articleId)
    ]);
    return jsonResponse({ok:true,status:"permanently-deleted"});
  }
  const requestId=String(body.requestId||"");
  const decision=String(body.decision||"");
  const note=String(body.note||"").trim().slice(0,2000);
  if(!requestId||!["approve","reject"].includes(decision))return jsonResponse({error:"Choose approve or reject for this request."},400);
  const item=await env.DB.prepare("SELECT * FROM content_requests WHERE id=? AND status='pending'").bind(requestId).first();
  if(!item)return jsonResponse({error:"This request no longer exists or has already been reviewed."},404);
  const now=Date.now();
  if(decision==="reject"){
    await env.DB.prepare("UPDATE content_requests SET status='rejected',review_note=?,reviewed_by=?,reviewed_at=? WHERE id=? AND status='pending'")
      .bind(note||"Not approved",admin.id,now,requestId).run();
    return jsonResponse({ok:true,status:"rejected"});
  }
  const article=safeJson(item.payload_json);
  if(!article||!article.title||!article.html||!article.cat)return jsonResponse({error:"The saved article request is incomplete."},400);
  if(item.request_type==="new"){
    const random=new Uint32Array(1);crypto.getRandomValues(random);
    const articleId=String(Date.now()*1000+(random[0]%1000));
    article.id=Number(articleId);
    const publishedArticle=JSON.stringify(article);
    await env.DB.batch([
      env.DB.prepare("INSERT INTO published_articles(id,request_id,article_json,published_at,published_by) VALUES(?,?,?,?,?)").bind(articleId,requestId,publishedArticle,now,admin.id),
      env.DB.prepare("UPDATE content_requests SET status='approved',review_note=?,reviewed_by=?,reviewed_at=? WHERE id=? AND status='pending'").bind(note,admin.id,now,requestId)
    ]);
    return jsonResponse({ok:true,status:"approved",articleId});
  }
  if(item.request_type==="edit"){
    const articleId=String(item.article_id||"");
    if(!/^\d{1,16}$/.test(articleId))return jsonResponse({error:"The article identifier is invalid."},400);
    article.id=Number(articleId);
    const updatedJson=JSON.stringify(article);
    const historyId=crypto.randomUUID();
    await env.DB.batch([
      env.DB.prepare("INSERT INTO article_revision_history(id,request_id,article_id,original_json,updated_json,submitted_by,approved_by,approved_at) VALUES(?,?,?,?,?,?,?,?)")
        .bind(historyId,requestId,articleId,item.original_json,updatedJson,item.submitted_by,admin.id,now),
      env.DB.prepare("INSERT INTO article_overrides(article_id,request_id,article_json,updated_at,updated_by) VALUES(?,?,?,?,?) ON CONFLICT(article_id) DO UPDATE SET request_id=excluded.request_id,article_json=excluded.article_json,updated_at=excluded.updated_at,updated_by=excluded.updated_by")
        .bind(articleId,requestId,updatedJson,now,admin.id),
      env.DB.prepare("UPDATE content_requests SET status='approved',review_note=?,reviewed_by=?,reviewed_at=? WHERE id=? AND status='pending'").bind(note,admin.id,now,requestId)
    ]);
    return jsonResponse({ok:true,status:"approved",articleId});
  }
  return jsonResponse({error:"Unknown request type."},400);
}
