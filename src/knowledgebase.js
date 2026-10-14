const DATA = JSON.parse(document.getElementById('site-data').textContent);
const CATS = DATA.categories;
const ARTICLES = DATA.articles;
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

let state = { route:'home', articleId:null, query:'', activeCat:null, activeTag:null };
let feedLimit = 24;

function navigate(route, opts={}){
  closeMegaMenu();
  state = { route, articleId: opts.articleId ?? null, query: opts.query ?? '', activeCat: opts.catId ?? null, activeTag:null };
  feedLimit = 24;
  const hash = route === 'home' ? (opts.catId ? `#/browse/${opts.catId}` : '#/') :
    route === 'article' ? `#/article/${opts.articleId}` :
    route === 'search' ? `#/search?q=${encodeURIComponent(opts.query||'')}` : '#/';
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
          <span class="featured-cta" onclick="navigate('article',{articleId:${featured.id}})">Read the article &rarr;</span>
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
      <span class="num">${cat.icon} ${escapeHtml(cat.short).toUpperCase()} &middot; ${articleLabel(a)}</span>
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

function renderContent(){
  if(state.route === 'home') renderHome();
  else if(state.route === 'article') renderArticle(state.articleId);
  else if(state.route === 'search') renderSearch(state.query);
  renderMegaGrid();
  renderHeaderState();
  const si = document.getElementById('searchInput');
  if(si) si.value = state.route === 'search' ? state.query : '';
}
function render(){ renderContent(); window.scrollTo(0,0); }

function parseHash(){
  const h = location.hash.replace(/^#\/?/, '');
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

