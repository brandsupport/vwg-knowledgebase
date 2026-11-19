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
      const merged=new Map(BASE_ARTICLES.map(article=>[String(article.id),article]));
      (content.overrides||[]).forEach(article=>{
        const key=String(article.id),previous=merged.get(key);
        merged.set(key,{...(previous||{}),...article,images:article.images??previous?.images??[]});
      });
      (content.articles||[]).forEach(article=>merged.set(String(article.id),article));
      ARTICLES=[...merged.values()];
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
          <div class="article-detail-actions">${favoriteButtonHtml(a)}<button type="button" class="article-edit-button" onclick="navigate('submit',{articleId:${a.id}})">✎ Suggest an update</button></div>
          <div class="article-body">${a.html}</div>
          ${a.images.map(src => `<img src="${src}" loading="lazy" alt="Reference screenshot for ${escapeHtml(a.title)}">`).join('')}
          <div class="detail-tags">${a.tags.map(t=>renderTagChip(t,false,false)).join('')}</div>
          ${a.source_url ? `<div style="margin-top:10px;"><a class="back-link" href="${escapeHtml(a.source_url)}" target="_blank" rel="noopener" style="margin-bottom:0;">${a.source === 'notion' ? 'View original in Notion' : 'View source'} &#8599;</a></div>` : ''}
        </div>
      </div>
    </div>
  `;
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
  const images=editing?(article.images||[]).filter(url=>typeof url==='string'&&url.startsWith('https://')).join('\\n'):'';
  const source=editing?article.source_url||'':'';
  el.innerHTML=`
    <div class="page search-page">
      <div class="article-form-shell">
        <a class="back-link" onclick="${cancelAction}">&larr; ${editing?'Back to article':'Back to Knowledge Base'}</a>
        <div class="section-label">${editing?'Article revision request':'Knowledge contribution'}</div>
        <h1>${editing?'Suggest an article update':'Submit an article'}</h1>
        <p class="article-form-intro">${editing?'Your suggested changes will be reviewed by an administrator. The published article will remain unchanged until approval.':'Share a useful process, announcement or Hub guide. Your submission will be reviewed before it appears in the Knowledge Base.'}</p>
        <form id="articleRequestForm" class="article-request-form">
          <label for="requestTitle">Article title</label>
          <input class="kb-form-control" id="requestTitle" maxlength="180" required value="${editing?escapeHtml(article.title):''}" placeholder="Enter a clear article title">
          <label for="requestCategory">Category</label>
          <select class="kb-form-control" id="requestCategory" required>${categoryOptions}</select>
          <label for="requestTags">Tags / keywords</label>
          <input class="kb-form-control" id="requestTags" maxlength="500" value="${editing?escapeHtml((article.tags||[]).join(', ')):''}" placeholder="e.g. SLI, Audi, Transport">
          <label for="requestBody">Article content</label>
          <textarea class="kb-form-control kb-form-textarea" id="requestBody" required minlength="10" maxlength="30000" placeholder="Write the article here. Use ## for headings, - for bullet points and 1. for numbered steps.">${editing?escapeHtml(htmlToEditorText(article.html)):''}</textarea>
          <label for="requestImages">Screenshot / image links (one HTTPS link per line)</label>
          <textarea class="kb-form-control" id="requestImages" rows="3" placeholder="https://...">${escapeHtml(images)}</textarea>
          <div class="form-helper">${editing?'Leave this blank to preserve existing article images.':'Use secure HTTPS image links. Existing Tally uploads are also supported.'}</div>
          <label for="requestSource">Source / reference link (optional)</label>
          <input class="kb-form-control" id="requestSource" type="url" value="${escapeHtml(source)}" placeholder="https://...">
          <div class="article-form-actions">
            <button class="load-more" type="button" onclick="${cancelAction}">Cancel</button>
            <button class="article-form-submit" id="requestSubmit" type="submit">${editing?'Send update for approval':'Submit for approval'}</button>
          </div>
          <div class="article-form-message" id="requestMessage" role="status" aria-live="polite"></div>
        </form>
      </div>
    </div>`;
  document.getElementById('articleRequestForm').addEventListener('submit',async event=>{
    event.preventDefault();
    const submit=document.getElementById('requestSubmit'),message=document.getElementById('requestMessage');
    const imageText=document.getElementById('requestImages').value.trim();
    const payload={
      requestType:editing?'edit':'new',
      articleId:editing?String(article.id):undefined,
      title:document.getElementById('requestTitle').value,
      categoryId:Number(document.getElementById('requestCategory').value),
      tags:document.getElementById('requestTags').value,
      body:document.getElementById('requestBody').value,
      images:imageText?imageText.split(/\\r?\\n/).map(x=>x.trim()).filter(Boolean):[],
      sourceUrl:document.getElementById('requestSource').value,
      originalArticle:editing?{id:article.id,title:article.title,cat:article.cat,tags:article.tags,html:article.html,source_url:article.source_url}:undefined
    };
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
        if (!response.ok || data.error) throw new Error(data.error || 'Chat service unavailable');
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
        waiting.textContent = 'The AI assistant is unavailable right now. Please try the local site search.';
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

