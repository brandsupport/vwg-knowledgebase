export async function notifyAdmins(db,{type,title,message,targetUrl="/admin",createdAt=Date.now()}){
  const rows=await db.prepare("SELECT id FROM users WHERE role='admin' AND status='active'").all();
  const admins=rows.results||[];
  if(!admins.length)return;
  await db.batch(admins.map(admin=>db.prepare(
    "INSERT INTO admin_notifications(id,admin_id,type,title,message,target_url,created_at) VALUES(?,?,?,?,?,?,?)"
  ).bind(crypto.randomUUID(),admin.id,String(type||"update").slice(0,40),String(title||"Knowledge Base update").slice(0,180),String(message||"").slice(0,500),String(targetUrl||"/admin").slice(0,300),createdAt)));
}
