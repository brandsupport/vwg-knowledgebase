import{jsonResponse}from"../_lib/auth.js";
import{normalizeArticle}from"../_lib/content.js";

function safeEqual(a,b){
  const left=String(a||""),right=String(b||"");
  let diff=left.length^right.length;
  for(let i=0;i<Math.max(left.length,right.length);i++)diff|=(left.charCodeAt(i)||0)^(right.charCodeAt(i)||0);
  return diff===0;
}
function textValue(value){
  if(value==null)return "";
  if(typeof value==="string"||typeof value==="number")return String(value).trim();
  if(Array.isArray(value))return value.map(textValue).filter(Boolean).join(", ");
  if(typeof value==="object"){
    for(const key of ["text","label","name","value"])if(value[key]!=null&&value[key]!=="")return textValue(value[key]);
  }
  return "";
}
function imageValues(value){
  const out=[];
  const visit=item=>{
    if(typeof item==="string"){
      const candidate=item.trim();
      if(candidate.startsWith("https://"))out.push(candidate);
    }else if(Array.isArray(item))item.forEach(visit);
    else if(item&&typeof item==="object"){
      for(const key of ["url","downloadUrl","download_url","fileUrl","file_url","href","value","files","file","items"]){
        if(item[key]){visit(item[key]);break;}
      }
    }
  };
  visit(value);
  return [...new Set(out)].slice(0,8);
}
function fieldLabel(field){
  return [field.label,field.key,field.name].map(x=>textValue(x).toLowerCase().replace(/\s+/g," ").trim());
}
function readFields(payload){
  const fields=payload?.data?.fields||payload?.fields||[];
  const values={};
  for(const field of fields){
    if(!field||typeof field!=="object")continue;
    const labels=fieldLabel(field);
    let value=field.value;
    const options=Array.isArray(field.options)?field.options:[];
    if(options.length){
      const option=options.find(item=>item&&String(item.id)===String(value));
      if(option)value=option.text??option.label??value;
    }
    const find=names=>labels.some(label=>names.includes(label));
    if(find(["title","article title","tip title"]))values.title=textValue(value);
    else if(find(["category","article category"]))values.category=textValue(value);
    else if(find(["tags","tag","keywords"]))values.tags=textValue(value);
    else if(find(["body","article body","article content","content","description","tip","tip details","what is the tip?"]))values.body=textValue(value);
    else if(find(["source","source link","link","reference link"]))values.sourceUrl=textValue(value);
    if(/FILE_UPLOAD|IMAGE/i.test(textValue(field.type))||labels.some(label=>/image|screenshot|attachment|upload/.test(label)))values.images=imageValues(value);
  }
  return values;
}
function categoryId(value){
  const normalized=String(value||"").trim().toLowerCase();
  const map={
    "16":16,"17":17,
    "announcements":16,"announcement":16,
    "hub articles":17,"hub article":17
  };
  if(map[normalized])return map[normalized];
  const known={"vehicle transfers, tagging & de-tagging":1,"transfers":1,"stock":2,"stock types":2,"stock types, mandatory stock & launch / mi vehicles":2,"order mods":3,"order modifications, amendments & government grants":3,"pricing":4,"quotations, pricing, p.o. issues & re-pricing":4,"demo funding":5,"demo plans & demo funding":5,"registration":6,"registration, blocks, damage & compliance (v55 / rav / dvla / iva)":6,"delays":7,"vehicle delays, status codes, shipping & delivery times":7,"adoption":8,"adoption & un-adoption rules":8,"brand-specific":9,"brand-specific notes (audi, skoda, seat / cupra, vwcv, vw)":9,"procedures":10,"sli / gis / rav — step-by-step system procedures":10,"contacts":11,"contacts, escalation emails & phone numbers":11,"call notes":12,"team & conference call notes / product & supply updates":12,"reference":13,"reference info & terminology":13,"tools & links":14,"training":15,"training & product knowledge":15};
  return known[normalized]||0;
}

export async function onRequest(ctx){
  const{request,env}=ctx;
  if(request.method!=="POST")return jsonResponse({error:"Method not allowed."},405);
  const expected=String(env.TALLY_INGEST_TOKEN||"");
  const authorization=request.headers.get("Authorization")||"";
  if(expected.length<32||!safeEqual(authorization,"Bearer "+expected))return jsonResponse({error:"Not authorised."},401);
  let payload;
  try{
    const raw=await request.text();
    if(new TextEncoder().encode(raw).byteLength>2000000)return jsonResponse({error:"Tally response is too large."},413);
    payload=JSON.parse(raw);
  }catch{return jsonResponse({error:"Expected a valid Tally response."},400);}
  if(!env.DB)return jsonResponse({error:"Content database is not configured."},503);
  const responseId=textValue(payload?.data?.responseId)||textValue(payload?.data?.submissionId)||textValue(payload?.eventId)||textValue(payload?.response_id);
  if(!responseId)return jsonResponse({error:"Tally response ID is missing."},400);
  const existing=await env.DB.prepare("SELECT id,status FROM content_requests WHERE external_source='tally' AND external_response_id=?").bind(responseId).first();
  if(existing)return jsonResponse({ok:true,duplicate:true,requestId:existing.id,status:existing.status},200);
  const fields=readFields(payload);
  const cat=categoryId(fields.category);
  try{
    const article=normalizeArticle({title:fields.title,categoryId:cat,body:fields.body,tags:fields.tags,images:fields.images||[],sourceUrl:fields.sourceUrl});
    const id=crypto.randomUUID();
    await env.DB.prepare("INSERT INTO content_requests(id,request_type,submitted_by,submitter_name,submitter_email,payload_json,status,created_at,external_source,external_response_id) VALUES(?,'new',NULL,'Tally submission',NULL,?,'pending',?,'tally',?)")
      .bind(id,JSON.stringify(article),Date.now(),responseId).run();
    return jsonResponse({ok:true,requestId:id,status:"pending"},202);
  }catch(error){
    return jsonResponse({error:error.message||"Tally submission could not be added to the review queue."},400);
  }
}
