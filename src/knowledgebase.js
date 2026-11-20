const DATA = JSON.parse(document.getElementById('site-data').textContent);
const CATS = DATA.categories;
const BASE_ARTICLES = DATA.articles.slice();
let ARTICLES = BASE_ARTICLES.slice();
const catById = Object.fromEntries(CATS.map(c => [c.id, c]));

function articlesForCat(id){ return ARTICLES.filter(a => a.cat === id); }
function articleLabel(a){
  if(a.label) return a.label;
  if(a.source === 'notion') return 'FROM NOTION';
  if(a.source === 'excel' || a.source === 'gsheet') return 'TEAM ARTICLE';
  return `TIP ${a.id}`;
}

function escapeHtml(s){
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function highlight(text, q){
  if(!q) return escapeHtml(text);
  const esc = escapeHtml(text);
  const term = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return esc.replace(new RegExp('('+term+')', 'ig'), '<mark>$1</mark>');
}
function snippetFor(article, q){
  const plain = article.html.replace(/<[^>]+>/g, ' ').replace(/\s+/g,' ').trim();
  if(!q) return plain.slice(0, 140) + (plain.length>140?'…':'');
  const idx = plain.toLowerCase().indexOf(q.toLowerCase());
  if(idx === -1) return plain.slice(0,140) + (plain.length>140?'…':'');
  const start = Math.max(0, idx-40);
  return (start>0?'…':'') + plain.slice(start, idx+100) + '…';
}
function renderFilterChip(label, active, onclickAttr, extraClass){
  return `<span class="filter-chip${active?' active':''} ${extraClass||''}" ${onclickAttr}>${label}</span>`;
}
function renderTagChip(tag, active, clickable){
  return `<span class="tag-chip${active?' active':''}" data-tag="${escapeHtml(tag)}" ${clickable?'onclick="onTagClick(event, this)"':''}>${escapeHtml(tag)}</span>`;
}
function allTagsFor(list){
  const set = new Set();
  list.forEach(a => a.tags.forEach(t => set.add(t)));
  return [...set].sort();
}
function favoriteButtonHtml(article){
  if(!accountState.user) return '';
  const saved=accountState.favorites.has(String(article.id));
  const label=saved?'Remove from favorites':'Save to favorites';
  return '<button type="button" class="favorite-button'+(saved?' is-favorite':'')+'" aria-pressed="'+saved+'" aria-label="'+label+'" title="'+label+'" onclick="toggleFavorite(event,'+Number(article.id)+')">'+(saved?'★ Saved':'☆ Save')+'</button>';
}
async function toggleFavorite(event,articleId){
  event.preventDefault();
  event.stopPropagation();
  if(!accountState.user){location.href='/login';return;}
  const button=event.currentTarget;
  const nextSaved=!accountState.favorites.has(String(articleId));
  button.disabled=true;
  try{
    const response=await fetch('/api/favorites',{
      method:'POST',
      credentials:'same-origin',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({articleId:String(articleId),favorite:nextSaved})
    });
    const data=await response.json();
    if(!response.ok) throw new Error(data.error||'Could not update favorites.');
    if(nextSaved) accountState.favorites.add(String(articleId));
    else accountState.favorites.delete(String(articleId));
    renderContent();
  }catch(error){
    button.disabled=false;
    button.title=error.message||'Could not update favorites. Please retry.';
  }
}

let state = { route:'home', articleId:null, query:'', activeCat:null, activeTag:null };
let feedLimit = 24;
const accountState = { user:null, favorites:new Set(), ready:false };

async function loadAccountState(){
  try{
    const response=await fetch('/api/auth/me',{credentials:'same-origin',cache:'no-store'});
    const data=response.ok?await response.json():{user:null};
    accountState.user=data.user||null;
    accountState.favorites=new Set();
    if(accountState.user){
      const favoritesResponse=await fetch('/api/favorites',{credentials:'same-origin',cache:'no-store'});
      if(favoritesResponse.ok){
        const favoritesData=await favoritesResponse.json();
        accountState.favorites=new Set((favoritesData.favorites||[]).map(String));
      }
    }
  }catch(error){
    accountState.user=null;
    accountState.favorites=new Set();
  }
  try{
    const contentResponse=await fetch('/api/content',{credentials:'same-origin',cache:'no-store'});
    if(contentResponse.ok){
      const content=await contentResponse.json();
      const deletedIds=new Set((content.deletedIds||[]).map(String));
      const merged=new Map(BASE_ARTICLES.filter(article=>!deletedIds.has(String(article.id))).map(article=>[String(article.id),article]));
      (content.articles||[]).forEach(article=>merged.set(String(article.id),article));
      (content.overrides||[]).forEach(article=>{
        const key=String(article.id),previous=merged.get(key);
        merged.set(key,{...(previous||{}),...article,images:article.images??previous?.images??[]});
      });
      ARTICLES=[...merged.values()].filter(article=>!deletedIds.has(String(article.id)));
    }
  }catch(error){}
  accountState.ready=true;
  renderContent();
}

function navigate(route, opts={}){
  closeMegaMenu();
  state = { route, articleId: opts.articleId ?? null, query: opts.query ?? '', activeCat: opts.catId ?? null, activeTag:null };
  feedLimit = 24;
  const hash = route === 'home' ? (opts.catId ? `#/browse/${opts.catId}` : '#/') :
    route === 'article' ? `#/article/${opts.articleId}` :
    route === 'search' ? `#/search?q=${encodeURIComponent(opts.query||'')}` :
    route === 'favorites' ? '#/favorites' :
    route === 'announcements' ? '#/announcements' :
    route === 'hub' ? '#/hub-articles' :
    route === 'submit' ? (opts.articleId ? '#/submit?edit='+opts.articleId : '#/submit') : '#/';
  if(location.hash !== hash) location.hash = hash;
  render();
}

function onTagClick(ev, el){
  ev.stopPropagation();
  const tag = el.getAttribute('data-tag');
  state.activeTag = (state.activeTag === tag) ? null : tag;
  feedLimit = 24;
  renderContent();
}

function toggleMegaMenu(ev){
  ev.stopPropagation();
  const menu = document.getElementById('megaMenu');
  const scrim = document.getElementById('menuScrim');
  const open = menu.classList.toggle('open');
  scrim.classList.toggle('open', open);
}
function closeMegaMenu(){
  document.getElementById('megaMenu').classList.remove('open');
  document.getElementById('menuScrim').classList.remove('open');
}
function filterByCategory(id){
  closeMegaMenu();
  navigate('home', {catId: id});
}

function renderMegaGrid(){
  const grid = document.getElementById('megaGrid');
  grid.innerHTML = CATS.map(c => `
    <div class="mega-item" onclick="filterByCategory(${c.id})">
      <span>${c.icon}</span><span>${escapeHtml(c.short)}</span>
      <span class="count">${articlesForCat(c.id).length}</span>
    </div>`).join('');
}

function renderHeaderState(){
  document.getElementById('navHomeLink').classList.toggle('active', state.route==='home' && !state.activeCat);
  document.getElementById('navCatLink').classList.toggle('active', state.route==='home' && !!state.activeCat);
  const favoritesLink=document.getElementById('navFavoritesLink');
  if(favoritesLink) favoritesLink.classList.toggle('active',state.route==='favorites');
  const announcementsLink=document.getElementById('navAnnouncementsLink');
  if(announcementsLink) announcementsLink.classList.toggle('active',state.route==='announcements');
  const hubLink=document.getElementById('navHubArticlesLink');
  if(hubLink) hubLink.classList.toggle('active',state.route==='hub');
  const submitLink=document.getElementById('navSubmitLink');
  if(submitLink) submitLink.classList.toggle('active',state.route==='submit');
  const profileName=document.getElementById('profileName');
  if(profileName) profileName.textContent=accountState.user?accountState.user.name:'My account';
  const avatar=accountState.user?.avatar||'👤';
  const profileAvatar=document.getElementById('profileAvatar');
  const profileMenuAvatar=document.getElementById('profileMenuAvatar');
  if(profileAvatar) profileAvatar.textContent=avatar;
  if(profileMenuAvatar) profileMenuAvatar.textContent=avatar;
  const adminLink=document.getElementById('profileAdminLink');
  if(adminLink) adminLink.hidden=!(accountState.user&&accountState.user.role==='admin');
  document.getElementById('footerMeta').textContent = `${ARTICLES.length} articles indexed`;
}

// Pick one featured article per page load so the feature stays stable while browsing.
const FEATURED_ARTICLE = ARTICLES.length
  ? ARTICLES[Math.floor(Math.random() * ARTICLES.length)]
  : null;
function getFeatured(){
  return FEATURED_ARTICLE || ARTICLES[0];
}

function renderHome(){
  const el = document.getElementById('content');
  const notionCount = ARTICLES.filter(a => a.source === 'notion').length;
  const featured = getFeatured();
  const featCat = catById[featured.cat];

  let items = state.activeCat ? articlesForCat(state.activeCat) : ARTICLES.slice();
  const tagPool = allTagsFor(items).slice(0, 24);
  if(state.activeTag) items = items.filter(a => a.tags.includes(state.activeTag));

  const visible = items.slice(0, feedLimit);

  el.innerHTML = `
    <div class="page">
      <section class="hero">
        <div class="eyebrow">VWG Brand Support</div>
        <h1>Every process, in one searchable place.</h1>
        <p>${ARTICLES.length} articles from the team and the VW Brand Support Notion workspace, sorted into ${CATS.length} categories. Search by keyword, bulletin code, email, or brand.</p>
        <div class="hero-search">
          <span class="icon">&#128269;</span>
          <input id="heroSearchInput" type="text" placeholder="Search tips, codes, emails, brands…" autocomplete="off">
        </div>
        <div class="stat-row">
          <div class="stat-chip"><div class="num">${ARTICLES.length}</div><div class="label">Articles</div></div>
          <div class="stat-chip"><div class="num">${CATS.length}</div><div class="label">Categories</div></div>
          <div class="stat-chip"><div class="num">${notionCount}</div><div class="label">From Notion</div></div>
        </div>
      </section>

      <div class="featured-card">
        <div class="featured-text">
          <div class="eyebrow">Featured · ${escapeHtml(featCat.short)}</div>
          <h2>${escapeHtml(featured.title)}</h2>
          <p>${escapeHtml(snippetFor(featured,''))}</p>
          <div class="featured-actions">
            <span class="featured-cta" onclick="navigate('article',{articleId:${featured.id}})">Read the article &rarr;</span>
            ${favoriteButtonHtml(featured)}
          </div>
        </div>
        <div class="featured-visual">${featCat.icon}</div>
      </div>

      <div id="feedSection">
        <div class="section-label">Browse by category</div>
        <div class="filter-bar">
          ${renderFilterChip('All', !state.activeCat, `onclick="filterByCategory(null)"`)}
          ${CATS.map(c => renderFilterChip(`${c.icon} ${escapeHtml(c.short)} <span style="opacity:.6">${articlesForCat(c.id).length}</span>`, state.activeCat===c.id, `onclick="filterByCategory(${c.id})"`)).join('')}
        </div>
        ${tagPool.length ? `<div class="tag-row">${tagPool.map(t=>renderTagChip(t, state.activeTag===t, true)).join('')}</div>` : ''}
        <div class="section-label">${items.length} article${items.length===1?'':'s'}</div>
        <div class="feed-grid">
          ${visible.map(a => feedCardHtml(a, '')).join('') || '<div class="empty-state">No articles match this filter.</div>'}
        </div>
        ${items.length > visible.length ? `<div class="load-more-wrap"><button class="load-more" onclick="loadMoreFeed()">Load more (${items.length - visible.length} remaining)</button></div>` : ''}
      </div>
    </div>
  `;
  document.getElementById('heroSearchInput').addEventListener('input', onHeroSearchInput);
  document.getElementById('heroSearchInput').addEventListener('keydown', onSearchKeydown);
}

function feedCardHtml(a, q){
  const cat = catById[a.cat];
  return `
    <div class="article-card" onclick="navigate('article',{articleId:${a.id}})">
      <div class="article-card-meta">
        <span class="num">${cat.icon} ${escapeHtml(cat.short).toUpperCase()} &middot; ${articleLabel(a)}</span>
        ${favoriteButtonHtml(a)}
      </div>
      <div class="title">${q ? highlight(a.title,q) : escapeHtml(a.title)}</div>
      <div class="snippet">${q ? highlight(snippetFor(a,q),q) : escapeHtml(snippetFor(a,''))}</div>
      <div class="card-tags">${a.tags.map(t=>renderTagChip(t,false,false)).join('')}</div>
    </div>`;
}

function loadMoreFeed(){
  feedLimit += 24;
  renderContent();
}

function renderArticle(articleId){
  const a = ARTICLES.find(x => x.id === articleId);
  const cat = catById[a.cat];
  const el = document.getElementById('content');
  el.innerHTML = `
    <div class="page">
      <div class="article-page">
        <a class="back-link" onclick="navigate('home',{catId:${a.cat}})">&larr; ${escapeHtml(cat.title)}</a>
        <div class="article-detail">
          <div class="cat-label">${cat.icon} ${escapeHtml(cat.title).toUpperCase()} &middot; ${articleLabel(a)}</div>
          <h1>${escapeHtml(a.title)}</h1>
          <div class="article-detail-actions">
            <div class="article-save-action">${favoriteButtonHtml(a)}</div>
            <div class="article-detail-action-spacer"></div>
            ${accountState.user&&accountState.user.role==='admin'?'<div class="article-admin-actions"><span class="article-admin-label">ADMIN TOOLS</span><button type="button" class="article-action-button article-action-edit" onclick="navigate(\'submit\',{articleId:'+Number(a.id)+'})"><span aria-hidden="true">✎</span> Edit article</button><button type="button" class="article-action-button article-action-remove" onclick="adminDeleteArticle('+Number(a.id)+')"><span aria-hidden="true">⌫</span> Move to recycle bin</button></div>':'<button type="button" class="article-action-button article-action-edit" onclick="navigate(\'submit\',{articleId:'+Number(a.id)+'})">Suggest an update</button>'}
          </div>
          <div class="article-body">${a.html}</div>
          ${a.images.map(src => `<img src="${src}" loading="lazy" alt="Reference screenshot for ${escapeHtml(a.title)}">`).join('')}
          ${Array.isArray(a.attachments)&&a.attachments.length?`<div class="article-attachments"><h3>Supporting files</h3>${a.attachments.filter(item=>item&&typeof item.data==='string'&&item.data.startsWith('data:')&&!item.data.includes('"')&&!item.data.includes('<')).map(item=>`<a class="article-attachment-link" href="${escapeHtml(item.data)}" download="${escapeHtml(item.name||'attachment')}"><span>📎 ${escapeHtml(item.name||'Supporting file')}</span><small>${Math.max(1,Math.ceil((Number(item.size)||0)/1024))} KB · Download</small></a>`).join('')}</div>`:''}
          <div class="detail-tags">${a.tags.map(t=>renderTagChip(t,false,false)).join('')}</div>
          ${a.source_reference ? `<div class="article-source-note"><strong>Source / reference:</strong> ${escapeHtml(a.source_reference)}</div>` : ''}
          ${a.source_url ? `<div style="margin-top:10px;"><a class="back-link" href="${escapeHtml(a.source_url)}" target="_blank" rel="noopener" style="margin-bottom:0;">${a.source === 'notion' ? 'View original in Notion' : 'View source'} &#8599;</a></div>` : ''}
        </div>
      </div>
    </div>
  `;
}

async function adminDeleteArticle(articleId){
  if(!accountState.user||accountState.user.role!=='admin')return;
  const article=ARTICLES.find(item=>String(item.id)===String(articleId));if(!article)return;
  if(!confirm('Move “'+article.title+'” to the recycle bin? It can be restored by an administrator.'))return;
  try{
    const r=await fetch('/api/content-admin/delete',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({articleId:String(article.id),article})}),d=await r.json();
    if(!r.ok)throw new Error(d.error||'Could not delete article.');
    ARTICLES=ARTICLES.filter(item=>String(item.id)!==String(article.id));navigate('home');
  }catch(error){alert(error.message||'Could not move this article to the recycle bin.');}
}
function searchArticles(q){
  const term = q.trim().toLowerCase();
  if(!term) return [];
  return ARTICLES
    .map(a => ({ a, score: scoreMatch(a, term) }))
    .filter(x => x.score > 0)
    .sort((x,y) => y.score - x.score)
    .map(x => x.a);
}
function scoreMatch(a, term){
  let score = 0;
  if(a.title.toLowerCase().includes(term)) score += 5;
  if(a.tags.some(t => t.toLowerCase().includes(term))) score += 4;
  if(String(a.id) === term) score += 6;
  const occurrences = a.search_text.split(term).length - 1;
  score += Math.min(occurrences, 5);
  return score;
}

function renderSearch(q){
  const el = document.getElementById('content');
  const results = searchArticles(q);
  const visible = results.slice(0, feedLimit);
  el.innerHTML = `
    <div class="page search-page">
      <a class="back-link" onclick="navigate('home')">&larr; Home</a>
      <div class="section-label">Search</div>
      <div class="search-results-head">${results.length} result${results.length===1?'':'s'} for “${escapeHtml(q)}”</div>
      <div class="feed-grid">
        ${visible.map(a => feedCardHtml(a, q)).join('') || `<div class="empty-state">No articles match “${escapeHtml(q)}”. Try different keywords, a brand name, or a bulletin code.</div>`}
      </div>
      ${results.length > visible.length ? `<div class="load-more-wrap"><button class="load-more" onclick="loadMoreFeed()">Load more (${results.length - visible.length} remaining)</button></div>` : ''}
    </div>
  `;
}


function renderCategorySection(categoryId,heading,description){
  const el=document.getElementById('content');
  const list=ARTICLES.filter(article=>Number(article.cat)===Number(categoryId)).sort((a,b)=>Number(b.id)-Number(a.id));
  el.innerHTML=`
    <div class="page search-page">
      <div class="section-label">VWG Brand Support</div>
      <div class="content-section-heading">
        <div><h1>${escapeHtml(heading)}</h1><p>${escapeHtml(description)}</p></div>
        <span class="favorites-count">${list.length} article${list.length===1?'':'s'}</span>
      </div>
      <div class="feed-grid">${list.map(article=>feedCardHtml(article,'')).join('')||'<div class="empty-state">No approved articles in this section yet.</div>'}</div>
    </div>`;
}
function htmlToEditorText(value){
  const holder=document.createElement('div');
  const normalized=String(value||'').replace(new RegExp("</(p|h3|h4|li|div|ul|ol)>","gi"),"\n");
  holder.innerHTML=normalized;
  return (holder.innerText||holder.textContent||'').replace(new RegExp("\\n{3,}","g"),"\n\n").trim();
}
function renderArticleRequest(articleId){
  const el=document.getElementById('content');
  const article=articleId?ARTICLES.find(item=>String(item.id)===String(articleId)):null;
  if(articleId&&!article){
    el.innerHTML='<div class="page search-page"><div class="empty-state">The article could not be found. Please return to the Knowledge Base and try again.</div></div>';
    return;
  }
  const editing=Boolean(article);
  const cancelAction=editing?"navigate('article',{articleId:"+Number(article.id)+"})":"navigate('home')";
  const categoryOptions=CATS.map(category=>'<option value="'+category.id+'"'+(editing&&Number(article.cat)===Number(category.id)?' selected':'')+'>'+escapeHtml(category.title)+'</option>').join('');
  const source=editing?(article.source_reference||article.source_url||''):'';
  el.innerHTML=`
    <div class="page search-page">
      <div class="article-form-shell">
        <a class="back-link" onclick="${cancelAction}">&larr; ${editing?'Back to article':'Back to Knowledge Base'}</a>
        <div class="article-form-kicker">${editing?'ARTICLE UPDATE':'KNOWLEDGE CONTRIBUTION'}</div>
        <h1>${editing?'Edit article':'Share your knowledge'}</h1>
        <p class="article-form-intro">${editing?'Suggest a clearer or more up-to-date version. Your changes will be reviewed before replacing the published article.':'Add something useful to the team’s knowledge. Your contribution will be reviewed by an administrator before it is published.'}</p>
        <div class="article-form-review-note"><span class="review-note-dot"></span>${editing?'Your changes stay pending until an administrator approves them.':'Every contribution is reviewed before it appears in the Knowledge Base.'}</div>
        <form id="articleRequestForm" class="article-request-form">
          <section class="article-form-section">
            <div class="article-form-section-head"><span class="article-form-step">01</span><div><h2>Article details</h2><p>Give the contribution a clear title and category.</p></div></div>
            <div class="article-form-fields">
              <label for="requestTitle">Article title <span class="form-required">*</span></label>
              <input class="kb-form-control" id="requestTitle" maxlength="180" required value="${editing?escapeHtml(article.title):''}" placeholder="Enter a clear article title">
              <div class="article-form-field-grid">
                <div class="article-form-field">
                  <label for="requestCategory">Category <span class="form-required">*</span></label>
                  <select class="kb-form-control" id="requestCategory" required>${categoryOptions}</select>
                </div>
                <div class="article-form-field">
                  <label for="requestTags">Tags / keywords <span class="form-optional">Optional</span></label>
                  <input class="kb-form-control" id="requestTags" maxlength="500" value="${editing?escapeHtml((article.tags||[]).join(', ')):''}" placeholder="e.g. SLI, Audi, Transport">
                </div>
              </div>
            </div>
          </section>
          <section class="article-form-section">
            <div class="article-form-section-head"><span class="article-form-step">02</span><div><h2>Article content</h2><p>Explain the process in clear steps another colleague can follow.</p></div></div>
            <div class="article-form-fields">
              <label for="requestBody">Content <span class="form-required">*</span></label>
              <textarea class="kb-form-control kb-form-textarea" id="requestBody" required minlength="10" maxlength="30000" placeholder="Write the article here. Use ## for headings, - for bullet points and 1. for numbered steps.">${editing?escapeHtml(htmlToEditorText(article.html)):''}</textarea>
              <div class="form-field-tip">Include any relevant status codes, checks, system references or exceptions.</div>
            </div>
          </section>
          <section class="article-form-section">
            <div class="article-form-section-head"><span class="article-form-step">03</span><div><h2>Images, files and references</h2><p>Add screenshots or optional supporting documents to help colleagues follow the instructions.</p></div></div>
            <div class="article-form-fields">
              <label for="requestImageFiles">Screenshots and images <span class="form-optional">Optional</span></label>
              <div class="image-upload-field">
                <input class="image-file-input" id="requestImageFiles" type="file" accept="image/png,image/jpeg,image/webp" multiple>
                <label class="image-upload-dropzone" id="imageUploadDropzone" for="requestImageFiles">
                  <span class="image-upload-icon" aria-hidden="true">↑</span>
                  <span class="image-upload-copy"><strong>Choose images to upload</strong><small>or drag and drop them here · PNG, JPG or WEBP · up to 8 images</small></span>
                  <span class="image-upload-browse">Browse files</span>
                </label>
                <div id="imageUploadStatus" class="image-upload-status" aria-live="polite">No new images selected.</div>
                <div id="imagePreviewGrid" class="image-preview-grid"></div>
              </div>
              <details class="image-links-fallback">
                <summary>Or add images using secure HTTPS links</summary>
                <textarea class="kb-form-control" id="requestImageLinks" rows="2" placeholder="Paste one HTTPS image link per line"></textarea>
              </details>
              <div class="article-file-upload-field">
                <label for="requestAttachmentFiles">Supporting files <span class="form-optional">Optional</span></label>
                <div class="article-file-upload-row">
                  <input class="image-file-input" id="requestAttachmentFiles" type="file" accept=".pdf,.docx,.xlsx,.pptx,.txt,.csv,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.openxmlformats-officedocument.presentationml.presentation,text/plain,text/csv" multiple>
                  <label class="image-upload-dropzone" id="attachmentUploadDropzone" for="requestAttachmentFiles">
                    <span class="image-upload-icon" aria-hidden="true">📎</span>
                    <span class="image-upload-copy"><strong>Choose supporting files</strong><small>PDF, DOCX, XLSX, PPTX, TXT or CSV · up to 4 files · 200 KB each</small></span>
                    <span class="image-upload-browse">Browse files</span>
                  </label>
                  <div id="attachmentUploadStatus" class="image-upload-status" aria-live="polite">No supporting files selected.</div>
                  <div id="attachmentPreviewList" class="attachment-preview-list"></div>
                </div>
              </div>
              <div class="form-helper">${editing?'Your existing article images are shown above. Remove any image you no longer need.':'Images are automatically resized and optimised before submission.'}</div>
              <div class="article-form-field source-field">
                <label for="requestSource">Source / reference <span class="form-optional">Optional</span></label>
                <input class="kb-form-control" id="requestSource" type="text" inputmode="text" maxlength="500" value="${escapeHtml(source)}" placeholder="e.g. VW bulletin 12345, internal procedure">
                <div class="form-helper">Enter a short text reference, not a web link.</div>
              </div>
            </div>
          </section>
          <div class="article-form-actions">
            <button class="form-cancel-button" type="button" onclick="${cancelAction}">Cancel</button>
            <button class="article-form-submit" id="requestSubmit" type="submit">${editing?'Send update for approval':'Submit for review'}</button>
          </div>
          <div class="article-form-message" id="requestMessage" role="status" aria-live="polite"></div>
        </form>
      </div>
    </div>`;
  const imageState=(editing&&Array.isArray(article.images)?article.images:[])
    .filter(src=>typeof src==='string'&&(src.startsWith('https://')||/^data:image\/(?:webp|jpeg|png);base64,[A-Za-z0-9+/]+={0,2}$/.test(src)||(/^(?:article_images|agency_approval_images|stock_replacement_images)\/[A-Za-z0-9_-][A-Za-z0-9._/-]*$/.test(src)&&!src.includes('..'))))
    .map((src,index)=>({src,name:'Existing image '+(index+1)}));
  const attachmentState=(editing&&Array.isArray(article.attachments)?article.attachments:[])
    .filter(item=>item&&typeof item==='object'&&typeof item.name==='string'&&typeof item.data==='string'&&item.data.startsWith('data:')&&item.data.length<=500000)
    .map(item=>({name:item.name,type:String(item.type||''),size:Number(item.size)||0,data:item.data}));
  const imageInput=document.getElementById('requestImageFiles');
  const imageDropzone=document.getElementById('imageUploadDropzone');
  const imageGrid=document.getElementById('imagePreviewGrid');
  const imageStatus=document.getElementById('imageUploadStatus');
  const imageLinks=document.getElementById('requestImageLinks');
  const MAX_IMAGES=8,MAX_IMAGE_TOTAL=900000;
  const attachmentInput=document.getElementById('requestAttachmentFiles');
  const attachmentDropzone=document.getElementById('attachmentUploadDropzone');
  const attachmentList=document.getElementById('attachmentPreviewList');
  const attachmentStatus=document.getElementById('attachmentUploadStatus');
  const MAX_ATTACHMENTS=4,MAX_ATTACHMENT_TOTAL=500000,MAX_ATTACHMENT_SIZE=200*1024;
  const ATTACHMENT_TYPES={pdf:'application/pdf',docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',xlsx:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',pptx:'application/vnd.openxmlformats-officedocument.presentationml.presentation',txt:'text/plain',csv:'text/csv'};
  function renderImagePreviews(){
    imageGrid.replaceChildren();
    imageState.forEach((item,index)=>{
      const card=document.createElement('div');card.className='image-preview-card';
      const img=document.createElement('img');img.src=item.src;img.alt=item.name||'Article image';
      const footer=document.createElement('div');footer.className='image-preview-footer';
      const name=document.createElement('span');name.className='image-preview-name';name.textContent=item.name||'Article image';
      const remove=document.createElement('button');remove.type='button';remove.className='image-remove-button';remove.textContent='Remove';remove.setAttribute('aria-label','Remove '+name.textContent);
      remove.addEventListener('click',()=>{imageState.splice(index,1);renderImagePreviews();});
      footer.append(name,remove);card.append(img,footer);imageGrid.append(card);
    });
    const newCount=imageState.filter(item=>item.src.startsWith('data:image/')).length;
    imageStatus.textContent=imageState.length
      ?imageState.length+' image'+(imageState.length===1?'':'s')+' attached · '+newCount+' uploaded'
      :'No images selected yet.';
  }
  async function optimiseImage(file){
    if(!/^image\/(png|jpeg|webp)$/.test(file.type))throw new Error(file.name+': use a PNG, JPG or WEBP image.');
    if(file.size>8*1024*1024)throw new Error(file.name+': the original file must be smaller than 8 MB.');
    if(typeof createImageBitmap!=='function')throw new Error('Image uploads are not supported by this browser. Please use an HTTPS image link instead.');
    const bitmap=await createImageBitmap(file);
    let width=bitmap.width,height=bitmap.height;
    const scale=Math.min(1,1500/Math.max(width,height));
    width=Math.max(1,Math.round(width*scale));height=Math.max(1,Math.round(height*scale));
    const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
    const context=canvas.getContext('2d');if(!context){bitmap.close();throw new Error('Your browser could not prepare this image.');}
    context.drawImage(bitmap,0,0,width,height);bitmap.close();
    let mime='image/webp',quality=.82,result=canvas.toDataURL(mime,quality);
    if(!result.startsWith('data:image/webp,')){mime='image/jpeg';result=canvas.toDataURL(mime,quality);}
    while(result.length>380000){
      if(quality>.55){quality-=.08;}
      else{const resized=document.createElement('canvas');const factor=.82;width=Math.max(1,Math.round(width*factor));height=Math.max(1,Math.round(height*factor));resized.width=width;resized.height=height;const ctx=resized.getContext('2d');if(!ctx)break;ctx.drawImage(canvas,0,0,width,height);canvas.width=width;canvas.height=height;canvas.getContext('2d').drawImage(resized,0,0);quality=.68;}
      result=canvas.toDataURL(mime,quality);
      if(width<=500&&height<=500&&result.length>380000)break;
    }
    if(result.length>380000)throw new Error(file.name+': still too large after optimisation. Please choose a smaller screenshot.');
    return result;
  }
  async function addImageFiles(files){
    const available=MAX_IMAGES-imageState.length;
    if(available<=0){imageStatus.textContent='Maximum of 8 images reached.';return;}
    const chosen=Array.from(files).slice(0,available);
    for(const file of chosen){
      imageStatus.textContent='Optimising '+file.name+'…';
      try{
        const src=await optimiseImage(file);
        const used=imageState.reduce((sum,item)=>sum+(item.src.startsWith('data:image/')?item.src.length:0),0);
        if(used+src.length>MAX_IMAGE_TOTAL)throw new Error('Combined uploaded images are too large. Remove an image or choose smaller screenshots.');
        imageState.push({src,name:file.name});
        renderImagePreviews();
      }catch(error){imageStatus.textContent=error.message||'Could not add this image.';}
    }
    if(imageState.length)imageStatus.textContent=imageState.length+' image'+(imageState.length===1?'':'s')+' ready.';
  }
  imageInput.addEventListener('change',async()=>{const files=Array.from(imageInput.files||[]);imageInput.value='';await addImageFiles(files);});
  ['dragenter','dragover'].forEach(type=>imageDropzone.addEventListener(type,event=>{event.preventDefault();imageDropzone.classList.add('is-dragging');}));
  ['dragleave','drop'].forEach(type=>imageDropzone.addEventListener(type,event=>{event.preventDefault();imageDropzone.classList.remove('is-dragging');}));
  imageDropzone.addEventListener('drop',event=>{event.preventDefault();addImageFiles(event.dataTransfer?.files||[]);});
  function renderAttachmentPreviews(){
    attachmentList.replaceChildren();
    attachmentState.forEach((item,index)=>{
      const row=document.createElement('div');row.className='attachment-preview-item';
      const icon=document.createElement('span');icon.className='attachment-preview-icon';icon.textContent='📎';
      const details=document.createElement('div');details.className='attachment-preview-details';
      const name=document.createElement('strong');name.textContent=item.name;
      const meta=document.createElement('small');meta.textContent=(item.size?Math.ceil(item.size/1024)+' KB':'Existing file')+' · '+String(item.type||'document').split('/').pop().toUpperCase();
      details.append(name,meta);
      const remove=document.createElement('button');remove.type='button';remove.className='image-remove-button';remove.textContent='Remove';remove.setAttribute('aria-label','Remove '+item.name);
      remove.addEventListener('click',()=>{attachmentState.splice(index,1);renderAttachmentPreviews();});
      row.append(icon,details,remove);attachmentList.append(row);
    });
    attachmentStatus.textContent=attachmentState.length?attachmentState.length+' supporting file'+(attachmentState.length===1?'':'s')+' attached.':'No supporting files selected.';
  }
  function readFileAsDataUrl(file){
    return new Promise((resolve,reject)=>{
      const reader=new FileReader();reader.onload=()=>resolve(String(reader.result||''));reader.onerror=()=>reject(new Error(file.name+': could not read this file.'));reader.readAsDataURL(file);
    });
  }
  async function addSupportingFiles(files){
    for(const file of Array.from(files||[])){
      if(attachmentState.length>=MAX_ATTACHMENTS){attachmentStatus.textContent='Maximum of 4 supporting files reached.';break;}
      const ext=(file.name.split('.').pop()||'').toLowerCase(),mime=ATTACHMENT_TYPES[ext];
      if(!mime){attachmentStatus.textContent=file.name+': allowed formats are PDF, DOCX, XLSX, PPTX, TXT and CSV.';continue;}
      if(file.size<=0||file.size>MAX_ATTACHMENT_SIZE){attachmentStatus.textContent=file.name+': each supporting file must be 200 KB or smaller.';continue;}
      attachmentStatus.textContent='Reading '+file.name+'…';
      try{
        const data=await readFileAsDataUrl(file);
        if(!data.startsWith('data:'+mime+';base64,')){attachmentStatus.textContent=file.name+': file type could not be verified by the browser.';continue;}
        const used=attachmentState.reduce((sum,item)=>sum+item.data.length,0);
        if(used+data.length>MAX_ATTACHMENT_TOTAL){attachmentStatus.textContent='Supporting files exceed the combined upload limit. Remove a file or choose smaller files.';break;}
        attachmentState.push({name:file.name,type:mime,size:file.size,data});renderAttachmentPreviews();
      }catch(error){attachmentStatus.textContent=error.message||'Could not add this file.';}
    }
    if(attachmentState.length)attachmentStatus.textContent=attachmentState.length+' supporting file'+(attachmentState.length===1?'':'s')+' ready. (Optional)';
  }
  attachmentInput.addEventListener('change',async()=>{const chosen=Array.from(attachmentInput.files||[]);attachmentInput.value='';await addSupportingFiles(chosen);});
  ['dragenter','dragover'].forEach(type=>attachmentDropzone.addEventListener(type,event=>{event.preventDefault();attachmentDropzone.classList.add('is-dragging');}));
  ['dragleave','drop'].forEach(type=>attachmentDropzone.addEventListener(type,event=>{event.preventDefault();attachmentDropzone.classList.remove('is-dragging');}));
  attachmentDropzone.addEventListener('drop',event=>{event.preventDefault();addSupportingFiles(event.dataTransfer?.files||[]);});
  renderImagePreviews();
  renderAttachmentPreviews();

  document.getElementById('articleRequestForm').addEventListener('submit',async event=>{
    event.preventDefault();
    const submit=document.getElementById('requestSubmit'),message=document.getElementById('requestMessage');
    const imageText=imageLinks.value.trim();
    const linkedImages=imageText?imageText.split(String.fromCharCode(10)).map(x=>x.trim()).filter(Boolean):[];
    const payload={
      requestType:editing?'edit':'new',
      articleId:editing?String(article.id):undefined,
      title:document.getElementById('requestTitle').value,
      categoryId:Number(document.getElementById('requestCategory').value),
      tags:document.getElementById('requestTags').value,
      body:document.getElementById('requestBody').value,
      images:[...imageState.map(item=>item.src),...linkedImages],
      attachments:attachmentState,
      sourceReference:document.getElementById('requestSource').value,
      originalArticle:editing?{id:article.id,title:article.title,cat:article.cat,tags:article.tags,html:article.html,source_url:article.source_url,source_reference:article.source_reference}:undefined
    };
    if(imageState.length+linkedImages.length>MAX_IMAGES){message.textContent='You can attach up to 8 images in total.';return;}
    if(imageState.reduce((sum,item)=>sum+(item.src.startsWith('data:image/')?item.src.length:0),0)>MAX_IMAGE_TOTAL){message.textContent='The uploaded images exceed the combined size limit.';return;}
    if(attachmentState.length>MAX_ATTACHMENTS||attachmentState.reduce((sum,item)=>sum+item.data.length,0)>MAX_ATTACHMENT_TOTAL){message.textContent='Supporting files exceed the upload limit. Remove a file or choose a smaller one.';return;}
    submit.disabled=true;message.textContent='Sending your request for review…';
    try{
      const response=await fetch('/api/content',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
      const result=await response.json();
      if(!response.ok)throw new Error(result.error||'The request could not be submitted.');
      el.innerHTML='<div class="page search-page"><div class="article-form-shell"><div class="success-mark">✓</div><div class="section-label">Request received</div><h1>Thank you for contributing.</h1><p class="article-form-intro">Your '+(editing?'article update':'article submission')+' is now pending administrator approval. It will not appear in the published Knowledge Base until it has been reviewed.</p><div class="article-form-actions"><button class="article-form-submit" onclick="navigate(\'home\')">Return to Knowledge Base</button></div></div></div>';
    }catch(error){message.textContent=error.message||'Please retry your submission.';submit.disabled=false;}
  });
}

function renderFavorites(){
  const el=document.getElementById('content');
  const saved=ARTICLES.filter(article=>accountState.favorites.has(String(article.id)));
  el.innerHTML=`
    <div class="page search-page">
      <div class="favorites-heading">
        <div><div class="section-label">Your library</div><h1>Favorite articles</h1><p>Articles you save are kept in your account and available whenever you sign in.</p></div>
        <span class="favorites-count">${saved.length} saved</span>
      </div>
      <div class="feed-grid">
        ${saved.map(article=>feedCardHtml(article,'')).join('')||'<div class="empty-state">You have not saved any articles yet. Use the ☆ Save button on an article to keep it here.</div>'}
      </div>
    </div>`;
}

function renderContent(){
  if(state.route === 'home') renderHome();
  else if(state.route === 'article') renderArticle(state.articleId);
  else if(state.route === 'search') renderSearch(state.query);
  else if(state.route === 'favorites') renderFavorites();
  else if(state.route === 'announcements') renderCategorySection(16,'Announcements','Important updates, notices and changes for the Brand Support team.');
  else if(state.route === 'hub') renderCategorySection(17,'Hub Articles','Guides, procedures and useful articles from the Hub.');
  else if(state.route === 'submit') renderArticleRequest(state.articleId);
  renderMegaGrid();
  renderHeaderState();
  const si = document.getElementById('searchInput');
  if(si) si.value = state.route === 'search' ? state.query : '';
}
function render(){ renderContent(); window.scrollTo(0,0); }

function parseHash(){
  const h = location.hash.replace(/^#\/?/, '');
  if(h==='favorites') return {route:'favorites'};
  if(h==='announcements') return {route:'announcements'};
  if(h==='hub-articles') return {route:'hub'};
  if(h.split('?')[0]==='submit'){
    const queryString=h.includes('?')?h.slice(h.indexOf('?')+1):'';
    const edit=new URLSearchParams(queryString).get('edit');
    return {route:'submit',articleId:edit||null};
  }
  if(h.startsWith('browse/')) return {route:'home', catId:parseInt(h.split('/')[1],10)};
  if(h.startsWith('article/')) return {route:'article', articleId:parseInt(h.split('/')[1],10)};
  if(h.startsWith('search')) {
    const qm = h.indexOf('?q=');
    return {route:'search', query: qm>=0 ? decodeURIComponent(h.slice(qm+3)) : ''};
  }
  return {route:'home'};
}

window.addEventListener('hashchange', () => {
  const r = parseHash();
  state = { route:r.route, articleId:r.articleId??null, query:r.query??'', activeCat:r.catId??null, activeTag:null };
  feedLimit = 24;
  render();
});

let searchDebounce;
function onHeaderSearchInput(e){
  const q = e.target.value;
  clearTimeout(searchDebounce);
  searchDebounce = setTimeout(() => { if(q.trim()) navigate('search', {query:q}); else navigate('home'); }, 150);
}
function onHeroSearchInput(e){ onHeaderSearchInput(e); }
function onSearchKeydown(e){
  if(e.key === 'Enter'){ e.preventDefault(); const q=e.target.value; if(q.trim()) navigate('search',{query:q}); }
}
document.getElementById('searchInput').addEventListener('input', onHeaderSearchInput);
document.getElementById('searchInput').addEventListener('keydown', onSearchKeydown);

const profileButton=document.getElementById('profileButton');
const profileMenu=document.getElementById('profileMenu');
function closeProfileMenu(){
  if(profileMenu) profileMenu.hidden=true;
  if(profileButton) profileButton.setAttribute('aria-expanded','false');
}
if(profileButton&&profileMenu){
  profileButton.addEventListener('click',event=>{
    event.stopPropagation();
    profileMenu.hidden=!profileMenu.hidden;
    profileButton.setAttribute('aria-expanded',String(!profileMenu.hidden));
  });
  profileMenu.addEventListener('click',event=>event.stopPropagation());
  document.addEventListener('click',closeProfileMenu);
}
const profileLogout=document.getElementById('profileLogout');
if(profileLogout){
  profileLogout.addEventListener('click',async()=>{
    profileLogout.disabled=true;
    try{
      const response=await fetch('/api/auth/logout',{method:'POST',credentials:'same-origin'});
      if(response.ok) location.href='/login';
      else profileLogout.disabled=false;
    }catch(error){profileLogout.disabled=false;}
  });
}

document.addEventListener('click', (e) => {
  const menu = document.getElementById('megaMenu');
  if(menu.classList.contains('open') && !menu.contains(e.target) && e.target.id !== 'navCatLink'){
    closeMegaMenu();
  }
});

const root = document.documentElement;
function applyStoredTheme(){
  try{ const t = localStorage.getItem('rsm-theme'); if(t) root.setAttribute('data-theme', t); }catch(e){}
}
document.getElementById('themeToggle').addEventListener('click', () => {
  const current = root.getAttribute('data-theme') || 'dark';
  const next = current === 'dark' ? 'light' : 'dark';
  root.setAttribute('data-theme', next);
  try{ localStorage.setItem('rsm-theme', next); }catch(e){}
});
applyStoredTheme();

/* Set CHAT_API_URL after deploying worker/; empty keeps privacy-friendly local search. */
(() => {
  const launcher = document.getElementById('kbChatLauncher');
  const panel = document.getElementById('kbChatPanel');
  const close = document.getElementById('kbChatClose');
  const form = document.getElementById('kbChatForm');
  const input = document.getElementById('kbChatInput');
  const messages = document.getElementById('kbChatMessages');
  let indexPromise;
  const CHAT_API_URL = 'https://white-feather-df3a.mohamed-elqabbany.workers.dev';

  function setOpen(open) {
    panel.classList.toggle('open', open);
    panel.setAttribute('aria-hidden', String(!open));
    launcher.setAttribute('aria-expanded', String(open));
    if (open) input.focus();
  }
  function addBubble(text, kind) {
    const bubble = document.createElement('div');
    bubble.className = 'kb-chat-bubble' + (kind ? ' ' + kind : '');
    bubble.textContent = text;
    messages.appendChild(bubble);
    messages.scrollTop = messages.scrollHeight;
    return bubble;
  }
  function loadIndex() {
    if (!indexPromise) {
      indexPromise = fetch(new URL('chatbot-index.json', document.baseURI).toString())
        .then(response => {
          if (!response.ok) throw new Error('Index unavailable');
          return response.json();
        })
        .then(data => {
          if (!data || data.version !== 1 || !Array.isArray(data.articles)) throw new Error('Invalid index');
          return data.articles;
        });
    }
    return indexPromise;
  }
  // Ignore conversational framing so searches like "find my info with keyword extended warranty"
  // are scored against the meaningful topic rather than every word in the question.
  const STOP_WORDS = new Set('a an and are as at be by can could do does find for from give has have help i info in is it me my of on or please show tell that the this to was were what when where which who with would you your any keyword keywords about article articles information search looking need want containing contains mention mentions'.split(' '));
  function termsFor(query) {
    return [...new Set(query.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
      .split(/[^a-z0-9]+/).filter(word => word.length > 1 && !STOP_WORDS.has(word)))].slice(0, 40);
  }
  function normalizedText(value) {
    return String(value || '').toLowerCase().normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
  }
  function wordSet(value) {
    return new Set(normalizedText(value).split(/\s+/).filter(Boolean));
  }
  function findMatches(articles, query) {
    const terms = termsFor(query);
    if (!terms.length) return [];
    const phrase = normalizedText(terms.join(' '));
    return articles.map(article => {
      const title = wordSet(article.title);
      const tags = wordSet((article.tags || []).join(' '));
      const category = wordSet(article.category);
      const text = wordSet(article.text);
      const exactPhrase = terms.length >= 2 && (
        normalizedText(article.title).includes(phrase) ||
        normalizedText((article.tags || []).join(' ')).includes(phrase) ||
        normalizedText(article.text).includes(phrase)
      );
      let score = 0, matchedTerms = 0, strongMatches = 0;
      for (const term of terms) {
        const inTitle = title.has(term), inTags = tags.has(term);
        const inCategory = category.has(term), inText = text.has(term);
        if (inTitle || inTags || inCategory || inText) matchedTerms += 1;
        if (inTitle) { score += 7; strongMatches += 1; }
        if (inTags) { score += 5; strongMatches += 1; }
        if (inCategory) score += 2;
        if (inText) score += 1;
      }
      if (exactPhrase) score += 20;
      const coverage = matchedTerms / terms.length;
      return {article, score, matchedTerms, strongMatches, coverage, termCount: terms.length, exactPhrase};
    }).filter(item => item.exactPhrase ||
      (item.score >= 6 && item.coverage >= 0.6 &&
       (item.matchedTerms >= 2 || (item.termCount === 1 && item.strongMatches > 0))))
      .sort((a, b) => Number(b.exactPhrase) - Number(a.exactPhrase) || b.score - a.score || b.coverage - a.coverage)
      .slice(0, 6);
  }
  function addResults(matches) {
    const bubble = document.createElement('div');
    bubble.className = 'kb-chat-bubble';
    if (!matches.length) {
      bubble.textContent = 'I couldn’t find a close match in the indexed articles. Try a brand name, system, status code, bulletin reference, or a shorter phrase.';
      messages.appendChild(bubble);
      messages.scrollTop = messages.scrollHeight;
      return;
    }
    bubble.appendChild(document.createTextNode('These articles look most relevant. Open one to read the full guidance:'));
    const list = document.createElement('div');
    list.className = 'kb-chat-results';
    matches.forEach(({article}) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'kb-chat-result';
      button.dataset.articleId = String(article.id);
      const title = document.createElement('strong');
      title.textContent = article.title;
      const meta = document.createElement('span');
      meta.textContent = (article.category || 'Knowledgebase') + ((article.tags || []).length ? ' · ' + article.tags.slice(0, 3).join(', ') : '');
      button.append(title, meta);
      list.appendChild(button);
    });
    bubble.appendChild(list);
    messages.appendChild(bubble);
    messages.scrollTop = messages.scrollHeight;
  }
  launcher.addEventListener('click', () => setOpen(!panel.classList.contains('open')));
  close.addEventListener('click', () => setOpen(false));
  form.addEventListener('submit', async event => {
    event.preventDefault();
    const query = input.value.trim();
    if (!query) return;
    addBubble(query, 'user');
    input.value = '';
    const waiting = addBubble('Searching the article index…');
    try {
      if (CHAT_API_URL) {
        const response = await fetch(CHAT_API_URL, {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({question: query})
        });
        const data = await response.json();
        const failureReason = [data.error, data.stage, data.detail].filter(Boolean).join(' · ');
        if (!response.ok || data.error) throw new Error(failureReason || 'Chat service unavailable');
        // Always cross-check the AI response against the published article index.
        // This guarantees exact keyword/phrase matches remain visible even if AI retrieval misses them.
        let localMatches = [];
        try { localMatches = findMatches(await loadIndex(), query); } catch (_) {}
        const directMatches = localMatches.filter(match => match.exactPhrase);
        const sourceMap = new Map();
        (Array.isArray(data.sources) ? data.sources : []).forEach(source => sourceMap.set(String(source.id), source));
        localMatches.forEach(({article}) => {
          if (!sourceMap.has(String(article.id))) {
            sourceMap.set(String(article.id), {id: article.id, title: article.title, category: article.category});
          }
        });
        data.sources = [...sourceMap.values()];
        waiting.remove();
        addBubble(directMatches.length
          ? `I found ${directMatches.length} article${directMatches.length === 1 ? '' : 's'} containing “${termsFor(query).join(' ')}”. Open a result below to read the full guidance.`
          : (data.answer || 'I could not generate an answer for that question.'));
        if (Array.isArray(data.sources) && data.sources.length) {
          const sourceBubble = document.createElement('div');
          sourceBubble.className = 'kb-chat-bubble';
          sourceBubble.appendChild(document.createTextNode('Sources from the knowledgebase:'));
          const list = document.createElement('div');
          list.className = 'kb-chat-results';
          data.sources.forEach(source => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'kb-chat-result';
            button.dataset.articleId = String(source.id);
            const title = document.createElement('strong');
            title.textContent = source.title || 'Open source article';
            const meta = document.createElement('span');
            meta.textContent = source.category || 'Knowledgebase';
            button.append(title, meta);
            list.appendChild(button);
          });
          sourceBubble.appendChild(list);
          messages.appendChild(sourceBubble);
          messages.scrollTop = messages.scrollHeight;
        }
      } else {
        const articles = await loadIndex();
        waiting.remove();
        addResults(findMatches(articles, query));
      }
    } catch (error) {
      if (CHAT_API_URL) {
        waiting.textContent = 'The AI assistant is unavailable: ' + (error && error.message ? error.message : 'connection failed') + ' Please use local search for now.';
        const fallback = document.createElement('button');
        fallback.type = 'button';
        fallback.className = 'kb-chat-result';
        fallback.textContent = 'Search articles locally instead';
        fallback.addEventListener('click', async () => {
          fallback.remove();
          try {
            const articles = await loadIndex();
            addResults(findMatches(articles, query));
          } catch (_) {}
        });
        waiting.appendChild(fallback);
      } else {
        waiting.textContent = 'The article index could not be loaded. Please use the regular site search for now.';
      }
    }
  });
  messages.addEventListener('click', event => {
    const button = event.target.closest('button[data-article-id]');
    if (!button) return;
    const idText = button.dataset.articleId;
    const article = ARTICLES.find(item => String(item.id) === idText);
    if (article) {
      setOpen(false);
      navigate('article', {articleId: article.id});
    }
  });
})();


const initial = parseHash();
state = { route:initial.route, articleId:initial.articleId??null, query:initial.query??'', activeCat:initial.catId??null, activeTag:null };
render();
loadAccountState();

