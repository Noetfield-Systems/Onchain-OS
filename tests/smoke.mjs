import assert from "node:assert/strict";
const base=process.env.SMOKE_BASE||"http://localhost:3000";
async function req(path,{method="GET",data,token,headers={}}={}){
 const r=await fetch(base+path,{method,headers:{"Accept":"application/json",...(data?{"Content-Type":"application/json"}:{}),...(token?{"X-Project-Key":token}:{}),...headers},body:data?JSON.stringify(data):undefined});
 const body=await r.json().catch(()=>({}));
 return {status:r.status,body};
}
const health=await req("/api/health");assert.equal(health.status,200);assert.equal(health.body.persistence,"postgresql");
const config=await req("/api/public/config");assert.equal(config.body.scenarios.length,6);
const index=await fetch(base+"/onchain/architect/");assert.equal(index.status,200);
assert.match(await index.text(),/Business-to-Onchain Architect/);
const body={scenario:"business",goal:"Our existing Canadian B2B firm wants USDC payment and automated finance operations.",region:"CA",targets:["CA","AE"],capabilities:["PAYMENTS","AI"],budget:"5k-25k",funding:"usdc"};
const created=await req("/api/architect/intents",{method:"POST",data:body,headers:{"Idempotency-Key":"integration-case-"+Date.now()}});
assert.equal(created.status,201);const id=created.body.id,token=created.body.project_key;assert.ok(token.length>=32);
const denied=await req("/api/architect/intents/"+id);assert.equal(denied.status,404);
const read=await req("/api/architect/intents/"+id,{token});assert.equal(read.status,200);assert.equal(read.body.data.region,"CA");
const assess=await req("/api/architect/intents/"+id+"/assess",{method:"POST",token,data:{}});assert.equal(assess.status,200);assert.equal(assess.body.assessment.models.length,3);
const routes=await req("/api/architect/intents/"+id+"/routes",{method:"POST",token,data:{}});assert.equal(routes.status,200);assert.equal(routes.body.routes.length,3);
assert.equal(routes.body.routes[0].route_status,"OPEN_PROVIDER_NEEDS");
const request=await req("/api/architect/intents/"+id+"/proposal",{method:"POST",token,data:{email:"test@example.org",company:"Integration Test Fixture"},headers:{"Idempotency-Key":"request-"+id}});
assert.equal(request.status,201);assert.equal(request.body.status,"PROPOSAL_REQUESTED");
const publish=await req("/api/architect/intents/"+id+"/publish",{method:"POST",token,data:{public:true}});assert.equal(publish.status,200);
const opportunities=await req("/api/public/opportunities");assert.ok(opportunities.body.items.some(x=>x.id===id));
const app=await req("/api/providers/apply",{method:"POST",data:{name:"Smoke Tester",email:"test@example.org",capabilities:["APP_ENGINEER"],regions:["CA"],description:"Test fixture"}});assert.equal(app.status,201);assert.equal(app.body.status,"APPLICATION_RECEIVED_PENDING_REVIEW");
const activeProviders=await req("/api/public/providers");assert.ok(Array.isArray(activeProviders.body.items));assert.ok(!activeProviders.body.items.some(x=>x.name==="Smoke Tester"));
const patch=await req("/api/architect/intents/"+id,{method:"PATCH",token,data:{goal:"Updated goal to launch a Canadian company with AI and USDC invoices.",version:1}});assert.equal(patch.status,200);assert.equal(patch.body.version,2);
const oldPatch=await req("/api/architect/intents/"+id,{method:"PATCH",token,data:{goal:"Outdated attempt should not be accepted",version:1}});assert.equal(oldPatch.status,409);
const checkout=await req("/api/architect/intents/"+id+"/checkout",{method:"POST",token,data:{email:"test@example.org"}});if(!process.env.STRIPE_SECRET_KEY)assert.equal(checkout.status,503);
console.log("PASS 17 API E2E assertions: healthy persistent service, intake, access, models, routes, proposals, public discovery, provider review, versioning, checkout boundary");
