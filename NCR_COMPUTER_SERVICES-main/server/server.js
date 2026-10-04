const http=require('http'),fs=require('fs'),path=require('path'),crypto=require('crypto'),url=require('url');
const {makeQuotationPdf,makeInvoicePdf,qrSvg}=require('./pdf');
const ROOT=path.join(__dirname,'..');
const DATA_FILE=process.env.DATA_FILE||path.join(__dirname,'data.json');
const UPLOAD_DIR=process.env.UPLOAD_DIR||path.join(ROOT,'assets','products');
const PORT=Number(process.env.PORT||3000);
const ADMIN_EMAIL=(process.env.ADMIN_EMAIL||'admin@ncrservices.local').toLowerCase();
const ADMIN_PASSWORD=String(process.env.ADMIN_PASSWORD||'7730');
const products=[];

function seed(){return{catalog_version:9,settings:{business_name:'NCR SERVICES',business_email:process.env.BUSINESS_EMAIL||'pavankumarvaali@gmail.com',business_phone:process.env.BUSINESS_PHONE||'+91 77309 82924',upi_id:process.env.UPI_ID||'7730982924-6@ybl'},users:[{id:1,name:'NCR Administrator',email:ADMIN_EMAIL,password:ADMIN_PASSWORD,phone:process.env.BUSINESS_PHONE||'+91 77309 82924',role:'admin'}],products,orders:[],quotes:[],service_requests:[],coupons:[],counters:{},request_keys:{}}}
function load(){try{const d=JSON.parse(fs.readFileSync(DATA_FILE,'utf8'));d.settings??={};d.users??=[];d.products??=[];d.orders??=[];d.quotes??=[];d.service_requests??=[];d.coupons??=[];d.counters??={};d.request_keys??={};if(!d.users.length)d.users=seed().users;if(d.catalog_version!==9)d.catalog_version=9;fs.writeFileSync(DATA_FILE,JSON.stringify(d,null,2));return d}catch{const d=seed();fs.mkdirSync(path.dirname(DATA_FILE),{recursive:true});fs.writeFileSync(DATA_FILE,JSON.stringify(d,null,2));return d}}
let db=load();
function save(){fs.mkdirSync(path.dirname(DATA_FILE),{recursive:true});fs.writeFileSync(DATA_FILE,JSON.stringify(db,null,2))}
function token(){return crypto.randomBytes(18).toString('hex')}
function publicApiOrigin(){return String(process.env.PUBLIC_BASE_URL||'https://ncr-services-store.onrender.com').replace(/\/$/,'')}
function billPdfUrlFor(token){return publicApiOrigin()+'/api/bills/'+encodeURIComponent(token)+'/pdf?download=1'}
function nextId(a){return a.length?Math.max(...a.map(x=>Number(x.id)||0))+1:1}
function seq(k,p){const y=new Date().getFullYear(),key=k+'_'+y;db.counters[key]=(db.counters[key]||0)+1;return `${p}/${y}/${String(db.counters[key]).padStart(4,'0')}`}
function rememberRequest(key,type,obj){if(!key)return;db.request_keys[key]={type,id:obj.id,created_at:new Date().toISOString()};const keys=Object.keys(db.request_keys);if(keys.length>500)delete db.request_keys[keys[0]]}
function duplicateRequest(key,type){if(!key)return null;const r=db.request_keys[key];return r&&r.type===type?r:null}
function normalizeCouponCode(v){return String(v||'').trim().toUpperCase().replace(/\s+/g,'')}
function couponResult(coupon,subtotal){
 if(!coupon||coupon.active===0)return {error:'Coupon code is invalid or inactive'};
 const now=Date.now();
 if(coupon.starts_at&&Date.parse(coupon.starts_at)>now)return {error:'Coupon is not active yet'};
 if(coupon.expires_at&&Date.parse(coupon.expires_at)<now)return {error:'Coupon has expired'};
 if(Number(coupon.max_uses||0)>0&&Number(coupon.uses||0)>=Number(coupon.max_uses||0))return {error:'Coupon usage limit reached'};
 const sub=Math.max(0,Number(subtotal||0));
 if(sub<Number(coupon.min_order||0))return {error:`Minimum order value for this coupon is ₹${Number(coupon.min_order||0).toLocaleString('en-IN')}`};
 let discount=coupon.type==='percent'?sub*Number(coupon.value||0)/100:Number(coupon.value||0);
 if(coupon.type==='percent'&&Number(coupon.max_discount||0)>0)discount=Math.min(discount,Number(coupon.max_discount||0));
 discount=Math.min(sub,Math.max(0,discount));
 return {coupon:{id:coupon.id,code:coupon.code,type:coupon.type,value:Number(coupon.value||0),min_order:Number(coupon.min_order||0),max_discount:Number(coupon.max_discount||0),discount:Number(discount.toFixed(2)),expires_at:coupon.expires_at||''}};
}
const sessions=new Map();
function send(res,status,data,type='json'){res.statusCode=status;res.setHeader('Cache-Control','no-store');res.setHeader('Access-Control-Allow-Origin','*');res.setHeader('Access-Control-Allow-Headers','Content-Type, Authorization');res.setHeader('Access-Control-Allow-Methods','GET,POST,PUT,PATCH,DELETE,OPTIONS');if(type==='json'){res.setHeader('Content-Type','application/json; charset=utf-8');res.end(JSON.stringify(data))}else{res.setHeader('Content-Type',type);res.end(data)}}
function read(req){return new Promise((resolve,reject)=>{let s='';req.on('data',c=>{s+=c;if(s.length>10e6)reject(Error('Request too large'))});req.on('end',()=>{try{resolve(s?JSON.parse(s):{})}catch(e){reject(e)}});req.on('error',reject)})}
function auth(req,res){const t=(req.headers.authorization||'').replace(/^Bearer\s+/,'');const u=sessions.get(t);if(!u){send(res,401,{error:'Authentication required'});return null}return u}
function admin(req,res){const u=auth(req,res);if(!u)return null;return u.role==='admin'?u:(send(res,403,{error:'Admin access required'}),null)}
function publicProduct(x){return x}
async function route(req,res,p){const m=req.method,q=url.parse(req.url,true).query;try{
 if(m==='POST'&&p==='/api/auth/login'){
  const b=await read(req),email=String(b.email||'').trim().toLowerCase(),password=String(b.password||'');
  const u=db.users.find(x=>String(x.email||'').toLowerCase()===email&&String(x.password||'')===password);
  if(!u)return send(res,401,{error:'Invalid admin email or password'});
  const t=token();sessions.set(t,{id:u.id,email:u.email,role:u.role});return send(res,200,{token:t,user:{id:u.id,name:u.name,email:u.email,role:u.role}})
 }
 if(m==='POST'&&p==='/api/auth/logout'){const t=(req.headers.authorization||'').replace(/^Bearer\s+/,'');sessions.delete(t);return send(res,200,{ok:true})}
 if(m==='GET'&&p==='/api/health')return send(res,200,{ok:true,service:'NCR SERVICES'});
 if(m==='GET'&&p==='/api/products'){
  let a=db.products.filter(x=>x.active);if(q.q)a=a.filter(x=>(x.name+' '+x.sku+' '+x.description).toLowerCase().includes(String(q.q).toLowerCase()));if(q.category)a=a.filter(x=>x.category===q.category);
  const cats={};a.forEach(x=>cats[x.category]=(cats[x.category]||0)+1);return send(res,200,{products:a,categories:Object.keys(cats).sort().map(c=>({category:c,count:cats[c]}))})
 }
 if(m==='GET'&&/^\/api\/products\/\d+$/.test(p)){const x=db.products.find(x=>x.id===Number(p.split('/').pop())&&x.active);return x?send(res,200,publicProduct(x)):send(res,404,{error:'Product not found'})}
 if(m==='POST'&&p==='/api/quotes'){
  const b=await read(req),dup=duplicateRequest(b.request_id,'quote');if(dup){const x=db.quotes.find(x=>x.id===dup.id);if(x)return send(res,200,{...x,items:JSON.parse(x.items_json)})}
  if(!b.customer_name||!b.phone||!Array.isArray(b.items)||!b.items.length)return send(res,400,{error:'Name, mobile and products are required'});
  const items=b.items.map(i=>{const x=db.products.find(x=>x.id===Number(i.id)&&x.active);if(!x)throw Error('Product unavailable');return{id:x.id,sku:x.sku,name:x.name,qty:Math.max(1,Number(i.qty)||1),price:x.price,warranty:x.warranty||'2 Year Warranty',hsn:x.hsn||'',image:x.image||''}});
  const subtotal=items.reduce((s,x)=>s+x.price*x.qty,0),discount=Math.max(0,Number(b.discount||0));
  const x={id:nextId(db.quotes),quote_no:seq('quote','NCR/QUO'),customer_name:String(b.customer_name).trim(),phone:String(b.phone).trim(),email:String(b.email||'').trim(),address:'',city:'',state:'',pin:'',items_json:JSON.stringify(items),subtotal,discount,tax:0,total:Math.max(0,subtotal-discount),status:'Draft',created_at:new Date().toISOString()};
  db.quotes.push(x);rememberRequest(b.request_id,'quote',x);save();return send(res,200,{...x,items})
 }
 if(m==='GET'&&/^\/api\/quotes\/\d+$/.test(p)){const x=db.quotes.find(x=>x.id===Number(p.split('/').pop()));return x?send(res,200,{...x,items:JSON.parse(x.items_json)}):send(res,404,{error:'Quotation not found'})}
 if(m==='GET'&&/^\/api\/quotes\/\d+\/pdf$/.test(p)){const x=db.quotes.find(x=>x.id===Number(p.split('/')[3]));if(!x)return send(res,404,{error:'Quotation not found'});const pdf=makeQuotationPdf({quote:x,items:JSON.parse(x.items_json),assetsDir:path.join(ROOT,'assets')});res.statusCode=200;res.setHeader('Content-Type','application/pdf');return res.end(pdf)}
 if(m==='POST'&&p==='/api/orders'){
  const b=await read(req),dup=duplicateRequest(b.request_id,'order');if(dup){const old=db.orders.find(x=>x.id===dup.id);if(old)return send(res,200,{order:old})}
  const raw=b.items?.map(i=>{const x=db.products.find(x=>x.id===Number(i.id)&&x.active);return x?{id:x.id,sku:x.sku,name:x.name,qty:Math.max(1,Number(i.qty)||1),price:x.price,warranty:x.warranty||'2 Year Warranty',hsn:x.hsn||'',image:x.image||''}:null});
  if(!b.customer_name||!b.phone||!raw?.length||raw.some(x=>!x))return send(res,400,{error:'Name, mobile and valid items are required'});
  for(const i of raw){const p=db.products.find(x=>x.id===i.id);if(!p||Number(p.stock||0)<Number(i.qty||0))return send(res,409,{error:`Insufficient stock for ${p?.name||'product'}`})}
  const subtotal=raw.reduce((s,x)=>s+x.price*x.qty,0);
  const couponCode=normalizeCouponCode(b.coupon_code);let discount=0,coupon=null;
  if(couponCode){coupon=db.coupons.find(x=>x.code===couponCode);const cr=couponResult(coupon,subtotal);if(cr.error)return send(res,400,{error:cr.error});discount=Number(cr.coupon.discount||0)}
  const allowedPayments={UPI_QR:'UPI / QR Payment',COD:'Cash on Delivery / Pickup',PAY_AFTER_CONFIRMATION:'Pay after confirmation'};const payment_method=allowedPayments[String(b.payment_method||'UPI_QR')]?String(b.payment_method):'UPI_QR';const payment_status=payment_method==='UPI_QR'?'Awaiting Payment':payment_method==='COD'?'Cash on Delivery':'Pay on Confirmation';const o={id:nextId(db.orders),invoice_no:seq('invoice','NCR/INV'),customer_name:String(b.customer_name).trim(),phone:String(b.phone).trim(),email:String(b.email||'').trim(),address:String(b.address||'').trim(),items_json:JSON.stringify(raw),subtotal,discount,coupon_code:couponCode,tax:0,shipping:0,total:Math.max(0,subtotal-discount),payment_method,payment_status,status:'Pending',bill_token:token(),created_at:new Date().toISOString()};
  raw.forEach(i=>{const p=db.products.find(x=>x.id===i.id);p.stock=Math.max(0,Number(p.stock||0)-Number(i.qty||0))});
  if(coupon)coupon.uses=Number(coupon.uses||0)+1;
  db.orders.push(o);rememberRequest(b.request_id,'order',o);save();return send(res,200,{order:o})
 }
 if(m==='GET'&&/^\/api\/bills\/[^/]+$/.test(p)){const x=db.orders.find(x=>x.bill_token===p.split('/').pop());return x?send(res,200,{...x,items:JSON.parse(x.items_json)}):send(res,404,{error:'Bill not found'})}
 if(m==='GET'&&/^\/api\/invoices\/[^/]+\/pdf$/.test(p)){const x=db.orders.find(x=>x.bill_token===p.split('/')[3]);if(!x)return send(res,404,{error:'Invoice not found'});const pdf=makeInvoicePdf({order:x,items:JSON.parse(x.items_json),assetsDir:path.join(ROOT,'assets'),pdfUrl:billPdfUrlFor(x.bill_token)});res.statusCode=200;res.setHeader('Content-Type','application/pdf');if(q.download==='1')res.setHeader('Content-Disposition',`attachment; filename="${String(x.invoice_no||'NCR-INVOICE').replace(/[^A-Za-z0-9_-]/g,'-')}.pdf"`);return res.end(pdf)}
 if(m==='GET'&&/^\/api\/bills\/[^/]+\/pdf$/.test(p)){const x=db.orders.find(x=>x.bill_token===p.split('/')[3]);if(!x)return send(res,404,{error:'Bill not found'});const pdf=makeInvoicePdf({order:x,items:JSON.parse(x.items_json),assetsDir:path.join(ROOT,'assets'),pdfUrl:billPdfUrlFor(x.bill_token)});res.statusCode=200;res.setHeader('Content-Type','application/pdf');if(q.download==='1')res.setHeader('Content-Disposition',`attachment; filename="${String(x.invoice_no||'NCR-BILL').replace(/[^A-Za-z0-9_-]/g,'-')}.pdf"`);return res.end(pdf)}
 if(m==='GET'&&/^\/api\/bills\/[^/]+\/qr\.svg$/.test(p)){const x=db.orders.find(x=>x.bill_token===p.split('/')[3]);if(!x)return send(res,404,{error:'Bill not found'});const svg=qrSvg(billPdfUrlFor(x.bill_token));res.statusCode=200;res.setHeader('Content-Type','image/svg+xml; charset=utf-8');res.setHeader('Cache-Control','no-store');return res.end(svg)}
 if(m==='GET'&&p==='/api/public/settings')return send(res,200,db.settings);
 if(m==='POST'&&p==='/api/coupons/validate'){const b=await read(req),code=normalizeCouponCode(b.code);if(!code)return send(res,400,{error:'Coupon code is required'});const c=db.coupons.find(x=>x.code===code);const r=couponResult(c,b.subtotal);return r.error?send(res,400,{error:r.error}):send(res,200,r)}
 if(m==='POST'&&p==='/api/service-requests'){
  const b=await read(req),dup=duplicateRequest(b.request_id,'service');if(dup){const old=db.service_requests.find(x=>x.id===dup.id);if(old)return send(res,200,{request:old})}
  if(!b.customer_name||!b.phone||!b.service||!b.problem)return send(res,400,{error:'Name, mobile, service and problem are required'});
  const r={id:nextId(db.service_requests),request_no:seq('service','NCR/SRV'),customer_name:String(b.customer_name).trim(),phone:String(b.phone).trim(),email:String(b.email||'').trim(),preferred_date:String(b.preferred_date||''),service:String(b.service).trim(),problem:String(b.problem).trim(),address:String(b.address||'').trim(),status:'New',admin_reply:'',created_at:new Date().toISOString(),updated_at:new Date().toISOString()};
  db.service_requests.push(r);rememberRequest(b.request_id,'service',r);save();return send(res,200,{request:r})
 }
 if(p.startsWith('/api/admin/upload-image')){if(!admin(req,res))return;if(m!=='POST')return send(res,405,{error:'Method not allowed'});const b=await read(req),data=String(b.data||'');const match=data.match(/^data:image\/(png|jpeg|jpg|webp|gif);base64,(.+)$/);if(!match)return send(res,400,{error:'Valid PNG, JPG, JPEG, WEBP or GIF image required'});if(match[2].length>7000000)return send(res,413,{error:'Image is too large'});const ext=match[1]==='jpeg'?'jpg':match[1],name=`product-${Date.now()}-${crypto.randomBytes(3).toString('hex')}.${ext}`;fs.mkdirSync(UPLOAD_DIR,{recursive:true});fs.writeFileSync(path.join(UPLOAD_DIR,name),Buffer.from(match[2],'base64'));return send(res,200,{filename:`products/${name}`,url:`/assets/products/${name}`})}
 if(p.startsWith('/api/admin/')){
  if(!admin(req,res))return;
  if(m==='GET'&&p==='/api/admin/dashboard')return send(res,200,{products:db.products.filter(x=>x.active).length,orders:db.orders.length,sales:db.orders.reduce((s,x)=>s+Number(x.total||0),0),services:db.service_requests.length,quotes:db.quotes.length,recent:db.orders.slice(-8).reverse(),lowStock:db.products.filter(x=>x.active&&Number(x.stock||0)<=5)});
  if(m==='GET'&&p==='/api/admin/products')return send(res,200,{products:db.products});
  if(m==='POST'&&p==='/api/admin/products'){
   const b=await read(req),dup=duplicateRequest(b.request_id,'product');if(dup){const old=db.products.find(x=>x.id===dup.id);if(old)return send(res,200,old)}
   if(!String(b.name||'').trim()||!String(b.category||'').trim())return send(res,400,{error:'Product name and category are required'});
   const prefix='NCR-'+String(b.category||'PRD').replace(/[^A-Za-z0-9]/g,'').toUpperCase().slice(0,4)||'PRD';const used=new Set(db.products.map(x=>String(x.sku||'')));let n=1,sku='';do{sku=`${prefix}-${String(n++).padStart(4,'0')}`}while(used.has(sku));
   const images=Array.isArray(b.images)?b.images.map(v=>String(v||'').trim()).filter(Boolean):[];const mainImage=String(b.image||images[0]||'products/laptop.svg').trim()||'products/laptop.svg';if(mainImage&&!images.includes(mainImage))images.unshift(mainImage);
   const x={id:nextId(db.products),sku,name:String(b.name).trim(),category:String(b.category).trim(),brand:String(b.brand||'').trim(),condition:String(b.condition||'').trim(),description:String(b.description||''),highlights:Array.isArray(b.highlights)?b.highlights.map(v=>String(v||'').trim()).filter(Boolean):[],specifications:(b.specifications&&typeof b.specifications==='object'&&!Array.isArray(b.specifications))?b.specifications:{},price:Number(b.price||0),mrp:Number(b.mrp||b.price||0),stock:Math.max(0,Number(b.stock||0)),warranty:String(b.warranty||'2 Year Warranty'),image:mainImage,images,active:1};db.products.push(x);rememberRequest(b.request_id,'product',x);save();return send(res,200,x)
  }
  if(m==='PUT'&&/^\/api\/admin\/products\/\d+$/.test(p)){const x=db.products.find(x=>x.id===Number(p.split('/').pop()));if(!x)return send(res,404,{error:'Product not found'});const b=await read(req);if('stock' in b)b.stock=Math.max(0,Number(b.stock||0));if('brand' in b)b.brand=String(b.brand||'').trim();if('condition' in b)b.condition=String(b.condition||'').trim();if('highlights' in b)b.highlights=Array.isArray(b.highlights)?b.highlights.map(v=>String(v||'').trim()).filter(Boolean):[];if('specifications' in b)b.specifications=(b.specifications&&typeof b.specifications==='object'&&!Array.isArray(b.specifications))?b.specifications:{};if(Array.isArray(b.images)){b.images=b.images.map(v=>String(v||'').trim()).filter(Boolean);if(b.image&&!b.images.includes(String(b.image).trim()))b.images.unshift(String(b.image).trim());if(!b.image&&b.images[0])b.image=b.images[0]}else if(b.image&&(!Array.isArray(x.images)||!x.images.length)){b.images=[String(b.image).trim()]}Object.assign(x,b,{id:x.id,sku:x.sku});if(!Array.isArray(x.images))x.images=x.image?[x.image]:[];save();return send(res,200,x)}
  if(m==='DELETE'&&/^\/api\/admin\/products\/\d+$/.test(p)){const x=db.products.find(x=>x.id===Number(p.split('/').pop()));if(!x)return send(res,404,{error:'Product not found'});x.active=0;save();return send(res,200,{ok:true})}
  if(m==='GET'&&p==='/api/admin/orders')return send(res,200,{orders:db.orders});
  if(m==='DELETE'&&/^\/api\/admin\/orders\/\d+$/.test(p)){const id=Number(p.split('/').pop()),i=db.orders.findIndex(x=>x.id===id);if(i<0)return send(res,404,{error:'Order not found'});db.orders.splice(i,1);save();return send(res,200,{ok:true})}
  if(m==='DELETE'&&p==='/api/admin/orders'){db.orders=[];save();return send(res,200,{ok:true})}
  if(m==='PATCH'&&/^\/api\/admin\/orders\/\d+$/.test(p)){const x=db.orders.find(x=>x.id===Number(p.split('/').pop()));if(!x)return send(res,404,{error:'Order not found'});Object.assign(x,await read(req),{id:x.id});save();return send(res,200,x)}
  if(m==='POST'&&/^\/api\/admin\/orders\/\d+\/status$/.test(p)){const x=db.orders.find(x=>x.id===Number(p.split('/')[4]));if(!x)return send(res,404,{error:'Order not found'});const b=await read(req);if(!['Pending','Processing','Completed','Cancelled'].includes(String(b.status||'')))return send(res,400,{error:'Invalid order status'});x.status=String(b.status);save();return send(res,200,x)}
  if(m==='GET'&&p==='/api/admin/services')return send(res,200,{requests:db.service_requests});
  if(m==='PATCH'&&/^\/api\/admin\/services\/\d+$/.test(p)){const x=db.service_requests.find(x=>x.id===Number(p.split('/').pop()));if(!x)return send(res,404,{error:'Service request not found'});const b=await read(req);Object.assign(x,{status:b.status||x.status,admin_reply:b.admin_reply??x.admin_reply??'',updated_at:new Date().toISOString(),resolved_at:['Solved','Closed'].includes(b.status)?new Date().toISOString():x.resolved_at});save();return send(res,200,x)}
  if(m==='DELETE'&&/^\/api\/admin\/services\/\d+$/.test(p)){const id=Number(p.split('/').pop()),i=db.service_requests.findIndex(x=>x.id===id);if(i<0)return send(res,404,{error:'Service request not found'});db.service_requests.splice(i,1);save();return send(res,200,{ok:true})}
  if(m==='DELETE'&&p==='/api/admin/services'){db.service_requests=[];save();return send(res,200,{ok:true})}
  if(m==='GET'&&p==='/api/admin/quotes')return send(res,200,{quotes:db.quotes});
  if(m==='DELETE'&&/^\/api\/admin\/quotes\/\d+$/.test(p)){const id=Number(p.split('/').pop()),i=db.quotes.findIndex(x=>x.id===id);if(i<0)return send(res,404,{error:'Quotation not found'});db.quotes.splice(i,1);save();return send(res,200,{ok:true})}
  if(m==='GET'&&p==='/api/admin/coupons')return send(res,200,{coupons:db.coupons});
  if(m==='POST'&&p==='/api/admin/coupons'){const b=await read(req),code=normalizeCouponCode(b.code);if(!/^[A-Z0-9_-]{3,30}$/.test(code))return send(res,400,{error:'Coupon code must be 3-30 letters, numbers, hyphens or underscores'});if(db.coupons.some(c=>c.code===code))return send(res,409,{error:'Coupon code already exists'});const type=String(b.type||'percent')==='fixed'?'fixed':'percent',value=Number(b.value||0);if(!(value>0)||type==='percent'&&value>100)return send(res,400,{error:type==='percent'?'Percentage discount must be between 0 and 100':'Discount value must be greater than 0'});const c={id:nextId(db.coupons),code,type,value,min_order:Math.max(0,Number(b.min_order||0)),max_discount:Math.max(0,Number(b.max_discount||0)),max_uses:Math.max(0,Number(b.max_uses||0)),uses:0,active:b.active===false?0:1,starts_at:String(b.starts_at||''),expires_at:String(b.expires_at||''),created_at:new Date().toISOString(),updated_at:new Date().toISOString()};db.coupons.push(c);save();return send(res,200,c)}
  if(m==='PUT'&&/^\/api\/admin\/coupons\/\d+$/.test(p)){const x=db.coupons.find(x=>x.id===Number(p.split('/').pop()));if(!x)return send(res,404,{error:'Coupon not found'});const b=await read(req);if('code' in b){const code=normalizeCouponCode(b.code);if(!/^[A-Z0-9_-]{3,30}$/.test(code))return send(res,400,{error:'Invalid coupon code'});if(db.coupons.some(c=>c.id!==x.id&&c.code===code))return send(res,409,{error:'Coupon code already exists'});b.code=code}if('type' in b)b.type=String(b.type)==='fixed'?'fixed':'percent';if('value' in b){b.value=Number(b.value||0);if(!(b.value>0)||b.type==='percent'&&b.value>100)return send(res,400,{error:'Invalid discount value'})}if('active' in b)b.active=b.active?1:0;['min_order','max_discount','max_uses'].forEach(k=>{if(k in b)b[k]=Math.max(0,Number(b[k]||0))});Object.assign(x,b,{id:x.id,updated_at:new Date().toISOString()});save();return send(res,200,x)}
  if(m==='DELETE'&&/^\/api\/admin\/coupons\/\d+$/.test(p)){const x=db.coupons.find(x=>x.id===Number(p.split('/').pop()));if(!x)return send(res,404,{error:'Coupon not found'});x.active=0;x.updated_at=new Date().toISOString();save();return send(res,200,{ok:true})}
  if(m==='GET'&&p==='/api/admin/categories'){const c={};db.products.filter(x=>x.active).forEach(x=>{c[x.category]??={category:x.category,count:0,units:0,stock_value:0};c[x.category].count++;c[x.category].units+=Number(x.stock||0);c[x.category].stock_value+=Number(x.stock||0)*Number(x.price||0)});return send(res,200,{categories:Object.values(c)})}
  if(m==='GET'&&p==='/api/admin/settings')return send(res,200,{...db.settings,admin_email:db.users[0]?.email||''});
  if(m==='PUT'&&p==='/api/admin/settings'){const b=await read(req);Object.assign(db.settings,{business_name:String(b.business_name??db.settings.business_name),business_email:String(b.business_email??db.settings.business_email),business_phone:String(b.business_phone??db.settings.business_phone),upi_id:String(b.upi_id??db.settings.upi_id)});save();return send(res,200,db.settings)}
  if(m==='PUT'&&p==='/api/admin/account'){
   const u=db.users[0];if(!u)return send(res,404,{error:'Admin account not found'});const b=await read(req);if(String(b.current_password||'')!==String(u.password||''))return send(res,400,{error:'Current password is incorrect'});const email=String(b.email||u.email).trim().toLowerCase(),password=String(b.new_password||'');if(!email)return send(res,400,{error:'Email is required'});if(password.length<4)return send(res,400,{error:'New password must be at least 4 characters'});u.email=email;u.password=password;for(const [t] of sessions)sessions.delete(t);save();return send(res,200,{ok:true,email:u.email})
  }
 }
 return send(res,404,{error:'Not found'})
}catch(e){console.error(e);return send(res,500,{error:e.message||'Server error'})}}
const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'application/javascript; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.gif':'image/gif','.svg':'image/svg+xml','.json':'application/json'};
function serve(req,res){let p=url.parse(req.url).pathname;if(p==='/')p='/index.html';let f=path.normalize(path.join(ROOT,p));if(!f.startsWith(ROOT)||!fs.existsSync(f))f=path.join(ROOT,'404.html');if(fs.existsSync(f)&&fs.statSync(f).isDirectory()){const i=path.join(f,'index.html');f=fs.existsSync(i)?i:path.join(ROOT,'404.html')}res.statusCode=f.endsWith('404.html')?404:200;res.setHeader('Content-Type',mime[path.extname(f)]||'text/plain');res.setHeader('Cache-Control',path.extname(f)==='.html'?'no-cache':'public,max-age=86400');fs.createReadStream(f).pipe(res)}
http.createServer(async(req,res)=>{if(req.method==='OPTIONS')return send(res,204,{});const p=url.parse(req.url).pathname;return p.startsWith('/api/')?route(req,res,p):serve(req,res)}).listen(PORT,()=>console.log(`NCR SERVICES running on ${PORT}`));
