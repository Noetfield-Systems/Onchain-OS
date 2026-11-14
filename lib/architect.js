// NOETFIELD OS — deterministic Business-to-Onchain Architect core.
// Explanatory options are scenarios, not tax, legal, investment or third-party service quotes.
export const SCENARIOS = Object.freeze([
  {id:"business",name:"Modernize my business",summary:"Bring AI, payment rails and programmable operations into an existing company",icon:"building"},
  {id:"startup",name:"Launch my startup",summary:"Compare traditional, hybrid and onchain-native venture routes",icon:"rocket"},
  {id:"international",name:"Expand internationally",summary:"Route a company across markets and select local specialists",icon:"globe"},
  {id:"crypto",name:"Use my crypto capital",summary:"Turn digital purchasing power into business services and projects",icon:"wallet"},
  {id:"asset",name:"Structure my asset",summary:"Explore rights mapping, asset readiness and tokenization options",icon:"layers"},
  {id:"agents",name:"Build an agent company",summary:"Deploy bounded AI operators and source specialized builders",icon:"bot"}
]);
export const REGION_PACKS=Object.freeze({
CA:{label:"Canada",description:"Use an existing Canadian corporation or compare federal/provincial company and professional-service routes.",source:"https://ised-isde.canada.ca/site/corporations-canada/en/business-corporations/how-incorporate-business",state:"RESEARCH_REFERENCE"},
CH:{label:"Switzerland",description:"Compare Swiss corporate structure and independent asset, fintech or institutional service partners.",source:"https://www.kmu.admin.ch/kmu/en/home/concrete-know-how/setting-up-sme/starting-business.html",state:"RESEARCH_REFERENCE"},
AE:{label:"United Arab Emirates",description:"Compare mainland and free-zone business setup and activity-specific service routes.",source:"https://u.ae/en/information-and-services/business/starting-a-business",state:"RESEARCH_REFERENCE"}
});
export const MODELS=Object.freeze([
{id:"conventional",title:"Conventional",description:"A company-first model using standard contracts, banks and software services.",icon:"landmark"},
{id:"hybrid",title:"Hybrid",description:"Keep a real business entity while adding onchain payments, digital rights or governed AI.",icon:"git-merge"},
{id:"onchain",title:"Onchain-native",description:"Use wallets, smart contracts and protocol-facing operations as the main product surface.",icon:"orbit"}
]);
const CAPABILITY_NAMES={
BUSINESS_ARCHITECT:"Business architect",CORPORATE_SPECIALIST:"Corporate structuring",WEB3_ENGINEER:"Web3 engineering",
APP_ENGINEER:"Product engineering",AI_AGENT_ENGINEER:"Agent infrastructure",PAYMENT_PROVIDER:"Payment / fiat / stablecoin provider",
ASSET_SPECIALIST:"Asset rights & servicing",ISSUER_SERVICE:"Issuer / tokenization services",AUDITOR:"Independent verification",
GROWTH:"Market growth & distribution",BRIDGE_PROVIDER:"Cross-chain infrastructure"
};
export const CAPABILITIES=Object.freeze(CAPABILITY_NAMES);
const scenarioNeeds={
business:["BUSINESS_ARCHITECT","APP_ENGINEER","AI_AGENT_ENGINEER","AUDITOR"],
startup:["BUSINESS_ARCHITECT","CORPORATE_SPECIALIST","APP_ENGINEER","GROWTH"],
international:["BUSINESS_ARCHITECT","CORPORATE_SPECIALIST","PAYMENT_PROVIDER","APP_ENGINEER"],
crypto:["PAYMENT_PROVIDER","BUSINESS_ARCHITECT","APP_ENGINEER","AUDITOR"],
asset:["ASSET_SPECIALIST","CORPORATE_SPECIALIST","ISSUER_SERVICE","AUDITOR"],
agents:["AI_AGENT_ENGINEER","APP_ENGINEER","AUDITOR","GROWTH"]
};
const extendedNeeds={
AI:["AI_AGENT_ENGINEER"],PAYMENTS:["PAYMENT_PROVIDER"],SMART_CONTRACT:["WEB3_ENGINEER"],
RWA:["ASSET_SPECIALIST","ISSUER_SERVICE"],CROSS_CHAIN:["BRIDGE_PROVIDER"],GROWTH:["GROWTH"]
};
function clamp(n){return Math.max(0,Math.min(100,Number(n)||0))}
export function sanitizeInput(input={}){
  if(!input||typeof input!=="object"||Array.isArray(input))throw new Error("Input must be an object");
  const scenario=SCENARIOS.some(s=>s.id===input.scenario)?input.scenario:"startup";
  const goal=String(input.goal||"").trim().slice(0,1500);
  if(goal.length<12)throw new Error("Describe your business goal in at least 12 characters");
  const region=String(input.region||"CA").toUpperCase();
  const targets=Array.isArray(input.targets)?[...new Set(input.targets.map(v=>String(v).toUpperCase()).filter(v=>/^[A-Z]{2}$/.test(v)))].slice(0,6):[region];
  const capabilities=Array.isArray(input.capabilities)?[...new Set(input.capabilities.filter(v=>Object.hasOwn(extendedNeeds,String(v))))].slice(0,8):[];
  const budget=String(input.budget||"unsure").slice(0,40);
  const funding=String(input.funding||"fiat").slice(0,40);
  const preference=["unsure","conventional","hybrid","onchain"].includes(input.preference)?input.preference:"unsure";
  return {scenario,goal,region: /^[A-Z]{2}$/.test(region)?region:"CA",targets:targets.length?targets:["CA"],capabilities,budget,funding,preference,stage:String(input.stage||"idea").slice(0,35),created_from:"ARCHITECT_V1"};
}
export function requiredCapabilities(d){
  const c=new Set(scenarioNeeds[d.scenario]||scenarioNeeds.startup);
  for(const feature of d.capabilities||[])for(const cap of extendedNeeds[feature]||[])c.add(cap);
  if(d.funding==="crypto"||d.funding==="usdc")c.add("PAYMENT_PROVIDER");
  if(d.targets.length>1)c.add("CORPORATE_SPECIALIST");
  return [...c].map(key=>({key,title:CAPABILITIES[key],status:"NEEDS_MATCH"}));
}
export function assess(d){
  const cap=requiredCapabilities(d);
  const hasCrypto=d.funding==="crypto"||d.funding==="usdc";
  const web3=d.capabilities.includes("SMART_CONTRACT")||d.capabilities.includes("RWA")||d.scenario==="asset"||d.scenario==="crypto";
  const wantsAI=d.capabilities.includes("AI")||d.scenario==="agents";
  const cross=d.targets.length>1||d.scenario==="international";
  const options=MODELS.map(m=>{
    const fit={
      conventional:{business:90,startup:78,international:85,crypto:54,asset:66,agents:65},
      hybrid:{business:92,startup:90,international:92,crypto:90,asset:88,agents:95},
      onchain:{business:65,startup:76,international:69,crypto:90,asset:82,agents:82}
    }[m.id][d.scenario]||65;
    const score=clamp(fit+(web3?(m.id==="conventional"?-12:m.id==="onchain"?9:4):0)+(wantsAI?(m.id==="hybrid"?4:0):0)+(cross&&m.id==="onchain"?-5:0)+(d.preference===m.id?6:0));
    const steps=m.id==="conventional"?["Confirm current company and contracting party","Scope software and service workflow","Select specialists and payment method","Deliver and verify"]:m.id==="hybrid"?["Map existing rights and entity","Choose AI, Web3 and payment integrations","Match technical and specialist providers","Execute controlled pilot and reconcile"]:["Define onchain product and contract model","Assess network, wallets and assets","Source engineering, security and settlement providers","Test, verify and activate supported workflows"];
    const complexity=m.id==="conventional"?"Lower":m.id==="hybrid"?"Moderate":"Higher";
    return {...m,score,fit:score>=82?"Strong fit":score>=68?"Possible fit":"Conditional fit",complexity,steps,reason:m.id==="hybrid"?"Combines the operating flexibility of a real business with selected programmable capabilities.":m.id==="conventional"?"Minimizes unnecessary token and protocol dependencies while allowing future upgrades.":"Appropriate where wallet, protocol or contract-native participation is central to the actual product.",estimate:"Project-specific quote required",evidence:"SCENARIO_ASSESSMENT_NOT_LEGAL_ADVICE",status:"DESIGN_OPTION"};
  }).sort((a,b)=>b.score-a.score);
  const unknowns=[];
  if(d.targets.some(r=>!REGION_PACKS[r]))unknowns.push("Target-market specialist research is required");
  if(d.budget==="unsure")unknowns.push("Implementation budget remains unconfirmed");
  if(hasCrypto)unknowns.push("Payment provider support, network, asset and settlement route require quotation");
  if(d.scenario==="asset")unknowns.push("Ownership evidence and asset rights must be supplied to structure issuance");
  const jurisdiction=d.targets.map(code=>({code,label:REGION_PACKS[code]?.label||code,source:REGION_PACKS[code]?.source||null,description:REGION_PACKS[code]?.description||"Market-specific partner and source review required",status:REGION_PACKS[code]?"REFERENCE_ONLY":"SOURCE_NEEDED"}));
  return {engine:"architect-v1-deterministic",scenario:d.scenario,models:options,capabilities:cap,jurisdictions:jurisdiction,unknowns,disclaimer:"Illustrative route comparison; actual entity, issuer, tax, capital, banking and regulated service obligations are scoped to each provider and transaction."};
}
export function composeRoutes(input,analysis,providers=[]){
  const p=providers.filter(x=>x.status==="VERIFIED"||x.status==="ACTIVE");
  const patterns=[
    {id:"integrated",title:"Single lead operator",description:"One accountable lead coordinates all specialist delivery.",factor:1},
    {id:"specialists",title:"Specialist consortium",description:"Independent experts deliver a combined verified route.",factor:0.97},
    {id:"rapid",title:"Fast launch pilot",description:"Reuse existing company, integrations and available technical operators.",factor:1.03}
  ];
  return patterns.map((pattern,i)=>{
    const chain=analysis.capabilities.map((need,index)=>{
      const eligible=p.filter(x=>Array.isArray(x.capabilities)&&x.capabilities.includes(need.key)&&(!x.regions?.length||x.regions.includes(input.region)||input.targets.some(t=>x.regions.includes(t))));
      const selected=eligible[(i+index)%Math.max(eligible.length,1)];
      return {id:"n"+(index+1),capability:need.key,title:need.title,provider_id:selected?.id||null,provider_name:selected?.name||null,status:selected?"CANDIDATE_UNCONFIRMED":"UNSOURCED",depends_on:index?["n"+index]:[],acceptance:"Provider deliverable and independent milestone verification"};
    });
    const coverage=chain.filter(x=>x.provider_id).length;
    return {...pattern,route_status:coverage===chain.length?"CANDIDATE_CHAIN":"OPEN_PROVIDER_NEEDS",coverage,total_needs:chain.length,score:Math.round((coverage/Math.max(1,chain.length))*72+pattern.factor*18),nodes:chain,financial_terms:"No binding quotation until actual providers submit and a user accepts terms",estimated_fees:null};
  });
}
