// Safety net: no customer-facing area is allowed to stay on a spinner forever.
setTimeout(()=>{document.querySelectorAll('.loading').forEach(el=>{if(!el.dataset.filled){el.innerHTML='<div class="notice error"><b>Still loading?</b> The page could not finish its data request. <button class="btn ghost" onclick="location.reload()">Reload</button></div>';el.dataset.filled='1'}})},6500);
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)],esc=v=>String(v??'').replace(/[&<>\'"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[m])),money=n=>'₹'+Number(n||0).toLocaleString('en-IN',{maximumFractionDigits:2});
const NCR_RENDER_API='https://ncr-services-store.onrender.com/api';
const host=String(location.hostname||'').toLowerCase(),port=String(location.port||'');
const localStatic=(location.protocol==='file:'||((host==='localhost'||host==='127.0.0.1'||host==='0.0.0.0')&&!['3000','3001'].includes(port)));
const crossOriginStatic=(host.endsWith('github.io')||host.endsWith('vercel.app')||host.endsWith('netlify.app'));
const API=String(window.NCR_API_BASE||((localStatic||crossOriginStatic)?NCR_RENDER_API:'/api')).replace(/\/$/,'');
const API_FALLBACK=API===NCR_RENDER_API?'':NCR_RENDER_API;

function cart(){try{const x=JSON.parse(localStorage.getItem('ncr_cart')||'[]');return Array.isArray(x)?x:[]}catch{return[]}}function saveCart(x){localStorage.setItem('ncr_cart',JSON.stringify(x.filter(i=>i.qty>0)));updateCartCount()}function updateCartCount(){const n=cart().reduce((a,x)=>a+Number(x.qty||0),0);$$('.cart-count').forEach(e=>e.textContent=n)}
let NCR_PRODUCTS=[];
function product(id){return NCR_PRODUCTS.find(p=>String(p.id)===String(id))}function productImages(p){const out=[];const arr=Array.isArray(p?.images)?p.images:[];if(p?.image)out.push(p.image);for(const im of arr){if(im&&!out.includes(im))out.push(im)}return out.length?out:['products/laptop.svg']}function assetValue(im){const v=String(im||'');if(/^https?:\/\//i.test(v)||/^data:image\//i.test(v))return v;return 'assets/'+String(im||'products/laptop.svg')}function asset(p){return assetValue(p?.image||productImages(p)[0])}
function toast(t){let e=$('#toast');if(!e){e=document.createElement('div');e.id='toast';Object.assign(e.style,{position:'fixed',right:'16px',bottom:'16px',zIndex:9999,background:'#07214d',color:'#fff',padding:'13px 16px',borderRadius:'12px',fontWeight:'900',boxShadow:'0 18px 40px rgba(0,0,0,.25)'});document.body.append(e)}e.textContent=t;e.style.display='block';clearTimeout(e._x);e._x=setTimeout(()=>e.style.display='none',2000)}
function addCart(id){const p=product(id)||cached().find(x=>String(x.id)===String(id));if(!p)return toast('Product unavailable');if(Number(p.stock||0)<=0)return toast('This product is out of stock');const c=cart(),x=c.find(i=>String(i.id)===String(id));if(x&&Number(x.qty||0)>=Number(p.stock||0))return toast('Maximum available stock reached');x?x.qty++:c.push({id:p.id,qty:1,name:p.name,sku:p.sku,price:p.price,image:p.image});saveCart(c);toast('Added to cart')}
function buyNow(id){const p=product(id)||cached().find(x=>String(x.id)===String(id));if(!p)return toast('Product unavailable');if(Number(p.stock||0)<=0)return toast('This product is out of stock');saveCart([{id:p.id,qty:1,name:p.name,sku:p.sku,price:p.price,image:p.image}]);location.href='checkout.html?buy='+encodeURIComponent(p.id)}
async function api(path,opt={}){
 const headers={'Content-Type':'application/json',...(opt.headers||{})};
 const token=localStorage.getItem('ncr_admin_token'); if(token) headers.Authorization='Bearer '+token;
 const maxAttempts=/^\/auth\/login$/.test(path)?3:2;
 const bases=[API,...(API_FALLBACK?[API_FALLBACK]:[])];
 let lastErr;
 for(const base of bases){
  for(let attempt=1;attempt<=maxAttempts;attempt++){
   const ctl=new AbortController(),tm=setTimeout(()=>ctl.abort(),30000);
   try{
    const r=await fetch(base+path,{...opt,headers,signal:ctl.signal,cache:'no-store'});
    let d={}; try{d=await r.json()}catch{}
    if(!r.ok){
     if((r.status===401||r.status===403)&&location.pathname.includes('/admin/')&&!location.pathname.endsWith('/login.html')){localStorage.removeItem('ncr_admin_token');localStorage.removeItem('ncr_admin_user');location.replace('login.html');return;}
     if((r.status===502||r.status===503||r.status===504)&&attempt<maxAttempts){
       lastErr=Error('NCR SERVICES server is waking up. Retrying…');
       await new Promise(res=>setTimeout(res,800*attempt));
       continue;
     }
     if((r.status===404||r.status===405)&&base!==bases[bases.length-1]){lastErr=Error(`API endpoint unavailable at ${base}. Trying NCR SERVICES backend…`);break;}
     throw Error(d.error||`Request failed (${r.status})`);
    }
    return d;
   }catch(e){
    lastErr=e;
    if((e.name==='AbortError'||e instanceof TypeError)&&attempt<maxAttempts){
      await new Promise(res=>setTimeout(res,800*attempt));
      continue;
    }
    if(e.name==='AbortError'){
      if(base!==bases[bases.length-1])break;
      throw Error('Server request timed out. Please check the NCR SERVICES backend.');
    }
    if(base!==bases[bases.length-1])break;
    throw e;
   }finally{clearTimeout(tm)}
  }
 }
 throw lastErr||Error('Unable to reach the NCR SERVICES backend.');
}

function requestId(prefix){return (window.crypto&&typeof window.crypto.randomUUID==='function'?window.crypto.randomUUID():prefix+'-'+Date.now()+'-'+Math.random().toString(36).slice(2,10))}
function serialNext(key,prefix){const y=new Date().getFullYear(),k=key+'_'+y,n=Number(localStorage.getItem(k)||0)+1;localStorage.setItem(k,String(n));return `${prefix}/${y}/${String(n).padStart(4,'0')}`}
function localServiceRequest(b){if(!b.customer_name||!b.phone||!b.service||!b.problem)throw Error('Name, mobile, service and problem are required');const rs=JSON.parse(localStorage.getItem('ncr_services_cache')||'[]');const r={id:'local-srv-'+Date.now(),request_no:serialNext('ncr_service_serial','NCR/SRV'),customer_name:String(b.customer_name).trim(),phone:String(b.phone).trim(),email:String(b.email||''),preferred_date:String(b.preferred_date||''),service:String(b.service).trim(),problem:String(b.problem).trim(),address:String(b.address||'').trim(),status:'New',created_at:new Date().toISOString()};rs.push(r);localStorage.setItem('ncr_services_cache',JSON.stringify(rs));return {request:r,local:true}}
function localQuote(b){const customer_name=String(b.customer_name||'').trim(),phone=String(b.phone||'').trim(),email=String(b.email||'').trim(),sel=Array.isArray(b.items)?b.items:[];if(!customer_name||!phone||!sel.length)throw Error('Name, mobile and products are required');const ps=cached(),items=sel.map(i=>{const p=ps.find(x=>String(x.id)===String(i.id));if(!p)throw Error('Product unavailable');return{id:p.id,sku:p.sku,name:p.name,qty:Math.max(1,Number(i.qty)||1),price:Number(p.price||0),warranty:p.warranty||'2 Year Warranty',hsn:p.hsn||'',image:p.image||''}}),subtotal=items.reduce((s,x)=>s+x.price*x.qty,0),discount=Math.max(0,Number(b.discount||0)),q={id:'local-quo-'+Date.now(),quote_no:serialNext('ncr_quote_serial','NCR/QUO'),customer_name,phone,email,subtotal,discount,tax:0,total:Math.max(0,subtotal-discount),status:'Draft',created_at:new Date().toISOString()};localStorage.setItem('ncr_quote_preview',JSON.stringify({quote:q,items}));const qs=JSON.parse(localStorage.getItem('ncr_quotes_cache')||'[]');qs.push({...q,items_json:JSON.stringify(items),items});localStorage.setItem('ncr_quotes_cache',JSON.stringify(qs));return {...q,items}}
function localOrder(b){const items=(b.items||[]).map(i=>{const p=cached().find(x=>String(x.id)===String(i.id));return p?{id:p.id,sku:p.sku,name:p.name,qty:Math.max(1,Number(i.qty)||1),price:Number(p.price||0),warranty:p.warranty||'2 Year Warranty',hsn:p.hsn||'',image:p.image||''}:null});if(!b.customer_name||!b.phone||!items.length||items.some(x=>!x))throw Error('Name, mobile and valid items are required');const subtotal=items.reduce((s,x)=>s+x.price*x.qty,0),discount=Math.max(0,Number(b.discount||0)),total=Math.max(0,subtotal-discount),order={id:'local-inv-'+Date.now(),invoice_no:serialNext('ncr_invoice_serial','NCR/INV'),customer_name:String(b.customer_name).trim(),phone:String(b.phone).trim(),email:String(b.email||'').trim(),address:'',items,subtotal,discount,tax:0,shipping:0,total,status:'Pending',bill_token:'local',created_at:new Date().toISOString()};localStorage.setItem('ncr_invoice_preview',JSON.stringify(order));const os=JSON.parse(localStorage.getItem('ncr_orders_cache')||'[]');os.push(order);localStorage.setItem('ncr_orders_cache',JSON.stringify(os));return {order,local:true}}
const CATALOG_VERSION='9';let NCR_SERVER_SYNCED=false;if(localStorage.getItem('ncr_catalog_version')!==CATALOG_VERSION){localStorage.removeItem('ncr_products_cache');localStorage.removeItem('ncr_admin_products');localStorage.setItem('ncr_catalog_version',CATALOG_VERSION)}async function refreshProducts(){try{const d=await api('/products');NCR_PRODUCTS=Array.isArray(d.products)?d.products:[];window.NCR_PRODUCTS=NCR_PRODUCTS;NCR_SERVER_SYNCED=true;localStorage.setItem('ncr_products_cache',JSON.stringify(NCR_PRODUCTS));return d}catch{return null}}function cached(){if(NCR_SERVER_SYNCED)return NCR_PRODUCTS;try{const x=JSON.parse(localStorage.getItem('ncr_products_cache')||'[]');if(Array.isArray(x))return x}catch{}return NCR_PRODUCTS}
function localProducts(){try{const x=JSON.parse(localStorage.getItem('ncr_admin_products')||'[]');return Array.isArray(x)&&x.length?x:null}catch{return null}}
function saveLocalProducts(ps){localStorage.setItem('ncr_admin_products',JSON.stringify(ps));localStorage.setItem('ncr_products_cache',JSON.stringify(ps.filter(p=>p.active!==0)));NCR_PRODUCTS=ps.filter(p=>p.active!==0);window.NCR_PRODUCTS=NCR_PRODUCTS}
function code39Pattern(ch){const m={'0':'101001101101','1':'110100101011','2':'101100101011','3':'110110010101','4':'101001101011','5':'110100110101','6':'101100110101','7':'101001011011','8':'110100101101','9':'101100101101','A':'110101001011','B':'101101001011','C':'110110100101','D':'101011001011','E':'110101100101','F':'101101100101','G':'101010011011','H':'110101001101','I':'101101001101','J':'101011001101','K':'110101010011','L':'101101010011','M':'110110101001','N':'101011010011','O':'110101101001','P':'101101101001','Q':'101010110011','R':'110101011001','S':'101101011001','T':'101011011001','U':'110010101011','V':'100110101011','W':'110011010101','X':'100101101011','Y':'110010110101','Z':'100110110101','-':'100101011011','.':'110010101101',' ':'100110101101','$':'100100100101','/':'100100101001','+':'100101001001','%':'101001001001','*':'100101101101'};return m[ch]||m['-']}
function barcodeSvg(value,width=360,height=70){let s='*'+String(value||'').toUpperCase().replace(/[^0-9A-Z\-\. $/+%]/g,'-')+'*',parts='',x=6;for(const ch of s){const pat=code39Pattern(ch);for(let i=0;i<pat.length;i++){const bw=pat[i]==='1'?2:1;if(i%2===0)parts+=`<rect x="${x}" y="2" width="${bw}" height="${height-18}"/>`;x+=bw+1}x+=2}const scale=(width-12)/x;return `<svg class="series-barcode" viewBox="0 0 ${x} ${height}" width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg"><g fill="#000000" transform="scale(${scale.toFixed(4)} 1)">${parts}</g><text x="${x/2}" y="${height-4}" text-anchor="middle" font-size="8" font-family="Arial, sans-serif">${esc(s.slice(1,-1))}</text></svg>`}
function cards(list){
 return list.map(p=>{
  const ims=productImages(p), count=ims.length, cid='pc_'+String(p.id).replace(/[^a-zA-Z0-9_-]/g,'_');
  const dots=ims.length>1?`<div class="ncr-card-dots">${ims.map((_,i)=>`<button type="button" class="${i===0?'active':''}" aria-label="Photo ${i+1}" onclick="event.preventDefault();event.stopPropagation();ncrCardPhoto('${cid}',${i})"></button>`).join('')}</div>`:'';
  return `<article class="product flip-card" data-card-id="${cid}">
    <div class="pimg ncr-card-gallery" id="${cid}">
      <span class="stock ${Number(p.stock||0)>0?'in':'out'}">${Number(p.stock||0)>0?'✓ In Stock':'Out of Stock'}</span>
      ${count>1?`<span class="pill photo-count">📷 ${count}</span>`:''}
      <button type="button" class="card-photo-prev" aria-label="Previous photo" onclick="event.preventDefault();event.stopPropagation();ncrCardPhoto('${cid}',-1)">‹</button>
      <img loading="lazy" data-card-index="0" src="${esc(assetValue(ims[0]))}" alt="${esc(p.name)}" onerror="this.src='assets/logo.png'">
      <button type="button" class="card-photo-next" aria-label="Next photo" onclick="event.preventDefault();event.stopPropagation();ncrCardPhoto('${cid}',1)">›</button>
      ${dots}
      <button type="button" class="card-expand" aria-label="Open product photo" onclick="event.preventDefault();event.stopPropagation();location.href='product.html?id=${encodeURIComponent(p.id)}'">⛶</button>
    </div>
    <div class="pbody">
      <div class="card-topline"><span class="pill">${esc(p.category||'Product')}</span><span class="sku-mini">${esc(p.sku||'')}</span></div>
      <h3>${esc(p.name)}</h3>
      <p class="rating-row"><span class="rating-badge">★ ${p.rating?Number(p.rating).toFixed(1):'4.8'}</span><span class="muted"> • ${count} photo${count===1?'':'s'}</span></p>
      <p class="muted product-desc">${esc(p.description||'Quality product from NCR SERVICES.')}</p>
      ${(Array.isArray(p.highlights)&&p.highlights.length)?`<div class="card-highlights">${p.highlights.slice(0,2).map(h=>`<span>✓ ${esc(h)}</span>`).join('')}</div>`:''}
      <div class="price-row"><span class="price">${money(p.price)}</span>${Number(p.mrp)>Number(p.price)?`<span class="mrp">${money(p.mrp)}</span><span class="discount">${Math.round((1-Number(p.price)/Number(p.mrp))*100)}% off</span>`:''}</div>
      <div class="delivery-line">✓ ${esc(p.warranty||'Warranty included')} &nbsp; • &nbsp; ${Number(p.stock||0)} available</div>
      <div class="actions card-actions">
        <a class="btn ghost" href="product.html?id=${encodeURIComponent(p.id)}">View Details</a>
        <button class="btn blue" onclick="addCart(${p.id})">🛒 Add to Cart</button>
        <button class="btn yellow buy-now" onclick="buyNow(${p.id})">⚡ Buy Now</button>
      </div>
    </div>
  </article>`
 }).join('')
}
function ncrCardPhoto(cid,delta){
 const box=document.getElementById(cid);if(!box)return;
 const img=box.querySelector('img'), dots=[...box.querySelectorAll('.ncr-card-dots button')];
 let i=Number(img.dataset.cardIndex||0);
 const total=Math.max(1,dots.length||1);
 i=(i+delta+total)%total;
 const card=box.closest('.product'), pid=card?.getAttribute('data-card-id')||'';
 const p=NCR_PRODUCTS.find(x=>'pc_'+String(x.id).replace(/[^a-zA-Z0-9_-]/g,'_')===pid)||cached().find(x=>'pc_'+String(x.id).replace(/[^a-zA-Z0-9_-]/g,'_')===pid);
 if(p){const ims=productImages(p);img.src=assetValue(ims[i]);}
 img.dataset.cardIndex=i;dots.forEach((d,k)=>d.classList.toggle('active',k===i));
}
function initCatalog(){const g=$('#productGrid');if(!g)return;const draw=()=>{const q=($('#productSearch')?.value||'').toLowerCase(),c=$('#categoryFilter')?.value||'';const ps=cached();if($('#categoryFilter')){$('#categoryFilter').innerHTML='<option value="">All categories</option>'+[...new Set(ps.map(p=>p.category))].sort().map(x=>`<option>${esc(x)}</option>`).join('')}g.innerHTML=cards(ps.filter(p=>(!q||(`${p.name} ${p.sku} ${p.description}`).toLowerCase().includes(q))&&(!c||p.category===c)))||'<div class="surface" style="padding:25px">No products found.</div>'};draw();$('#productSearch')?.addEventListener('input',draw);$('#categoryFilter')?.addEventListener('change',draw);refreshProducts().then(draw)}
function initDetail(){
 const g=$('#product');if(!g)return;
 const id=new URLSearchParams(location.search).get('id');
 let p=product(id)||cached().find(x=>String(x.id)===String(id));
 let current=0, startX=0, startY=0, moved=false, startTime=0;
 const draw=()=>{
  p=product(id)||cached().find(x=>String(x.id)===String(id))||p;
  if(!p){g.innerHTML='<div class="surface" style="padding:30px"><h2>Product not found</h2><a class="btn blue" href="products.html">Browse Products</a></div>';return}
  const ims=productImages(p);
  current=Math.max(0,Math.min(current,ims.length-1));
  const renderImage=(animate=true)=>{
   const main=$('#productMainImage');
   if(!main)return;
   const src=assetValue(ims[current]);
   if(animate){
    main.classList.remove('ncr-slide-in');
    void main.offsetWidth;
    main.classList.add('ncr-slide-in');
   }
   main.src=src;
   main.alt=p.name||'Product photo';
   $$('.product-thumb').forEach((b,i)=>b.classList.toggle('active',i===current));
   $$('.ncr-gallery-dot').forEach((b,i)=>b.classList.toggle('active',i===current));
   const count=$('#ncrPhotoCount');if(count)count.textContent=(current+1)+' / '+ims.length;
  };
  const go=(n)=>{
   if(!ims.length)return;
   current=(n+ims.length)%ims.length;
   renderImage(true);
  };
  window.selectProductImage=i=>{current=Number(i)||0;renderImage(true)};
  window.ncrGalleryPrev=()=>go(current-1);
  window.ncrGalleryNext=()=>go(current+1);
  window.ncrGalleryZoom=()=>{
   const modal=$('#ncrZoomModal'),img=$('#ncrZoomImage');
   if(!modal||!img)return;
   img.src=assetValue(ims[current]);
   img.alt=p.name||'Product photo';
   modal.classList.add('open');
   document.body.classList.add('ncr-modal-open');
  };
  window.ncrGalleryCloseZoom=()=>{
   const modal=$('#ncrZoomModal');if(modal)modal.classList.remove('open');
   document.body.classList.remove('ncr-modal-open');
  };
  let zoomScale=1,zoomX=0,zoomY=0,pinchStart=0;
  function applyZoom(){const im=$('#ncrZoomImage'),lv=$('#ncrZoomLevel');if(!im)return;im.style.transform=`translate(${zoomX}px,${zoomY}px) scale(${zoomScale})`;if(lv)lv.textContent=Math.round(zoomScale*100)+'%';}
  window.ncrZoomReset=()=>{zoomScale=1;zoomX=0;zoomY=0;applyZoom()};
  window.ncrZoomScale=d=>{zoomScale=Math.max(.5,Math.min(4,zoomScale+d));applyZoom()};
  g.innerHTML=`<div class="detail">
   <div class="surface detail-image ncr-gallery-card" style="padding:16px">
    <div class="ncr-gallery-stage" id="ncrGalleryStage">
      <button type="button" class="ncr-gallery-arrow ncr-prev" aria-label="Previous photo" onclick="ncrGalleryPrev()">‹</button>
      <div class="product-gallery-main ncr-swipe-area" id="ncrSwipeArea">
        <img id="productMainImage" src="${esc(assetValue(ims[current]))}" alt="${esc(p.name)}" onerror="this.src='assets/logo.png'">
        <button type="button" class="ncr-zoom-button" aria-label="Zoom photo" onclick="ncrGalleryZoom()">⌕</button>
        <span class="ncr-photo-count" id="ncrPhotoCount">1 / ${ims.length}</span>
      </div>
      <button type="button" class="ncr-gallery-arrow ncr-next" aria-label="Next photo" onclick="ncrGalleryNext()">›</button>
    </div>
    ${ims.length>1?`
    <div class="ncr-swipe-hint">Swipe photos ← →</div>
    <div class="product-thumbs ncr-thumb-strip" role="tablist">${ims.map((im,i)=>`<button type="button" class="product-thumb ${i===current?'active':''}" aria-label="Photo ${i+1}" onclick="selectProductImage(${i})"><img src="${esc(assetValue(im))}" alt="Photo ${i+1}" onerror="this.src='assets/logo.png'"></button>`).join('')}</div>
    <div class="ncr-gallery-dots">${ims.map((im,i)=>`<button type="button" class="ncr-gallery-dot ${i===current?'active':''}" aria-label="Photo ${i+1}" onclick="selectProductImage(${i})"></button>`).join('')}</div>`:''}
   </div>
   <div class="surface detail-copy"><span class="pill">${esc(p.category)}</span><h1>${esc(p.name)}</h1><p class="muted">SKU ${esc(p.sku)}</p><p>${esc(p.description)}</p>${Array.isArray(p.highlights)&&p.highlights.length?`<div class="ncr-feature-list" style="margin:16px 0">${p.highlights.map(h=>`<div class="ncr-feature">✓ ${esc(h)}</div>`).join('')}</div>`:''}<div class="price" style="font-size:30px">${money(p.price)} <span class="mrp">${money(p.mrp)}</span></div><div class="specs"><div class="spec"><b>Stock</b><br>${p.stock} units</div><div class="spec"><b>Warranty</b><br>${esc(p.warranty)}</div></div><div class="actions"><button class="btn blue" onclick="addCart(${p.id})">🛒 Add to Cart</button><button class="btn yellow buy-now" onclick="buyNow(${p.id})">⚡ Buy Now</button><a class="btn green" target="_blank" href="https://wa.me/917730982924?text=${encodeURIComponent('NCR SERVICES enquiry: '+p.name+' | SKU '+p.sku)}">WhatsApp</a></div></div>
  </div>
  <div class="ncr-detail-tabs">
    <div class="ncr-glow-line"></div>
    <div class="ncr-detail-grid">
      <section class="surface ncr-detail-panel"><h2>Product Description</h2><p class="muted" style="line-height:1.8">${esc(p.description||'Professional quality product from NCR SERVICES. Please contact us for availability, configuration and current offers.')}</p><div class="ncr-trust-row"><div class="ncr-trust"><b>✓ Genuine</b>Quality checked</div><div class="ncr-trust"><b>🛡 Warranty</b>${esc(p.warranty||'Warranty included')}</div><div class="ncr-trust"><b>🚚 Delivery</b>Fast dispatch</div><div class="ncr-trust"><b>💬 Support</b>WhatsApp assistance</div></div></section>
      <section class="surface ncr-detail-panel"><h2>Specifications</h2><table class="ncr-spec-table"><tbody>
        <tr><td>Brand</td><td>${esc(p.brand||'NCR SERVICES')}</td></tr>
        <tr><td>Category</td><td>${esc(p.category||'Computer Product')}</td></tr>
        <tr><td>SKU</td><td>${esc(p.sku||'-')}</td></tr>
        <tr><td>Condition</td><td>${esc(p.condition||'As listed')}</td></tr>
        <tr><td>Warranty</td><td>${esc(p.warranty||'Warranty included')}</td></tr>
        <tr><td>Availability</td><td>${Number(p.stock||0)>0?'In Stock':'Out of Stock'}</td></tr>
        ${Object.entries(p.specifications||{}).map(([k,v])=>`<tr><td>${esc(k)}</td><td>${esc(v)}</td></tr>`).join('')}
      </tbody></table></section>
    </div>
  </div>
  <div class="ncr-zoom-modal" id="ncrZoomModal" role="dialog" aria-modal="true" aria-label="Product photo zoom">
    <button type="button" class="ncr-zoom-close" aria-label="Close" onclick="ncrGalleryCloseZoom()">×</button>
    <button type="button" class="ncr-full-prev" onclick="ncrGalleryPrev()">‹</button>
    <div class="ncr-zoom-stage" id="ncrZoomStage"><img id="ncrZoomImage" src="${esc(assetValue(ims[current]))}" alt="${esc(p.name)}"></div>
    <button type="button" class="ncr-full-next" onclick="ncrGalleryNext()">›</button>
    <div class="ncr-zoom-toolbar"><button type="button" onclick="ncrZoomScale(-0.25)">−</button><span id="ncrZoomLevel">100%</span><button type="button" onclick="ncrZoomScale(0.25)">＋</button><button type="button" onclick="ncrZoomReset()">Reset</button></div>
    <div class="ncr-zoom-text">Swipe • Pinch • Mouse wheel • Double tap to zoom</div>
  </div>`;
  const area=$('#ncrSwipeArea');
  if(area){
   area.addEventListener('touchstart',e=>{
    if(!e.touches.length)return;
    startX=e.touches[0].clientX;startY=e.touches[0].clientY;startTime=Date.now();moved=false;
   },{passive:true});
   area.addEventListener('touchmove',e=>{
    if(!e.touches.length)return;
    const dx=e.touches[0].clientX-startX,dy=e.touches[0].clientY-startY;
    if(Math.abs(dx)>Math.abs(dy)&&Math.abs(dx)>8){moved=true;e.preventDefault();}
   },{passive:false});
   area.addEventListener('touchend',e=>{
    if(!moved)return;
    const dx=e.changedTouches[0].clientX-startX,dy=e.changedTouches[0].clientY-startY;
    const elapsed=Math.max(1,Date.now()-startTime);
    if(Math.abs(dx)>=45&&Math.abs(dx)>Math.abs(dy)*1.15&&(Math.abs(dx)/elapsed)>0.12) {
      if(dx<0)go(current+1); else go(current-1);
    }
   },{passive:true});
   let downX=0,downY=0,dragging=false;
   area.addEventListener('pointerdown',e=>{if(e.pointerType==='mouse'){downX=e.clientX;downY=e.clientY;dragging=true;area.setPointerCapture?.(e.pointerId)}});
   area.addEventListener('pointerup',e=>{
    if(!dragging)return;dragging=false;
    const dx=e.clientX-downX,dy=e.clientY-downY;
    if(Math.abs(dx)>55&&Math.abs(dx)>Math.abs(dy)*1.2){if(dx<0)go(current+1);else go(current-1)}
   });
  }
  const modal=$('#ncrZoomModal'), zi=$('#ncrZoomImage'), zs=$('#ncrZoomStage');
  if(modal)modal.addEventListener('click',e=>{if(e.target===modal||e.target===zs)ncrGalleryCloseZoom()});
  if(zi){
   let lastTap=0,downX=0,downY=0,moving=false;
   zi.addEventListener('wheel',e=>{e.preventDefault();ncrZoomScale(e.deltaY<0?.15:-.15)},{passive:false});
   zi.addEventListener('dblclick',e=>{zoomScale=zoomScale>1?1:2;applyZoom()});
   zi.addEventListener('pointerdown',e=>{downX=e.clientX;downY=e.clientY;moving=true;zi.setPointerCapture?.(e.pointerId)});
   zi.addEventListener('pointermove',e=>{if(!moving||zoomScale<=1)return;zoomX+=e.clientX-downX;zoomY+=e.clientY-downY;downX=e.clientX;downY=e.clientY;applyZoom()});
   zi.addEventListener('pointerup',()=>moving=false);
  }
  if(zs)zs.addEventListener('touchstart',e=>{if(e.touches.length===2){pinchStart=Math.hypot(e.touches[0].clientX-e.touches[1].clientX,e.touches[0].clientY-e.touches[1].clientY)}},{passive:true});
  if(zs)zs.addEventListener('touchmove',e=>{if(e.touches.length===2){e.preventDefault();const d=Math.hypot(e.touches[0].clientX-e.touches[1].clientX,e.touches[0].clientY-e.touches[1].clientY);if(pinchStart){zoomScale=Math.max(.5,Math.min(4,zoomScale*(d/pinchStart)));pinchStart=d;applyZoom()}}},{passive:false});
  renderImage(false);
 };
 draw();refreshProducts().then(draw);
}
function initCart(){
 const g=$('#cart'); if(!g)return;
 const draw=()=>{
  const c=cart(), ps=cached();
  if(!c.length){g.innerHTML='<div class="surface" style="padding:30px"><h2>Your cart is empty</h2><a class="btn blue" href="products.html">Shop Products</a></div>';return;}
  let total=0;
  const rows=c.map(i=>{
   const p=ps.find(x=>String(x.id)===String(i.id))||i, a=Number(p.price||0)*Number(i.qty||0); total+=a;
   return `<div class="cart-row"><img src="${esc(asset(p))}" alt=""><div><b>${esc(p.name)}</b><br><small class="muted">${esc(p.sku||'')}</small></div><div class="qty"><button onclick="changeQty(${p.id},-1)">−</button><b>${i.qty}</b><button onclick="changeQty(${p.id},1)">+</button></div><b>${money(a)}</b><button class="btn danger" onclick="removeCart(${p.id})">Remove</button></div>`;
  }).join('');
  g.innerHTML=`<div class="cart-layout"><div class="surface cart-list">${rows}</div><aside class="surface summary"><h2>Order Summary</h2><div class="sumline"><span>Items</span><b>${c.reduce((a,x)=>a+Number(x.qty||0),0)}</b></div><div class="sumline"><span>Subtotal</span><b>${money(total)}</b></div><div class="sumtotal"><div class="sumline"><span>Estimated Total</span><b>${money(total)}</b></div></div><a class="btn yellow" style="width:100%;margin-top:10px" href="checkout.html">Checkout</a><a class="btn ghost" style="width:100%;margin-top:8px" href="quotation.html">Create Quotation</a></aside></div>`;
 };
 window.changeQty=(id,d)=>{const c=cart(),x=c.find(i=>String(i.id)===String(id)),p=cached().find(v=>String(v.id)===String(id));if(x){const max=Math.max(0,Number(p?.stock??999999));x.qty=Math.min(max,Math.max(0,Number(x.qty||0)+d));saveCart(c);draw();}};
 window.removeCart=id=>{saveCart(cart().filter(i=>String(i.id)!==String(id)));draw();};
 draw();
}
function initQuotation(){
 const g=$('#items'); if(!g)return;
 let ps=cached(),sel=[];
 const calc=()=>{const t=sel.reduce((s,x)=>s+(ps.find(p=>p.id===x.id)?.price||0)*x.qty,0);if($('#total'))$('#total').textContent=money(t);return t;};
 const draw=()=>{g.innerHTML=ps.map(p=>{const x=sel.find(i=>i.id===p.id);return `<label class="quote-item"><input type="checkbox" ${x?'checked':''} onchange="toggleQuote(${p.id},this.checked)"><span><b>${esc(p.name)}</b><br><small class="muted">${esc(p.sku)} • ${money(p.price)}</small></span><input class="input" type="number" min="1" value="${x?.qty||1}" onchange="qtyQuote(${p.id},this.value)"></label>`;}).join('')||'<div class="loading">No products available.</div>';calc();};
 window.toggleQuote=(id,on)=>{if(on&&!sel.some(x=>x.id===id))sel.push({id,qty:1});if(!on)sel=sel.filter(x=>x.id!==id);draw();};
 window.qtyQuote=(id,q)=>{const x=sel.find(i=>i.id===id);if(x){x.qty=Math.max(1,Number(q)||1);calc();}};
 window.makeQuote=async()=>{if(window._quoteSubmitting)return;const btn=$('.quote-submit');window._quoteSubmitting=true;if(btn)btn.disabled=true;const customer_name=$('#name').value.trim(),phone=$('#phone').value.trim();if(!customer_name||!phone){window._quoteSubmitting=false;if(btn)btn.disabled=false;return alert('Customer name and contact number are required.')}if(!sel.length){window._quoteSubmitting=false;if(btn)btn.disabled=false;return alert('Select at least one product.')}const payload={customer_name,phone,email:$('#email').value.trim(),discount:0,items:sel,request_id:requestId('quote')};try{const q=await api('/quotes',{method:'POST',body:JSON.stringify(payload)});localStorage.setItem('ncr_quote_preview',JSON.stringify({quote:q,items:q.items}));location.href='a4.html?id='+q.id}catch(e){window._quoteSubmitting=false;if(btn)btn.disabled=false;alert(e.message)}};
 draw(); refreshProducts().then(d=>{if(d){ps=cached();draw();}});
}
function normalizePhone(v){return String(v||'').replace(/[^0-9]/g,'');}
function orderNotifyText(o,recipient='customer'){
 const n=o?.invoice_no||'NCR/INV'; const name=o?.customer_name||'Customer'; const total=money(Math.max(0,Number(o?.subtotal||0)-Number(o?.discount||0)));
 if(recipient==='business') return `NCR SERVICES - NEW ORDER\n\nOrder No: ${n}\nCustomer: ${name}\nMobile: ${o?.phone||''}\nTotal: ${total}\nPayment: ${o?.payment_method||'Not selected'}\nPayment Status: ${o?.payment_status||'Pending'}\nStatus: ${o?.status||'Pending'}\n\nPlease take action on this order.`;
 return `Hello ${name},\n\nYour NCR SERVICES order ${n} has been received.\nTotal: ${total}\nPayment: ${o?.payment_method||'Not selected'}\nPayment Status: ${o?.payment_status||'Pending'}\n${o?.coupon_code?`Coupon: ${o.coupon_code}\n`:''}Status: ${o?.status||'Pending'}\n\nThank you for choosing NCR SERVICES.`;
}
function apiUrl(path){return API+String(path||'').replace(/^\//,'')}
function billPdfUrl(o){if(!o||!o.bill_token||o.bill_token==='local')return '';return apiUrl('/bills/'+encodeURIComponent(o.bill_token)+'/pdf?download=1')}
function quotePdfUrl(q){if(!q?.id||String(q.id).startsWith('local-'))return '';return apiUrl('/quotes/'+encodeURIComponent(q.id)+'/pdf?download=1')}
function orderBillWhatsAppText(o){const base=orderNotifyText(o,'customer');const pdf=billPdfUrl(o);return pdf?base+'\n\n📄 Bill / Invoice PDF:\n'+pdf+'\n\nPlease open the link to view/download your NCR SERVICES bill PDF.':base}
function quoteWhatsAppText(q){const base=`Hello ${q?.customer_name||'Customer'},\n\nYour NCR SERVICES quotation ${q?.quote_no||''} has been prepared.\nTotal: ${money(q?.total||0)}`;const pdf=quotePdfUrl(q);return pdf?base+'\n\n📄 Quotation PDF:\n'+pdf+'\n\nPlease open the link to view/download your quotation PDF.':base}
function openWhatsApp(phone,text){const n=normalizePhone(phone);if(!n)return alert('A valid mobile number is required.');window.open('https://wa.me/'+(n.length===10?'91'+n:n)+'?text='+encodeURIComponent(text),'_blank','noopener');}
function openSms(phone,text){const n=normalizePhone(phone);if(!n)return alert('A valid mobile number is required.');location.href='sms:+91'+(n.length===10?n:n.slice(-10))+'?body='+encodeURIComponent(text);}
function openEmail(email,subject,text){if(!email)return alert('Customer email is not available.');location.href='mailto:'+encodeURIComponent(email)+'?subject='+encodeURIComponent(subject)+'&body='+encodeURIComponent(text);}
window.orderNotify={quoteWhatsApp:q=>openWhatsApp(q.phone,quoteWhatsAppText(q)),customerWhatsApp:o=>openWhatsApp(o.phone,orderNotifyText(o,'customer')),customerBillWhatsApp:o=>openWhatsApp(o.phone,orderBillWhatsAppText(o)),businessWhatsApp:o=>openWhatsApp('7730982924',orderNotifyText(o,'business')),customerSms:o=>openSms(o.phone,orderNotifyText(o,'customer')),businessSms:o=>openSms('7730982924',orderNotifyText(o,'business')),customerEmail:o=>openEmail(o.email,'NCR SERVICES Order '+(o.invoice_no||''),orderNotifyText(o,'customer')),businessEmail:o=>openEmail('pavankumarvaali@gmail.com','NEW NCR SERVICES Order '+(o.invoice_no||''),orderNotifyText(o,'business'))};
window.orderNotifyEncoded=(encoded,action)=>{try{const o=JSON.parse(decodeURIComponent(encoded));if(window.orderNotify[action])window.orderNotify[action](o)}catch(e){alert('Unable to prepare the message.')}};
function initCheckout(){
 const g=$('#checkout-items');if(!g)return;
 let c=cart(),ps=cached(),appliedCoupon=null,subtotal=0;
 const buyId=new URLSearchParams(location.search).get('buy');
 if(buyId){const bp=ps.find(x=>String(x.id)===String(buyId));if(bp&&Number(bp.stock||0)>0)c=[{id:bp.id,qty:1,name:bp.name,sku:bp.sku,price:bp.price,image:bp.image}]};
 if(!c.length){g.innerHTML='<div class="notice">Your cart is empty. <a href="products.html">Shop products</a></div>';return}
 const render=()=>{ps=cached();subtotal=0;g.innerHTML=c.map(i=>{const p=ps.find(x=>String(x.id)===String(i.id))||i,a=Number(p.price||0)*Number(i.qty||0);subtotal+=a;return '<div class="sumline"><span>'+esc(p.name)+' × '+i.qty+'</span><b>'+money(a)+'</b></div>'}).join('');const d=Number(appliedCoupon?.discount||0);if($('#checkout-subtotal'))$('#checkout-subtotal').textContent=money(subtotal);if($('#checkout-discount'))$('#checkout-discount').textContent=d?'- '+money(d):money(0);if($('#checkout-total'))$('#checkout-total').textContent=money(Math.max(0,subtotal-d));if($('#couponMessage')&&!appliedCoupon)$('#couponMessage').textContent=''};
 const paymentMethod=$('#paymentMethod'),paymentBox=$('#paymentBox'),codBox=$('#codBox');
 const syncPaymentUI=()=>{const v=paymentMethod?.value||'UPI_QR';paymentBox?.classList.toggle('hidden',v!=='UPI_QR');codBox?.classList.toggle('hidden',v!=='COD')};
 paymentMethod?.addEventListener('change',syncPaymentUI);syncPaymentUI();
 api('/public/settings').then(st=>{if($('#upiId'))$('#upiId').textContent=st?.upi_id||'UPI ID not configured'}).catch(()=>{if($('#upiId'))$('#upiId').textContent='UPI ID not available'});
 window.applyCoupon=async()=>{const code=$('#couponCode')?.value.trim().toUpperCase()||'';if(!code)return alert('Enter a coupon code.');const b=$('#couponBtn');if(b)b.disabled=true;try{const d=await api('/coupons/validate',{method:'POST',body:JSON.stringify({code,subtotal})});appliedCoupon=d.coupon;render();$('#couponMessage').innerHTML='<div class="notice ok">✅ Coupon '+esc(d.coupon.code)+' applied. Discount: '+money(d.coupon.discount)+'</div>'}catch(e){appliedCoupon=null;render();$('#couponMessage').innerHTML='<div class="notice error">'+esc(e.message)+'</div>'}finally{if(b)b.disabled=false}};
 window.removeCoupon=()=>{appliedCoupon=null;const i=$('#couponCode');if(i)i.value='';if($('#couponMessage'))$('#couponMessage').innerHTML='';render()};
 window.placeOrder=async()=>{if(window._orderSubmitting)return;const btn=$('.place-order-btn');window._orderSubmitting=true;if(btn)btn.disabled=true;const customer_name=$('#name').value.trim(),phone=$('#phone').value.trim(),email=$('#email').value.trim();if(!customer_name||!phone){window._orderSubmitting=false;if(btn)btn.disabled=false;return alert('Name and mobile are required.')}await refreshProducts();ps=cached();for(const i of c){const p=ps.find(x=>String(x.id)===String(i.id));if(!p||Number(p.stock||0)<Number(i.qty||0)){window._orderSubmitting=false;if(btn)btn.disabled=false;return alert((p?.name||'Product')+' is out of stock or has insufficient stock.')}}const payment_method=$('#paymentMethod')?.value||'UPI_QR';const payload={customer_name,phone,email,address:$('#address').value.trim(),items:c.map(i=>({id:i.id,qty:i.qty})),coupon_code:appliedCoupon?.code||'',payment_method,request_id:requestId('order')};try{const d=await api('/orders',{method:'POST',body:JSON.stringify(payload)});localStorage.setItem('ncr_last_order',JSON.stringify(d.order));localStorage.removeItem('ncr_cart');updateCartCount();location.href='invoice.html?token='+encodeURIComponent(d.order.bill_token)+'&notify=1'}catch(e){window._orderSubmitting=false;if(btn)btn.disabled=false;alert(e.message)}};
 render();refreshProducts().then(()=>{ps=cached();render()})
}
function adminLogout(){localStorage.removeItem('ncr_admin_token');localStorage.removeItem('ncr_admin_user');location.replace('../index.html')}
async function adminLogin(){
 const b=$('.auth-btn');if(b)b.disabled=true;
 localStorage.removeItem('ncr_admin_token');localStorage.removeItem('ncr_admin_user');
 const email=$('#email')?.value.trim().toLowerCase()||'',password=$('#password')?.value||'';
 if(!email||!password){if($('#msg'))$('#msg').innerHTML='<div class="notice error">Enter both Admin ID and password.</div>';if(b)b.disabled=false;return}
 if($('#msg'))$('#msg').innerHTML='<div class="notice">Connecting to NCR SERVICES…</div>';
 try{
   const d=await api('/auth/login',{method:'POST',body:JSON.stringify({email,password})});
   if(!d?.token)throw Error('Login response was incomplete. Please try again.');
   localStorage.setItem('ncr_admin_token',d.token);
   localStorage.setItem('ncr_admin_user',JSON.stringify(d.user||{}));
   location.replace('index.html');
 }catch(e){
   const msg=e?.message||'Unable to sign in.';
   if($('#msg'))$('#msg').innerHTML='<div class="notice error">❌ '+esc(msg)+'</div>';
   if(b){b.disabled=false;b.textContent='🔐 Sign In Again'}
 }
}
function requireAdmin(){const t=localStorage.getItem('ncr_admin_token');if(!t||t==='local-admin'){localStorage.removeItem('ncr_admin_token');localStorage.removeItem('ncr_admin_user');location.replace('login.html');return false}return true}
function addAdminCouponsLink(){if(!location.pathname.includes('/admin/')||location.pathname.endsWith('/login.html'))return;const nav=$('.navlinks');if(nav&&!nav.querySelector('.coupon-admin-link')){const a=document.createElement('a');a.href='coupons.html';a.className='coupon-admin-link';a.textContent='Coupons';const anchor=nav.querySelector('a[href="settings.html"]');anchor?nav.insertBefore(a,anchor):nav.appendChild(a)}}
function addCustomerAdminLinks(){
 if(location.pathname.includes('/admin/')||location.pathname.endsWith('/login.html'))return;
 const nav=$('.navlinks');
 if(nav&&!nav.querySelector('.customer-admin-link')){
   const a=document.createElement('a');a.href='admin/login.html';a.className='customer-admin-link';a.textContent='🔐 Admin Login';nav.appendChild(a);
 }
 const mobile=$('.mobilebar');
 if(mobile&&!mobile.querySelector('.customer-admin-mobile')){
   const a=document.createElement('a');a.href='admin/login.html';a.className='customer-admin-mobile';a.innerHTML='🔐<br>Admin';mobile.appendChild(a);
 }
}
async function initAdminLogin(){
 if(!location.pathname.includes('/admin/login.html'))return;
 localStorage.removeItem('ncr_admin_token');localStorage.removeItem('ncr_admin_user');
 const s=$('#backendStatus');if(!s)return;
 try{
   await api('/health');
   s.className='notice ok';s.textContent='✅ NCR SERVICES backend is online. You can sign in.';
 }catch(e){
   s.className='notice error';
   s.innerHTML='⚠️ Backend connection failed. '+esc(e.message)+'<br><small>API: '+esc(API)+'</small>';
 }
}
function boot(){updateCartCount();addAdminCouponsLink();addCustomerAdminLinks();initAdminLogin();initCatalog();initDetail();initCart();initQuotation();initCheckout()}
document.addEventListener('DOMContentLoaded',boot);window.addEventListener('pageshow',()=>{updateCartCount();addCustomerAdminLinks();});

window.addEventListener('pageshow',()=>{updateCartCount();if(location.pathname.includes('/admin/')&&!location.pathname.endsWith('/login.html')&&!localStorage.getItem('ncr_admin_token'))location.replace('login.html')});

/* ===== NCR SERVICES interaction polish: click ripple + safe page swipe ===== */
(function(){
  document.addEventListener('pointerdown',function(e){
    const el=e.target.closest('.btn,.navlinks a,.mobilebar a');
    if(!el)return;
    const r=el.getBoundingClientRect(),s=document.createElement('span');
    s.className='ncr-ripple';
    s.style.left=(e.clientX-r.left)+'px';
    s.style.top=(e.clientY-r.top)+'px';
    el.appendChild(s);
    setTimeout(()=>s.remove(),620);
  },{passive:true});
  document.addEventListener('click',function(e){
    const a=e.target.closest('a[href]');
    if(!a||a.target==='_blank'||a.hasAttribute('download')||e.defaultPrevented)return;
    const href=a.getAttribute('href')||'';
    if(!href||href.startsWith('#')||href.startsWith('javascript:')||/^(https?:|mailto:|tel:|sms:)/i.test(href))return;
    if(location.pathname.includes('/admin/')&&href==='login.html')return;
    document.body.classList.add('ncr-leave');
  },true);
})();
