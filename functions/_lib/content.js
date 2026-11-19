const CATEGORY_IDS = new Set([1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17]);

function escapeHtml(value){
  return String(value??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;");
}
function cleanHttps(value){
  const raw=String(value??"").trim();
  if(!raw)return "";
  try{const url=new URL(raw);return url.protocol==="https:"?url.href:"";}catch{return "";}
}
function cleanArticleImage(value){
  const raw=String(value??"").trim();
  if(!raw)return "";
  const https=cleanHttps(raw);
  if(https)return https;
  if(/^data:image\/(?:webp|jpeg|png);base64,[A-Za-z0-9+/]+={0,2}$/.test(raw)&&raw.length<=380000)return raw;
  if(/^(?:article_images|agency_approval_images|stock_replacement_images)\/[A-Za-z0-9_-][A-Za-z0-9._/-]*$/.test(raw)&&!raw.includes(".."))return raw;
  return "";
}
function bodyToHtml(body){
  const lines=String(body??"").replace(/\r\n?/g,"\n").split("\n");
  const out=[];let listType="",listItems=[];
  const flush=()=>{if(listItems.length){out.push("<"+listType+">"+listItems.map(item=>"<li>"+escapeHtml(item)+"</li>").join("")+"</"+listType+">");listItems=[];listType="";}};
  for(const raw of lines){
    const line=raw.trim();
    if(!line){flush();continue;}
    if(line.startsWith("### ")){flush();out.push("<h4>"+escapeHtml(line.slice(4))+"</h4>");continue;}
    if(line.startsWith("## ")){flush();out.push("<h3>"+escapeHtml(line.slice(3))+"</h3>");continue;}
    const bullet=line.match(/^[-•*]\s+(.+)$/);
    const numbered=line.match(/^\d+[.)]\s+(.+)$/);
    if(bullet||numbered){
      const type=bullet?"ul":"ol";
      if(listType!==type){flush();listType=type;}
      listItems.push((bullet||numbered)[1]);continue;
    }
    flush();
    if(/^(note|important|reminder|warning)\b/i.test(line))out.push('<div class="callout">⚠️ '+escapeHtml(line)+"</div>");
    else out.push("<p>"+escapeHtml(line)+"</p>");
  }
  flush();
  return out.join("");
}
function normalizeArticle(body,{edit=false}={}){
  const title=String(body.title??"").trim();
  const categoryId=Number(body.categoryId??body.cat);
  const content=String(body.body??"").trim();
  if(title.length<3||title.length>180)throw new Error("Title must be between 3 and 180 characters.");
  if(!CATEGORY_IDS.has(categoryId))throw new Error("Choose a valid article category.");
  if(content.length<10||content.length>30000)throw new Error("Article content must be between 10 and 30,000 characters.");
  const rawTags=Array.isArray(body.tags)?body.tags.join(","):String(body.tags??"");
  const tags=[...new Set(rawTags.split(/[,;\n]/).map(x=>x.trim()).filter(Boolean))].slice(0,8);
  const imagesProvided=Array.isArray(body.images);
  if(imagesProvided&&body.images.length>8)throw new Error("You can attach up to 8 images.");
  const images=imagesProvided?body.images.map(cleanArticleImage):undefined;
  if(imagesProvided&&images.some(image=>!image))throw new Error("Images must be secure HTTPS links, supported Knowledge Base image paths or valid PNG/JPG/WEBP uploads.");
  if(imagesProvided&&images.reduce((total,image)=>total+(image.startsWith("data:image/")?image.length:0),0)>900000)throw new Error("The combined uploaded images are too large. Reduce the image size and try again.");
  const sourceReference=String(body.sourceReference??body.source_reference??body.sourceUrl??body.source_url??"").replace(/[\u0000-\u001F\u007F]/g," ").replace(/\s+/g," ").trim().slice(0,500);
  const html=bodyToHtml(content);
  const plain=content.replace(/\s+/g," ").trim();
  const article={title,cat:categoryId,tags,html,source:"kb",source_url:"",source_reference:sourceReference,search_text:(title+" "+plain+" "+tags.join(" ")+" "+sourceReference).toLowerCase()};
  if(images!==undefined)article.images=images;
  if(!edit&&images===undefined)article.images=[];
  return article;
}
function safeJson(value){try{return JSON.parse(value);}catch{return null;}}
function categoryName(id){
  return ({1:"Transfers",2:"Stock",3:"Order Mods",4:"Pricing",5:"Demo Funding",6:"Registration",7:"Delays",8:"Adoption",9:"Brand-Specific",10:"Procedures",11:"Contacts",12:"Call Notes",13:"Reference",14:"Tools & Links",15:"Training",16:"Announcements",17:"Hub Articles"})[Number(id)]||"Knowledge Base";
}
export {CATEGORY_IDS,bodyToHtml,cleanHttps,normalizeArticle,safeJson,categoryName,escapeHtml};
