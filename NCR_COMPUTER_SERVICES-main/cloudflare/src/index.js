export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const cors = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS'
    };
    if (request.method === 'OPTIONS') return new Response(null, {status:204, headers:cors});
    const json = (data, status=200) => new Response(JSON.stringify(data), {status, headers:{...cors,'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}});
    if (url.pathname.startsWith('/api')) {
      try {
        if (url.pathname === '/api/health') return json({ok:true, service:'NCR SERVICES Cloudflare API'});
        if (url.pathname === '/api/products' && request.method === 'GET') {
          const q = (url.searchParams.get('q') || '').trim();
          const category = (url.searchParams.get('category') || '').trim();
          let sql = 'SELECT * FROM products WHERE active=1'; const args=[];
          if(q){sql += ' AND (name LIKE ? OR sku LIKE ? OR description LIKE ?)'; const like=`%${q}%`; args.push(like,like,like)}
          if(category){sql += ' AND category=?'; args.push(category)}
          sql += ' ORDER BY id DESC LIMIT 100';
          const {results=[]}=await env.DB.prepare(sql).bind(...args).all();
          return json({products:results.map(publicProduct)});
        }
        const m=url.pathname.match(/^\/api\/products\/(\d+)$/);
        if(m && request.method==='GET'){
          const row=await env.DB.prepare('SELECT * FROM products WHERE id=? AND active=1').bind(Number(m[1])).first();
          return row?json(publicProduct(row)):json({error:'Product not found'},404);
        }
        if(url.pathname==='/api/orders' && request.method==='POST'){
          const b=await request.json();
          if(!b.customer_name||!b.phone||!Array.isArray(b.items)||!b.items.length)return json({error:'Name, mobile and products are required'},400);
          const ids=b.items.map(x=>Number(x.id)).filter(Number.isFinite);
          const items=[]; let subtotal=0;
          for(const id of ids){
            const p=await env.DB.prepare('SELECT * FROM products WHERE id=? AND active=1').bind(id).first();
            const qty=Math.max(1,Number(b.items.find(x=>Number(x.id)===id)?.qty)||1);
            if(!p)return json({error:'Product unavailable'},409);
            if(Number(p.stock)<qty)return json({error:`Insufficient stock for ${p.name}`},409);
            const item={id:p.id,sku:p.sku,name:p.name,qty,price:Number(p.price),warranty:p.warranty||'',image:p.image||''};
            items.push(item); subtotal += item.price*qty;
          }
          const payment_method=['UPI_QR','COD','PAY_AFTER_CONFIRMATION'].includes(String(b.payment_method))?String(b.payment_method):'COD';
          const payment_status=payment_method==='UPI_QR'?'Awaiting Payment':payment_method==='COD'?'Cash on Delivery':'Pay on Confirmation';
          const now=new Date().toISOString(); const invoice=`NCR/INV/${new Date().getFullYear()}/${Date.now().toString().slice(-6)}`;
          const total=Math.max(0,subtotal-Number(b.discount||0));
          const result=await env.DB.prepare(`INSERT INTO orders(invoice_no,customer_name,phone,email,address,items_json,subtotal,discount,tax,shipping,total,payment_method,payment_status,order_status,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(invoice,String(b.customer_name).trim(),String(b.phone).trim(),String(b.email||''),String(b.address||''),JSON.stringify(items),subtotal,Number(b.discount||0),0,0,total,payment_method,payment_status,'Pending',now,now).run();
          for(const item of items) await env.DB.prepare('UPDATE products SET stock=stock-?, updated_at=? WHERE id=?').bind(item.qty,now,item.id).run();
          return json({order:{id:result.meta.last_row_id,invoice_no:invoice,customer_name:b.customer_name,total,payment_method,payment_status,order_status:'Pending',items}});
        }
        return json({error:'Endpoint not found'},404);
      } catch (e) { return json({error:e?.message||'Server error'},500); }
    }
    if (typeof env.ASSETS?.fetch === 'function') {
      const assetResponse = await env.ASSETS.fetch(request);
      if (assetResponse.status !== 404) return assetResponse;
    }
    if (url.pathname === '/') {
      return new Response('The NCR SERVICES site is not deployed as a static asset bundle. Add the project root as the Worker asset directory or serve the site from Pages.', {status:503, headers:{'Content-Type':'text/plain; charset=utf-8'}});
    }
    return new Response('Page not found', {status:404, headers:{'Content-Type':'text/plain; charset=utf-8'}});
  }
};
function publicProduct(p){return {...p,highlights:JSON.parse(p.highlights_json||'[]'),specifications:JSON.parse(p.specifications_json||'{}'),images:JSON.parse(p.images_json||'[]')};}
