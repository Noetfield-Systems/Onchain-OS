/* NOETFIELD OS — live interactive client. No generated/fake provider inventory or local-only financial ledger. */
const $=sel=>document.querySelector(sel);
const $$=sel=>Array.from(document.querySelectorAll(sel));
const scenarioDefs=[
 {id:"business",name:"Modernize my business",intro:"Integrate AI, stablecoin payments and automation",icon:"▧"},
 {id:"startup",name:"Launch my startup",intro:"Compare conventional, hybrid and Web3 routes",icon:"✧"},
 {id:"international",name:"Expand internationally",intro:"Find jurisdictions and specialist teams",icon:"◎"},
 {id:"crypto",name:"Use my crypto capital",intro:"Connect digital assets to business execution",icon:"◇"},
 {id:"asset",name:"Structure my asset",intro:"Plan asset rights and tokenization readiness",icon:"⬡"},
 {id:"agents",name:"Build an agent company",intro:"Compose governed AI and human operations",icon:"⌘"}
];
const state={route:"/",step:0,scenario:"business",saved:null,analysis:null,routes:null,selectedRoute:null,busy:false};
const escapeHtml=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const uid=()=>globalThis.crypto?.randomUUID?.()||Date.now()+"-"+Math.random().toString(36).slice(2);
function toast(message){const el=$("#toast");el.textContent=message;el.hidden=false;clearTimeout(toast.timer);toast.timer=setTimeout(()=>el.hidden=true,5000)}
function notice(message,type="error"){const el=type==="success"?$("#wizardSuccess"):$("#wizardError");const other=type==="success"?$("#wizardError"):$("#wizardSuccess");other.hidden=true;el.textContent=message;el.hidden=false;el.scrollIntoView({block:"nearest",behavior:"smooth"})}
function clearNotice(){$("#wizardSuccess").hidden=true;$("#wizardError").hidden=true}
async function api(path,options={}){
 const r=await fetch(path,{...options,headers:{"Accept":"application/json",...(options.body?{"Content-Type":"application/json"}:{}),...(options.headers||{})}});
 const data=await r.json().catch(()=>({error:{message:"Unexpected response"}}));
 if(!r.ok)throw new Error(data.error?.message||"Request failed: "+r.status);
 return data;
}
function privateHeaders(){return state.saved?{"X-Project-Key":state.saved.project_key}:{}}
function setBusy(flag){state.busy=flag;$$(".wizard-screen button").forEach(el=>el.disabled=flag)}
function routeTo(route,replace=false){
 const path=route.replace(/^\/onchain/,"").replace(/^\/?/,"/");
 const normalized=path==="/"?"/":path.endsWith("/")?path:path+"/";
 state.route=["/","/architect/","/network/","/economy/","/proof/"].includes(normalized)?normalized:"/";
 $$(".view").forEach(el=>el.hidden=el.dataset.view!==state.route);
 $$(".desktop-nav a").forEach(a=>a.classList.toggle("nav-active",a.dataset.route===state.route));
 $("#mobileNav").hidden=true;$("#menuToggle").setAttribute("aria-expanded","false");
 if(replace)history.replaceState({}, "", "/onchain"+(state.route==="/"?"/":state.route));
 else history.pushState({}, "", "/onchain"+(state.route==="/"?"/":state.route));
 document.title=state.route==="/architect/"?"Business-to-Onchain Architect | NOETFIELD OS":state.route==="/network/"?"Economic Network | NOETFIELD OS":state.route==="/economy/"?"Economic Engine | NOETFIELD OS":state.route==="/proof/"?"Working Proof | NOETFIELD OS":"NOETFIELD OS — The Real-to-Onchain Economic Operating System";
 window.scrollTo({top:0,behavior:"instant"});
 if(state.route==="/network/")refreshNetwork();
 if(state.route==="/architect/")showStep(state.step);
}
function initNavigation(){
 document.addEventListener("click",event=>{
   const a=event.target.closest("a[data-route]");if(!a||event.defaultPrevented||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
   event.preventDefault();routeTo(a.dataset.route);
 });
 window.addEventListener("popstate",()=>routeTo(location.pathname.replace(/^\/onchain/,"")||"/",true));
 $("#menuToggle").addEventListener("click",()=>{const nav=$("#mobileNav");nav.hidden=!nav.hidden;$("#menuToggle").setAttribute("aria-expanded",String(!nav.hidden))});
 $("#year").textContent=new Date().getFullYear();
}
function setScenario(id){
 state.scenario=id;$$(".choice-card").forEach(btn=>btn.setAttribute("aria-pressed",String(btn.dataset.scenario===id)));
 $("#goalInput").placeholder={
 business:"Example: My Canadian company wants to accept USDC and automate operations with AI agents.",
 startup:"Example: I'm building a global AI startup and want to compare a corporation with an onchain-native model.",
 international:"Example: We operate in Canada and want customers and partners in Switzerland and the UAE.",
 crypto:"Example: I hold USDC and want to finance legitimate software development and business expansion.",
 asset:"Example: Our business owns income-producing assets and wants to explore rights-backed digital operations.",
 agents:"Example: I want a company with AI agents and human partners executing customer projects."
 }[id]||"Describe your outcome.";
}
function renderChoices(){
 $("#homeScenarioGrid").innerHTML=scenarioDefs.map(x=>`<button type="button" class="scenario-tile" data-entry="${x.id}"><span class="tile-icon">${x.icon}</span><strong>${escapeHtml(x.name)}</strong><small>${escapeHtml(x.intro)}</small></button>`).join("");
 $("#scenarioChoices").innerHTML=scenarioDefs.map(x=>`<button type="button" class="choice-card" data-scenario="${x.id}" aria-pressed="${x.id===state.scenario}"><span>${x.icon}</span><strong>${escapeHtml(x.name)}</strong><small>${escapeHtml(x.intro)}</small></button>`).join("");
 $$("[data-entry]").forEach(btn=>btn.addEventListener("click",()=>{setScenario(btn.dataset.entry);state.step=0;routeTo("/architect/")}));
 $$("[data-scenario]").forEach(btn=>btn.addEventListener("click",()=>setScenario(btn.dataset.scenario)));
 setScenario(state.scenario);
}
function showStep(step){
 state.step=Math.max(0,Math.min(3,step));clearNotice();
 $$(".wizard-screen").forEach(el=>el.hidden!==undefined&&(el.hidden=Number(el.dataset.step)!==state.step));
 $$("[data-wstep]").forEach(btn=>{const i=Number(btn.dataset.wstep);btn.classList.toggle("active",i===state.step);btn.setAttribute("aria-current",i===state.step?"step":"false")});
 $("#architectStatus").textContent=state.saved?"PROJECT SAVED · PRIVATE ACCESS":"GUEST MODE · NO WALLET NEEDED";
 if(state.saved){$("#projectIdentity").hidden=false;$("#projectId").textContent=state.saved.id.slice(0,18)+"…";}
}
function getDraft(){
 return {scenario:state.scenario,goal:$("#goalInput").value.trim(),region:$("#regionInput").value,stage:$("#stageInput").value,budget:$("#budgetInput").value,funding:$("#fundingInput").value,
 targets:$$('#targetChoices input:checked').map(x=>x.value),capabilities:$$('#capabilityChoices input:checked').map(x=>x.value),preference:$('#preferenceChoices input:checked')?.value||"unsure"};
}
function restoreDraft(d){
 if(!d)return;
 state.scenario=d.scenario||"business";setScenario(state.scenario);
 $("#goalInput").value=d.goal||"";
 for(const [field,sel] of [["region","regionInput"],["stage","stageInput"],["budget","budgetInput"],["funding","fundingInput"]])if(d[field]&&$("#"+sel))$("#"+sel).value=d[field];
 $$("#targetChoices input").forEach(x=>x.checked=(d.targets||[]).includes(x.value));
 $$("#capabilityChoices input").forEach(x=>x.checked=(d.capabilities||[]).includes(x.value));
 const selected=$('#preferenceChoices input[value="'+(d.preference||"unsure")+'"]');if(selected)selected.checked=true;
}
async function saveAssess(){
 const input=getDraft();
 if(input.goal.length<12)throw new Error("Describe the desired outcome in at least 12 characters.");
 if(!input.targets.length)input.targets=[input.region];
 if(!state.saved){
  const saved=await api("/api/architect/intents",{method:"POST",headers:{"Idempotency-Key":uid()},body:JSON.stringify(input)});
  state.saved={id:saved.id,project_key:saved.project_key,version:saved.version};
  localStorage.setItem("nf:architect:current",JSON.stringify(state.saved));
 }else{
  const updated=await api("/api/architect/intents/"+state.saved.id,{method:"PATCH",headers:privateHeaders(),body:JSON.stringify({...input,version:state.saved.version})});
  state.saved.version=updated.version;localStorage.setItem("nf:architect:current",JSON.stringify(state.saved));
 }
 const r=await api("/api/architect/intents/"+state.saved.id+"/assess",{method:"POST",headers:privateHeaders(),body:"{}"});
 state.analysis=r.assessment;state.routes=null;renderModelResults();showStep(2);
}
function renderModelResults(){
 const a=state.analysis;if(!a)return;
 $("#modelResults").innerHTML=a.models.map((m,i)=>`<article class="model-card ${i===0?"best":""}"><span class="best-tag">${i===0?"HIGHEST SCENARIO FIT":"OPERATING MODEL"}</span><h4>${escapeHtml(m.title)}</h4><div class="model-score">${Number(m.score)}<small style="font-size:12px;color:#bbdec7">/100</small></div><span>${escapeHtml(m.fit)} · ${escapeHtml(m.complexity)} complexity</span><p>${escapeHtml(m.description)} ${escapeHtml(m.reason)}</p><ul>${m.steps.map(x=>`<li>${escapeHtml(x)}</li>`).join("")}</ul><small>${escapeHtml(m.estimate)}</small></article>`).join("");
 $("#jurisdictionResults").innerHTML=a.jurisdictions.map(j=>`<article class="region-card"><b>${escapeHtml(j.label)}</b><span>${escapeHtml(j.status.replaceAll("_"," "))}</span><p>${escapeHtml(j.description)}</p>${j.source?`<a href="${escapeHtml(j.source)}" target="_blank" rel="noopener noreferrer">Official source ↗</a>`:"<small>Provider research needed</small>"}</article>`).join("");
 $("#unknownResults").innerHTML=a.unknowns.length?`<strong>Items to verify before execution</strong><ul>${a.unknowns.map(x=>`<li>${escapeHtml(x)}</li>`).join("")}</ul>`:"";
}
function renderRoutes(){
 $("#routeResults").innerHTML=(state.routes||[]).map((r,i)=>`<article class="route-card"><div class="route-card-head"><div><span class="kicker">ROUTE ${String(i+1).padStart(2,"0")} / ${escapeHtml(r.route_status)}</span><h4>${escapeHtml(r.title)}</h4></div><small>${r.coverage}/${r.total_needs} SOURCED</small></div><p>${escapeHtml(r.description)} ${escapeHtml(r.financial_terms)}</p><div class="route-node-list">${r.nodes.map(n=>`<div class="route-node"><span>${escapeHtml(n.provider_name||"OPEN")}</span><b>${escapeHtml(n.title)}</b></div>`).join("")}</div></article>`).join("");
}
async function recover(){
 const saved=JSON.parse(localStorage.getItem("nf:architect:current")||"null");
 if(!saved?.id||!saved?.project_key)return;
 try{state.saved=saved;const res=await api("/api/architect/intents/"+saved.id,{headers:privateHeaders()});state.saved.version=res.version;restoreDraft(res.data);state.analysis=res.assessment;state.routes=res.routes;if(res.assessment)renderModelResults();if(res.routes)renderRoutes();showStep(res.routes?3:res.assessment?2:1);}catch{localStorage.removeItem("nf:architect:current");state.saved=null;showStep(0)}
}
function attachArchitect(){
 $("#intentForm").addEventListener("submit",e=>{e.preventDefault();if($("#goalInput").value.trim().length<12){notice("Please describe your goal in at least 12 characters.");return}showStep(1)});
 $("#contextForm").addEventListener("submit",async e=>{e.preventDefault();if(state.busy)return;setBusy(true);try{await saveAssess()}catch(err){notice(err.message)}finally{setBusy(false)}});
 $$("[data-prev]").forEach(btn=>btn.addEventListener("click",()=>showStep(state.step-1)));
 $$("[data-wstep]").forEach(btn=>btn.addEventListener("click",()=>{const next=Number(btn.dataset.wstep);if(next<=state.step || (next===2&&state.analysis)||(next===3&&state.routes))showStep(next)}));
 $("#routeButton").addEventListener("click",async()=>{if(!state.saved)return;setBusy(true);try{const r=await api("/api/architect/intents/"+state.saved.id+"/routes",{method:"POST",headers:privateHeaders(),body:"{}"});state.routes=r.routes;renderRoutes();showStep(3)}catch(e){notice(e.message)}finally{setBusy(false)}});
 $("#proposalForm").addEventListener("submit",async e=>{e.preventDefault();if(!state.saved)return;setBusy(true);try{const b={email:$("#proposalEmail").value.trim(),company:$("#proposalCompany").value.trim(),notes:$("#proposalNotes").value.trim(),route_id:state.routes?.[0]?.id||""};const r=await api("/api/architect/intents/"+state.saved.id+"/proposal",{method:"POST",headers:{...privateHeaders(),"Idempotency-Key":uid()},body:JSON.stringify(b)});notice("Project request recorded: "+r.request_id.slice(0,8)+". No payment has been charged.","success")}catch(err){notice(err.message)}finally{setBusy(false)}});
 $("#publishOpportunity").addEventListener("click",async()=>{if(!state.saved)return;const yes=confirm("Publish the goal and selected project metadata publicly? Do not include private or confidential business information.");if(!yes)return;setBusy(true);try{await api("/api/architect/intents/"+state.saved.id+"/publish",{method:"POST",headers:privateHeaders(),body:JSON.stringify({public:true})});notice("Public opportunity published. It is now discoverable in the network.","success")}catch(err){notice(err.message)}finally{setBusy(false)}});
 $("#checkoutButton").addEventListener("click",async()=>{if(!state.saved){toast("Save a project first");return}const email=$("#proposalEmail").value.trim();if(!email){notice("Enter your email in the proposal form before launching checkout");return}setBusy(true);try{const res=await api("/api/architect/intents/"+state.saved.id+"/checkout",{method:"POST",headers:privateHeaders(),body:JSON.stringify({email})});if(res.checkout_url&&res.checkout_url.startsWith("https://checkout.stripe.com/"))location.assign(res.checkout_url)}catch(e){notice(e.message)}finally{setBusy(false)}});
 $("#copyPlan").addEventListener("click",async()=>{if(!state.analysis)return;const input=getDraft();const txt=["NOETFIELD OS — Business-to-Onchain Plan","Goal: "+input.goal,"Suggested model: "+state.analysis.models[0].title,"Jurisdictions: "+state.analysis.jurisdictions.map(j=>j.label).join(", "),"Capabilities: "+state.analysis.capabilities.map(n=>n.title).join(", "),"Providers: sourcing required; not a binding quote"].join("\n");try{await navigator.clipboard.writeText(txt);toast("Summary copied")}catch{toast("Clipboard unavailable — use browser copy")}});
 $("#resetProject").addEventListener("click",()=>{if(!confirm("Start a new project? Your current project remains in the database; this browser will release its private access key."))return;state.saved=null;state.analysis=null;state.routes=null;localStorage.removeItem("nf:architect:current");$("#goalInput").value="";$("#projectIdentity").hidden=true;showStep(0)});
 const query=new URLSearchParams(location.search);if(query.get("checkout")==="returned")toast("Payment provider returned. Payment status is verified separately; no payment is assumed.");
}
async function refreshNetwork(){
 $("#opportunityList").innerHTML='<div class="listing-empty"><h3>Loading live opportunities…</h3></div>';
 try{
  const [stats,opportunities,providers]=await Promise.all([api("/api/public/network"),api("/api/public/opportunities"),api("/api/public/providers")]);
  $$("#networkMetrics b").forEach((el,i)=>el.textContent=[stats.public_opportunities,stats.verified_providers,stats.accepted_matches][i]);
  $("#opportunityList").innerHTML=opportunities.items.length?opportunities.items.map(x=>`<article class="listing-card"><span>${escapeHtml(x.scenario.toUpperCase())} · ${escapeHtml(x.region)}</span><h3>${escapeHtml(x.goal)}</h3><p>Markets: ${escapeHtml(x.targets.join(", "))} · Public opportunity</p></article>`).join(""):'<div class="listing-empty"><span class="kicker">EARLY NETWORK</span><h3>No public projects have been submitted yet.</h3><p>Publish the first real opportunity and invite qualified specialists to respond.</p><a class="button button-primary" href="/onchain/architect/" data-route="/architect/">Publish a project ↗</a></div>';
  $("#providerList").innerHTML=providers.items.length?providers.items.map(x=>`<article class="listing-card"><span>VERIFIED PROVIDER</span><h3>${escapeHtml(x.name)}</h3><p>${escapeHtml((x.capabilities||[]).join(" · "))}</p></article>`).join(""):'<div class="listing-empty"><span class="kicker">SUPPLY NETWORK</span><h3>Provider onboarding is open.</h3><p>Verified listings appear here after real evidence review. There are no fictional partners or placeholder team members.</p><a class="button button-outline" href="#providerForm">Apply as a provider ↗</a></div>';
 }catch(e){
  $("#opportunityList").innerHTML='<div class="listing-empty"><h3>Live network data is currently unavailable.</h3><p>'+escapeHtml(e.message)+'</p></div>';
  $("#providerList").innerHTML='<div class="listing-empty"><h3>Provider registry is unavailable.</h3><p>No verified provider inventory is being claimed.</p></div>';
 }
}
function initProviderForm(){
 $("#providerForm").addEventListener("submit",async e=>{e.preventDefault();const form=e.currentTarget;const data=new FormData(form),button=form.querySelector("button[type=submit]");button.disabled=true;const notice=$("#providerFormNotice");
 try{const b={name:String(data.get("name")||""),email:String(data.get("email")||""),capabilities:[String(data.get("capability")||"APP_ENGINEER")],regions:["CA"],description:String(data.get("description")||""),website_field:String(data.get("website_field")||"")};
  const r=await api("/api/providers/apply",{method:"POST",body:JSON.stringify(b)});notice.textContent="Application received ("+r.id.slice(0,8)+"). This is not yet a verified partner listing.";form.reset()
 }catch(e){notice.textContent=e.message}finally{button.disabled=false}});
}
initNavigation();renderChoices();attachArchitect();initProviderForm();recover();
// Preserve existing public CTA deep links from the original Noetfield site.
const oldEntry = new URLSearchParams(location.search);
const solution = String(oldEntry.get("solution")||"").toLowerCase();
const legacyScenario = ({rwa:"asset",privatecredit:"asset",policy:"business",stablecoin:"crypto",agents:"agents"})[solution];
const legacyHash = location.hash.toLowerCase();
if(legacyScenario)setScenario(legacyScenario);
const initialRoute = location.pathname.replace(/^\/onchain/,"")||"/";
const legacyTarget=initialRoute==="/" ? (
 (legacyScenario||legacyHash==="#project"||legacyHash==="#launch")?"/architect/":
 ["#token","#token-design","#stablecoin"].includes(legacyHash)?"/economy/":
 ["#evidence","#proof","#demos"].includes(legacyHash)?"/proof/":
 ["#community","#ecosystem-vision","#network"].includes(legacyHash)?"/network/":"/"
) :initialRoute;
routeTo(legacyTarget,true);
