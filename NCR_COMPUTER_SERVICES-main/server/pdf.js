const fs=require('fs');
const path=require('path');
const QRCode=require('./qrcode');
const QRErrorCorrectLevel=require('./qrcode/QRErrorCorrectLevel');
function pdfEscape(s){return String(s??'').replace(/\\/g,'\\\\').replace(/\(/g,'\\(').replace(/\)/g,'\\)').replace(/[^\x20-\x7E]/g,'?');}
function money(n){return Number(n||0).toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2});}
function textOp(x,y,size,text,extra=''){return `${extra}BT /F1 ${size} Tf 1 0 0 1 ${x.toFixed(2)} ${y.toFixed(2)} Tm (${pdfEscape(text)}) Tj ET\n`;}
function rectOp(x,y,w,h,fill='0 0 0 rg'){return `${fill}\n${x.toFixed(2)} ${y.toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re f\n`;}
function lineOp(x1,y1,x2,y2,width=0.7){return `0.72 0.80 0.88 RG ${width} w ${x1.toFixed(2)} ${y1.toFixed(2)} m ${x2.toFixed(2)} ${y2.toFixed(2)} l S\n`;}
function imageObject(jpeg){const header=Buffer.from(`<< /Type /XObject /Subtype /Image /Width ${jpeg.width} /Height ${jpeg.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.data.length} >>\nstream\n`,'binary');return Buffer.concat([header,jpeg.data,Buffer.from('\nendstream','binary')]);}
function loadJpeg(file){const data=fs.readFileSync(file);const dims=jpegDimensions(data);return{data,width:dims.width,height:dims.height};}
function jpegDimensions(buf){let i=2;while(i<buf.length){if(buf[i]!==0xFF){i++;continue;}const marker=buf[i+1];i+=2;if(marker===0xD8||marker===0xD9||marker===0x01)continue;if(i+1>=buf.length)break;const len=buf.readUInt16BE(i);if(marker>=0xC0&&marker<=0xC3)return{height:buf.readUInt16BE(i+3),width:buf.readUInt16BE(i+5)};i+=len;}throw new Error('Unable to read JPEG dimensions');}
function buildPdf(objects){let out=Buffer.from('%PDF-1.4\n%\xFF\xFF\xFF\xFF\n','binary');const offsets=[0];for(let i=1;i<objects.length;i++){offsets[i]=out.length;const body=Buffer.isBuffer(objects[i])?objects[i]:Buffer.from(String(objects[i]),'binary');out=Buffer.concat([out,Buffer.from(`${i} 0 obj\n`,'binary'),body,Buffer.from('\nendobj\n','binary')]);}const xref=out.length;let x=`xref\n0 ${objects.length}\n0000000000 65535 f \n`;for(let i=1;i<objects.length;i++)x+=String(offsets[i]).padStart(10,'0')+' 00000 n \n';x+=`trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;return Buffer.concat([out,Buffer.from(x,'binary')]);}
function makePdf(title,lines){let content=textOp(50,790,16,title),y=766;for(const line of lines){content+=textOp(50,y,10,line.slice(0,180));y-=16;}const stream=Buffer.from(content,'binary');const objs=[];objs[1]='<< /Type /Catalog /Pages 2 0 R >>';objs[2]='<< /Type /Pages /Kids [3 0 R] /Count 1 >>';objs[3]='<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.32 841.92] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>';objs[4]='<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>';objs[5]=Buffer.concat([Buffer.from(`<< /Length ${stream.length} >>\nstream\n`,'binary'),stream,Buffer.from('\nendstream','binary')]);return buildPdf(objs);}
const CODE39={'0':'101001101101','1':'110100101011','2':'101100101011','3':'110110010101','4':'101001101011','5':'110100110101','6':'101100110101','7':'101001011011','8':'110100101101','9':'101100101101','A':'110101001011','B':'101101001011','C':'110110100101','D':'101011001011','E':'110101100101','F':'101101100101','G':'101010011011','H':'110101001101','I':'101101001101','J':'101011001101','K':'110101010011','L':'101101010011','M':'110110101001','N':'101011010011','O':'110101101001','P':'101101101001','Q':'101010110011','R':'110101011001','S':'101101011001','T':'101011011001','U':'110010101011','V':'100110101011','W':'110011010101','X':'100101101011','Y':'110010110101','Z':'100110110101','-':'100101011011','.':'110010101101',' ':'100110101101','$':'100100100101','/':'100100101001','+':'100101001001','%':'101001001001','*':'100101101101'};
function barcodeOp(value,x,y,w,h){let s='*'+String(value||'').toUpperCase().replace(/[^0-9A-Z\-\. $/+%]/g,'-')+'*';const pats=[...s].map(ch=>CODE39[ch]||CODE39['-']);const units=pats.reduce((n,pat)=>n+[...pat].reduce((a,b)=>a+(b==='1'?2:1),0)+1,0);const narrow=Math.max(0.32,w/units);let xx=x,out='0 0 0 rg\n';for(const pat of pats){for(let i=0;i<pat.length;i++){const bw=narrow*(pat[i]==='1'?2:1);if(i%2===0)out+=`${xx.toFixed(2)} ${y.toFixed(2)} ${bw.toFixed(2)} ${h.toFixed(2)} re f\n`;xx+=bw;}xx+=narrow;}return out+textOp(x,y-8,5,s.slice(1,-1),'0.03 0.11 0.29 rg\n');}
function qrMatrix(value){
 const qr=new QRCode(0,QRErrorCorrectLevel.M);
 qr.addData(String(value||''));
 qr.make();
 return qr.modules;
}
function qrOp(value,x,y,size){
 const m=qrMatrix(value), n=m.length, pad=4, cell=size/(n+pad*2);
 let out='1 1 1 rg\n'+`${x.toFixed(2)} ${y.toFixed(2)} ${size.toFixed(2)} ${size.toFixed(2)} re f\n`+'0 0 0 rg\n';
 for(let r=0;r<n;r++) for(let col=0;col<n;col++) if(m[r][col]){
   const xx=x+(col+pad)*cell, yy=y+size-(r+pad+1)*cell;
   out+=`${xx.toFixed(2)} ${yy.toFixed(2)} ${cell.toFixed(2)} ${cell.toFixed(2)} re f\n`;
 }
 return out;
}
function qrSvg(value,size=220){
 const m=qrMatrix(value), n=m.length, pad=4, vb=n+pad*2;
 let s=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${vb} ${vb}" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="white"/>`;
 for(let r=0;r<n;r++) for(let c=0;c<n;c++) if(m[r][c]) s+=`<rect x="${c+pad}" y="${r+pad}" width="1" height="1" fill="black"/>`;
 return s+'</svg>';
}
function fitText(s,max){const t=String(s??'');return t.length<=max?t:t.slice(0,Math.max(1,max-1))+'…';}
function amountWords(value){let n=Math.round(Number(value)||0);if(n===0)return'RUPEES ZERO ONLY';const a=['','ONE','TWO','THREE','FOUR','FIVE','SIX','SEVEN','EIGHT','NINE','TEN','ELEVEN','TWELVE','THIRTEEN','FOURTEEN','FIFTEEN','SIXTEEN','SEVENTEEN','EIGHTEEN','NINETEEN'];const t=['','','TWENTY','THIRTY','FORTY','FIFTY','SIXTY','SEVENTY','EIGHTY','NINETY'];const x=v=>v<20?a[v]:v<100?t[Math.floor(v/10)]+' '+a[v%10]:v<1000?a[Math.floor(v/100)]+' HUNDRED '+(v%100?x(v%100):''):v<100000?x(Math.floor(v/1000))+' THOUSAND '+(v%1000?x(v%1000):''):x(Math.floor(v/100000))+' LAKH '+(v%100000?x(v%100000):'');return'RUPEES '+x(n).replace(/\s+/g,' ').trim()+' ONLY';}
function buildDocumentPdf({title,series,customer,items,subtotal,discount,couponCode='',created_at,assetsDir,pdfUrl=''}){
 const isInvoice=String(title||'').toUpperCase().includes('INVOICE');
 const bg=loadJpeg(path.join(assetsDir,isInvoice?'invoice-background.jpg':'quotation-background.jpg'));
 const W=595.32,H=841.92,sx=W/1024,sy=H/1536,px=v=>v*sx,py=v=>H-v*sy;
 const box=(x,y,w,h,fill='0.98 0.99 1 rg')=>rectOp(px(x),py(y+h),px(w),px(h),fill);
 const total=Math.max(0,Number(subtotal||0)-Number(discount||0));let c='';
 c+=box(28,196,401,180,'0.98 0.995 1 rg');
 c+=textOp(px(46),py(224),9,'CUSTOMER DETAILS','0.03 0.16 0.31 rg\n');
 const crow=(label,val,y)=>{c+=textOp(px(47),py(y),7.2,label,'0.32 0.45 0.58 rg\n');c+=textOp(px(157),py(y),7.5,fitText(val||'—',42),'0.03 0.16 0.31 rg\n');c+=lineOp(px(47),py(y+7),px(413),py(y+7),0.35);};
 crow('Customer Name',customer?.name,249);crow('Mobile No.',customer?.phone,276);crow('Email',customer?.email,303);crow('Business','NCR SERVICES',330);
 c+=box(449,185,282,66);c+=textOp(px(466),py(203),7.4,isInvoice?'Invoice No. :':'Quotation No. :','0.03 0.16 0.31 rg\n');c+=textOp(px(574),py(203),7.8,fitText(series||'',24),'0.03 0.16 0.31 rg\n');c+=barcodeOp(series||title,px(474),py(239),px(230),px(31));
 c+=box(785,185,211,37);c+=textOp(px(803),py(207),7.4,'DATE :','0.03 0.16 0.31 rg\n');c+=textOp(px(855),py(207),7.6,new Date(created_at||Date.now()).toLocaleDateString('en-IN',{day:'2-digit',month:'2-digit',year:'numeric'}),'0.03 0.16 0.31 rg\n');
 c+=box(449,251,549,125);c+=textOp(px(472),py(276),8.5,'WARRANTY DETAILS','0.03 0.16 0.31 rg\n');c+=textOp(px(472),py(300),7.2,'All items under 2 years warranty','0.03 0.16 0.31 rg\n');c+=textOp(px(472),py(326),7.0,'1st Year : Piece-to-piece replacement warranty','0.03 0.16 0.31 rg\n');c+=textOp(px(472),py(351),7.0,'2nd Year : Service warranty','0.03 0.16 0.31 rg\n');
 const tx=28,ty=385,tw=969,header=27,row=42;
 const cols=[140,330,120,75,145,159];
 const heads=['S.NO','PRODUCT NAME / DESCRIPTION','HSN CODE','QTY','UNIT PRICE (₹)','TOTAL PRICE (₹)'];
 let cx=tx;
 for(let i=0;i<cols.length;i++){c+=box(cx,ty,cols[i],header,'0.03 0.17 0.34 rg');c+=textOp(px(cx+cols[i]/2-(heads[i].length*2.0)),py(402),7,heads[i],'1 1 1 rg\n');cx+=cols[i];}
 (items||[]).slice(0,6).forEach((it,i)=>{
   const y=ty+header+i*row; let x=tx; const vals=[String(i+1),fitText(it.name||'Item',33)+'\n'+fitText(it.sku||'',38),fitText(it.hsn||'',8),String(it.qty??''),money(it.price),money(Number(it.price||0)*Number(it.qty||0))];
   for(let j=0;j<cols.length;j++){c+=box(x,y,cols[j],row,(i%2===0)?'0.98 0.995 1 rg':'0.95 0.98 1 rg');
     if(j===1){c+=textOp(px(x+8),py(y+19),7,fitText(it.name||'Item',33),'0.03 0.16 0.31 rg\n');c+=textOp(px(x+8),py(y+32),5.6,fitText(it.sku||'',38),'0.32 0.45 0.58 rg\n');}
     else {const align=(j===0||j===2||j===3)?(x+cols[j]/2-4):(x+cols[j]-50);c+=textOp(px(align),py(y+25),j>=4?6.8:7.0,vals[j],'0.03 0.16 0.31 rg\n');}
     x+=cols[j];
   }
 });
 c+=box(28,674,600,133,'0.98 0.995 1 rg');c+=textOp(px(47),py(699),8,'TERMS & CONDITIONS','0.03 0.16 0.31 rg\n');
 const terms=isInvoice?['Invoice is valid for the supplied items.','Warranty applies as stated above.','Please retain the invoice serial for service support.','Total = Subtotal − Discount. No GST / tax is applied.']:['Quotation is valid for 15 days from the date of issue.','Prices are subject to change without prior notice.','Payment terms: 50% Advance, 50% Before Delivery.','Warranty as stated above. No GST / tax is applied.'];terms.forEach((t,i)=>c+=textOp(px(47),py(723+i*18),6.8,'• '+t,'0.03 0.16 0.31 rg\n'));
 c+=box(651,677,345,75,'0.98 0.995 1 rg');c+=textOp(px(671),py(697),8,'Sub Total','0.03 0.16 0.31 rg\n');c+=textOp(px(871),py(697),8,money(subtotal),'0.03 0.16 0.31 rg\n');c+=textOp(px(671),py(720),8,couponCode?`Discount (${fitText(couponCode,18)})`:'Discount','0.03 0.16 0.31 rg\n');c+=textOp(px(871),py(720),8,money(discount),'0.03 0.16 0.31 rg\n');c+=box(651,728,345,24,'0.03 0.17 0.34 rg');c+=textOp(px(671),py(745),9,'GRAND TOTAL','1 1 1 rg\n');c+=textOp(px(871),py(745),9,money(total),'1 1 1 rg\n');
 c+=barcodeOp(series||title,px(410),py(815),px(210),px(38));if(isInvoice&&pdfUrl){c+=box(670,770,120,112,'1 1 1 rg');c+=qrOp(pdfUrl,px(684),py(880),px(92));c+=textOp(px(680),py(895),5.8,'SCAN TO DOWNLOAD BILL PDF','0.03 0.16 0.31 rg\n');}c+=textOp(px(858),py(800),6.4,'Authorised Signatory','0.03 0.25 0.46 rg\n');c+=textOp(px(882),py(813),6.2,'For NCR SERVICES','0.03 0.25 0.46 rg\n');
 const content=Buffer.from(c,'binary');const objs=[];objs[1]='<< /Type /Catalog /Pages 2 0 R >>';objs[2]='<< /Type /Pages /Kids [3 0 R] /Count 1 >>';objs[3]=`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /Font << /F1 4 0 R >> /XObject << /BG 5 0 R >> >> /Contents 6 0 R >>`;objs[4]='<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>';objs[5]=imageObject(bg);const stream=`q\n${W} 0 0 ${H} 0 0 cm\n/BG Do\nQ\n`;objs[6]=Buffer.concat([Buffer.from(`<< /Length ${Buffer.byteLength(stream,'binary')+content.length} >>\nstream\n`,'binary'),Buffer.from(stream,'binary'),content,Buffer.from('endstream','binary')]);return buildPdf(objs);
}
function makeQuotationPdf({quote,items,assetsDir}){return buildDocumentPdf({title:'QUOTATION',series:quote.quote_no,customer:{name:quote.customer_name,phone:quote.phone,email:quote.email},items,subtotal:quote.subtotal,discount:quote.discount,created_at:quote.created_at,assetsDir});}
function makeInvoicePdf({order,items,assetsDir=path.join(__dirname,'..','assets'),pdfUrl=''}){return buildDocumentPdf({title:'BILL / INVOICE',series:order.invoice_no,customer:{name:order.customer_name,phone:order.phone,email:order.email},items,subtotal:order.subtotal,discount:order.discount,couponCode:order.coupon_code||'',created_at:order.created_at,assetsDir,pdfUrl});}
module.exports={makePdf,makeQuotationPdf,makeInvoicePdf,qrSvg};
