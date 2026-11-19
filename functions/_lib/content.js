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
  const attachmentsProvided=Array.isArray(body.attachments);
  if(attachmentsProvided&&body.attachments.length>4)throw new Error("You can attach up to 4 supporting files.");
  const allowedAttachments={pdf:"application/pdf",docx:"application/vnd.openxmlformats-officedocument.wordprocessingml.document",xlsx:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",pptx:"application/vnd.openxmlformats-officedocument.presentationml.presentation",txt:"text/plain",csv:"text/csv"};
  const attachments=attachmentsProvided?body.attachments.map(item=>{
    if(!item||typeof item!=="object")throw new Error("A supporting file is invalid.");
    const name=String(item.name||"").replaceAll("/","_").replaceAll(String.fromCharCode(92),"_").replace(/[:*?"<>|\u0000-\u001F]/g,"_").trim().slice(0,120);
    const ext=(name.split(".").pop()||"").toLowerCase(),mime=allowedAttachments[ext],data=String(item.data||"");
    if(!name||!mime||item.type!==mime||!data.startsWith("data:"+mime+";base64,"))throw new Error("Supporting files must be PDF, DOCX, XLSX, PPTX, TXT or CSV.");
    const match=data.match(/^data:([^;]+);base64,([A-Za-z0-9+/]+={0,2})$/);
    if(!match)throw new Error("A supporting file could not be verified.");
    let raw;try{raw=atob(match[2]);}catch{throw new Error("A supporting file is not valid base64 data.");}
    if(!raw.length||raw.length>200*1024)throw new Error("Each supporting file must be 200 KB or smaller.");
    if(ext==="pdf"&&!raw.startsWith("%PDF-"))throw new Error("A PDF attachment has an invalid file signature.");
    if(["docx","xlsx","pptx"].includes(ext)&&!(raw.charCodeAt(0)===0x50&&raw.charCodeAt(1)===0x4b))throw new Error("An Office document has an invalid file signature.");
    if(["txt","csv"].includes(ext)&&raw.includes("\u0000"))throw new Error("Text attachments cannot contain binary data.");
    return {name,type:mime,size:raw.length,data};
  }):undefined;
  if(attachmentsProvided&&attachments.reduce((total,item)=>total+item.data.length,0)>500000)throw new Error("Supporting files exceed the combined upload limit.");
  const sourceReference=String(body.sourceReference??body.source_reference??body.sourceUrl??body.source_url??"").replace(/[\u0000-\u001F\u007F]/g," ").replace(/\s+/g," ").trim().slice(0,500);
  const html=bodyToHtml(content);
  const plain=content.replace(/\s+/g," ").trim();
  const article={title,cat:categoryId,tags,html,source:"kb",source_url:"",source_reference:sourceReference,search_text:(title+" "+plain+" "+tags.join(" ")+" "+sourceReference).toLowerCase()};
  if(images!==undefined)article.images=images;
  if(!edit&&images===undefined)article.images=[];
  if(attachments!==undefined)article.attachments=attachments;
  if(!edit&&attachments===undefined)article.attachments=[];
  return article;
}
function safeJson(value){try{return JSON.parse(value);}catch{return null;}}
function categoryName(id){
  return ({1:"Transfers",2:"Stock",3:"Order Mods",4:"Pricing",5:"Demo Funding",6:"Registration",7:"Delays",8:"Adoption",9:"Brand-Specific",10:"Procedures",11:"Contacts",12:"Call Notes",13:"Reference",14:"Tools & Links",15:"Training",16:"Announcements",17:"Hub Articles"})[Number(id)]||"Knowledge Base";
}
export {CATEGORY_IDS,bodyToHtml,cleanHttps,normalizeArticle,safeJson,categoryName,escapeHtml};
