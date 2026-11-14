import {createServer} from "node:http";
import {readFile,stat} from "node:fs/promises";
import {fileURLToPath} from "node:url";
import {dirname,join,extname,normalize} from "node:path";
import {randomBytes,randomUUID,createHash,timingSafeEqual,createHmac} from "node:crypto";
import {init,query,checkDatabase,hasDatabase} from "./lib/db.js";
import {SCENARIOS,MODELS,REGION_PACKS,CAPABILITIES,sanitizeInput,assess,composeRoutes} from "./lib/architect.js";
const __dirname=dirname(fileURLToPath(import.meta.url));
const STATIC_ROOT=join(__dirname,"public");
const PORT=Number(process.env.PORT||3000);
const MAX_BODY=32*1024;
const VERSION=process.env.RAILWAY_GIT_COMMIT_SHA||process.env.GITHUB_SHA||"local";
const limiter=new Map();
const json=(res,status,body,headers={})=>{res.writeHead(status,{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store",...headers});res.end(JSON.stringify(body))};
const error=(res,status,code,message)=>json(res,status,{error:{code,message}});
const accessHash=token=>createHash("sha256").update(String(token)).digest("hex");
function safeEqual(a,b){const x=Buffer.from(a||""),y=Buffer.from(b||"");return x.length===y.length&&timingSafeEqual(x,y)}
function rateLimit(req,limit=24,windowMs=3600000){
 const ip=(req.socket.remoteAddress||"local").slice(0,100),now=Date.now();
 let row=limiter.get(ip);if(!row||row.until<now)row={until:now+windowMs,n:0};
 row.n++;limiter.set(ip,row);if(limiter.size>3000)for(const [key,v] of limiter)if(v.until<now)limiter.delete(key);
 return row.n<=limit;
}
async function readJson(req){
 let str="",size=0;for await(const chunk of req){size+=chunk.length;if(size>MAX_BODY)throw Object.assign(new Error("Request body too large"),{status:413});str+=chunk}
 try{return str?JSON.parse(str):{}}catch{throw Object.assign(new Error("Malformed JSON"),{status:400})}
}
async function readRaw(req){const parts=[];let size=0;for await(const x of req){size+=x.length;if(size>65536)throw Object.assign(new Error("Webhook body too large"),{status:413});parts.push(x)}return Buffer.concat(parts).toString("utf8")}
function emailValid(v){return typeof v==="string"&&v.length<=254&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)}
function idem(req){return String(req.headers["idempotency-key"]||"").trim().slice(0,128)}
async function deduped(scope,key,create){
 if(key){const old=await query("SELECT response FROM onchain_os.request_dedupe WHERE scope=$1 AND key=$2",[scope,key]);if(old.rowCount)return old.rows[0].response}
 const result=await create();
 if(key)await query("INSERT INTO onchain_os.request_dedupe(scope,key,response) VALUES($1,$2,$3) ON CONFLICT DO NOTHING",[scope,key,JSON.stringify(result)]);
 return result;
}
async function audit(intentId,event,metadata={}){await query("INSERT INTO onchain_os.events(id,intent_id,event_type,metadata) VALUES($1,$2,$3,$4)",[randomUUID(),intentId,event,JSON.stringify(metadata)])}
async function getIntent(req,id){
 if(!/^[0-9a-f-]{36}$/i.test(id))throw Object.assign(new Error("Not found"),{status:404});
 const result=await query("SELECT * FROM onchain_os.intents WHERE id=$1",[id]);
 const row=result.rows[0];if(!row)throw Object.assign(new Error("Not found"),{status:404});
 const token=String(req.headers["x-project-key"]||"");
 if(!token||!safeEqual(row.access_hash,accessHash(token)))throw Object.assign(new Error("Project key required or invalid"),{status:404});
 return row;
}
async function stripeCheckout(intentId,email){
 if(!process.env.STRIPE_SECRET_KEY||!process.env.STRIPE_PRICE_DIAGNOSTIC)throw Object.assign(new Error("Online checkout is not connected yet. Use Request a Proposal to start a real engagement."),{status:503,code:"CHECKOUT_NOT_CONFIGURED"});
 const origin=(process.env.APP_ORIGIN||"").replace(/\/$/,"");
 if(!origin.startsWith("https://"))throw Object.assign(new Error("APP_ORIGIN must be a verified HTTPS URL"),{status:503});
 const body=new URLSearchParams({
 "mode":"payment","line_items[0][price]":process.env.STRIPE_PRICE_DIAGNOSTIC,"line_items[0][quantity]":"1",
 "success_url":origin+"/onchain/architect/?checkout=returned",
 "cancel_url":origin+"/onchain/architect/?checkout=cancelled",
 "client_reference_id":intentId,"metadata[intent_id]":intentId,
 "customer_email":email
 });
 const resp=await fetch("https://api.stripe.com/v1/checkout/sessions",{method:"POST",headers:{"Authorization":"Bearer "+process.env.STRIPE_SECRET_KEY,"Content-Type":"application/x-www-form-urlencoded"},body});
 const data=await resp.json();if(!resp.ok||!data.url)throw Object.assign(new Error(data.error?.message||"Payment provider unavailable"),{status:502});
 return {checkout_url:data.url,provider:"stripe",session_id:data.id,status:"CHECKOUT_CREATED_NOT_PAID"};
}
function validStripe(body,header,secret){
 const fields=Object.fromEntries(String(header||"").split(",").map(x=>x.split("=",2)).filter(x=>x.length===2));
 const ts=Number(fields.t);if(!ts||Math.abs(Date.now()/1000-ts)>300)return false;
 const signature=createHmac("sha256",secret).update(fields.t+"."+body).digest("hex");
 return safeEqual(signature,fields.v1||"");
}
async function handleApi(req,res,path){
 if(path==="/api/health"&&req.method==="GET"){const connected=await checkDatabase();return json(res,connected?200:503,{service:"noetfield-onchain-os",status:connected?"ok":"database_unavailable",version:VERSION,persistence:connected?"postgresql":"unavailable"})}
 if(path==="/api/public/config"&&req.method==="GET")return json(res,200,{scenarios:SCENARIOS,models:MODELS,regions:REGION_PACKS,capabilities:CAPABILITIES,checkout_configured:Boolean(process.env.STRIPE_SECRET_KEY&&process.env.STRIPE_PRICE_DIAGNOSTIC),persisted:hasDatabase});
 if(path==="/api/public/network"&&req.method==="GET"){
  const [intents,apps,proposals]=await Promise.all([
   query("SELECT count(*)::int AS n FROM onchain_os.intents WHERE publish_state='PUBLIC'"),
   query("SELECT count(*)::int AS n FROM onchain_os.provider_registry WHERE status='ACTIVE' OR status='VERIFIED'"),
   query("SELECT count(*)::int AS n FROM onchain_os.proposal_requests WHERE status='ACCEPTED'")
  ]);
  return json(res,200,{public_opportunities:intents.rows[0].n,verified_providers:apps.rows[0].n,accepted_matches:proposals.rows[0].n,source:"live_database",synthetic:false});
 }
 if(path==="/api/public/opportunities"&&req.method==="GET"){
  const r=await query("SELECT id,data,created_at FROM onchain_os.intents WHERE publish_state='PUBLIC' ORDER BY created_at DESC LIMIT 40");
  return json(res,200,{items:r.rows.map(x=>({id:x.id,scenario:x.data.scenario,goal:String(x.data.goal||"").slice(0,260),region:x.data.region,targets:x.data.targets,capabilities:x.data.capabilities,created_at:x.created_at})),source:"live_database"});
 }
 if(path==="/api/public/providers"&&req.method==="GET"){
  const r=await query("SELECT id,name,capabilities,regions,status FROM onchain_os.provider_registry WHERE status='ACTIVE' OR status='VERIFIED' ORDER BY created_at DESC LIMIT 40");
  return json(res,200,{items:r.rows,source:"verified_provider_registry"});
 }
 if(path==="/api/providers/apply"&&req.method==="POST"){
  if(!rateLimit(req,6))return error(res,429,"RATE_LIMIT","Too many requests");
  const b=await readJson(req);
  if(b.website_field)return json(res,202,{status:"received"}); // honeypot
  if(!emailValid(b.email)||String(b.name||"").trim().length<2)return error(res,400,"VALIDATION","A valid name and email are required");
  const id=randomUUID(),cap=Array.isArray(b.capabilities)?b.capabilities.filter(x=>Object.hasOwn(CAPABILITIES,x)).slice(0,10):[];
  const regions=Array.isArray(b.regions)?b.regions.map(x=>String(x).slice(0,2).toUpperCase()).slice(0,6):[];
  await query("INSERT INTO onchain_os.provider_applications(id,display_name,email,capabilities,regions,description,website) VALUES($1,$2,$3,$4,$5,$6,$7)",[id,String(b.name).slice(0,120),b.email,JSON.stringify(cap),JSON.stringify(regions),String(b.description||"").slice(0,1200),String(b.website||"").slice(0,300)]);
  return json(res,201,{id,status:"APPLICATION_RECEIVED_PENDING_REVIEW"});
 }
 if(path==="/api/stripe/webhook"&&req.method==="POST"){
  if(!process.env.STRIPE_WEBHOOK_SECRET)return error(res,503,"NOT_CONFIGURED","Webhook unavailable");
  const body=await readRaw(req);
  if(!validStripe(body,req.headers["stripe-signature"],process.env.STRIPE_WEBHOOK_SECRET))return error(res,400,"SIGNATURE","Signature invalid");
  const ev=JSON.parse(body),session=ev.data?.object||{},id=session.metadata?.intent_id||session.client_reference_id;
  if(ev.type==="checkout.session.completed"&&session.payment_status==="paid"&&/^[0-9a-f-]{36}$/i.test(id||"")){
   await deduped("stripe-webhook",ev.id,async()=>{await query("UPDATE onchain_os.intents SET status='PAID_DIAGNOSTIC',updated_at=now() WHERE id=$1",[id]);await audit(id,"PaymentConfirmed",{provider:"stripe",session_id:session.id,amount_total:session.amount_total,currency:session.currency});return {accepted:true}});
  }
  return json(res,200,{received:true});
 }
 if(path==="/api/architect/intents"&&req.method==="POST"){
  if(!rateLimit(req,30))return error(res,429,"RATE_LIMIT","Too many requests");
  const data=sanitizeInput(await readJson(req));const key=idem(req);
  const reply=await deduped("intent",key,async()=>{
   const id=randomUUID(),secret=randomBytes(32).toString("base64url");
   await query("INSERT INTO onchain_os.intents(id,access_hash,data) VALUES($1,$2,$3)",[id,accessHash(secret),JSON.stringify(data)]);
   await audit(id,"ArchitectIntentCreated",{scenario:data.scenario});
   return {id,project_key:secret,status:"DRAFT",version:1};
  });
  return json(res,201,reply);
 }
 const match=path.match(/^\/api\/architect\/intents\/([0-9a-f-]{36})(?:\/(assess|routes|proposal|publish|checkout))?$/i);
 if(match){
  const [_,id,action]=match,row=await getIntent(req,id);
  if(!action&&req.method==="GET")return json(res,200,{id:row.id,data:row.data,assessment:row.assessment,routes:row.routes,status:row.status,publish_state:row.publish_state,version:row.version,created_at:row.created_at});
  if(!action&&req.method==="PATCH"){
   const b=await readJson(req),next=sanitizeInput({...row.data,...b});if(Number(b.version)!==row.version)return error(res,409,"STALE_VERSION","Reload the project before saving changes");
   await query("UPDATE onchain_os.intents SET data=$2,assessment=NULL,routes=NULL,version=version+1,status='DRAFT',updated_at=now() WHERE id=$1",[id,JSON.stringify(next)]);
   await audit(id,"ArchitectIntentRevised",{version:row.version+1});
   return json(res,200,{id,version:row.version+1,status:"DRAFT"});
  }
  if(action==="assess"&&req.method==="POST"){
   const analysis=assess(row.data);
   await query("UPDATE onchain_os.intents SET assessment=$2,routes=NULL,status='OPTIONS_READY',updated_at=now() WHERE id=$1",[id,JSON.stringify(analysis)]);
   await audit(id,"ArchitectAssessmentCompleted",{engine:analysis.engine});
   return json(res,200,{assessment:analysis,status:"OPTIONS_READY"});
  }
  if(action==="routes"&&req.method==="POST"){
   const analysis=row.assessment||assess(row.data);
   const providers=(await query("SELECT id,name,capabilities,regions,status FROM onchain_os.provider_registry WHERE status IN ('ACTIVE','VERIFIED')")).rows;
   const routes=composeRoutes(row.data,analysis,providers);
   await query("UPDATE onchain_os.intents SET assessment=$2,routes=$3,status='ROUTE_OPTIONS',updated_at=now() WHERE id=$1",[id,JSON.stringify(analysis),JSON.stringify(routes)]);
   await audit(id,"RouteQuoted",{route_count:routes.length,candidate_count:providers.length});
   return json(res,200,{routes,assessment:analysis,status:"ROUTE_OPTIONS"});
  }
  if(action==="publish"&&req.method==="POST"){
   const b=await readJson(req);const next=b.public===true?"PUBLIC":"PRIVATE";
   await query("UPDATE onchain_os.intents SET publish_state=$2,updated_at=now() WHERE id=$1",[id,next]);
   await audit(id,"OpportunityVisibilityChanged",{visibility:next});return json(res,200,{status:next});
  }
  if(action==="proposal"&&req.method==="POST"){
   if(!rateLimit(req,12))return error(res,429,"RATE_LIMIT","Too many requests");
   const b=await readJson(req);if(!emailValid(b.email))return error(res,400,"VALIDATION","Valid contact email required");
   const result=await deduped("proposal:"+id,idem(req),async()=>{
    const requestId=randomUUID();await query("INSERT INTO onchain_os.proposal_requests(id,intent_id,email,company,notes,route_id) VALUES($1,$2,$3,$4,$5,$6)",[requestId,id,b.email,String(b.company||"").slice(0,160),String(b.notes||"").slice(0,2000),String(b.route_id||"").slice(0,60)]);
    await query("UPDATE onchain_os.intents SET status='PROPOSAL_REQUESTED',contact_email=$2,updated_at=now() WHERE id=$1",[id,b.email]);
    await audit(id,"ProposalRequested",{request_id:requestId});
    return {request_id:requestId,status:"PROPOSAL_REQUESTED",message:"Your project request is recorded. No payment has been charged."};
   });return json(res,201,result);
  }
  if(action==="checkout"&&req.method==="POST"){
   const b=await readJson(req);if(!emailValid(b.email))return error(res,400,"VALIDATION","Valid email required");
   const result=await stripeCheckout(id,b.email);
   await audit(id,"CheckoutInitiated",{session_id:result.session_id});
   return json(res,200,result);
  }
 }
 return error(res,404,"NOT_FOUND","API endpoint not found");
}
const contentTypes={".html":"text/html; charset=utf-8",".js":"text/javascript; charset=utf-8",".css":"text/css; charset=utf-8",".svg":"image/svg+xml",".png":"image/png",".webp":"image/webp",".json":"application/json; charset=utf-8",".ico":"image/x-icon"};
async function serveStatic(req,res,path){
 const target=(path==="/"||path==="/onchain"||path==="/onchain/"||path.startsWith("/onchain/"))?"/index.html":path;
 const full=normalize(join(STATIC_ROOT,decodeURIComponent(target)));
 if(!full.startsWith(STATIC_ROOT))return error(res,403,"FORBIDDEN","Invalid path");
 try{const st=await stat(full);if(!st.isFile())throw Error("Not file");const raw=await readFile(full);
 res.writeHead(200,{"Content-Type":contentTypes[extname(full)]||"application/octet-stream","Cache-Control":target==="/index.html"?"no-store":"public, max-age=3600","X-Content-Type-Options":"nosniff","Referrer-Policy":"strict-origin-when-cross-origin","Content-Security-Policy":"default-src 'self'; script-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self' https://checkout.stripe.com","X-Frame-Options":"DENY"});return res.end(raw)}catch{return error(res,404,"NOT_FOUND","Page not found")}
}
await init();
createServer(async(req,res)=>{
 try{
  const u=new URL(req.url||"/","http://localhost");
  const path=u.pathname;
  if(path.startsWith("/api/"))return await handleApi(req,res,path);
  if(req.method!=="GET"&&req.method!=="HEAD")return error(res,405,"METHOD_NOT_ALLOWED","Unsupported method");
  return await serveStatic(req,res,path);
 }catch(e){const status=Number(e.status)||(/^invalid|describe/i.test(e.message)?400:500);if(status===500)console.error("request failure:",e.message);return error(res,status,e.code||"REQUEST_ERROR",status===500?"Unexpected server error":e.message)}
}).listen(PORT,"0.0.0.0",()=>console.log("NOETFIELD OS listening on",PORT,"version",VERSION,"database",hasDatabase?"configured":"not configured"));
