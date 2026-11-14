import pg from "pg";
const {Pool}=pg;
export const hasDatabase=Boolean(process.env.DATABASE_URL);
export const pool=hasDatabase?new Pool({connectionString:process.env.DATABASE_URL,ssl:process.env.PGSSL==="require"?{rejectUnauthorized:false}:undefined,max:5,idleTimeoutMillis:10000}):null;
export async function init(){
 if(!pool){console.warn("DATABASE_URL absent: service runs informational site only; write endpoints return 503");return false;}
 await pool.query(`CREATE SCHEMA IF NOT EXISTS onchain_os`);
 await pool.query(`CREATE TABLE IF NOT EXISTS onchain_os.intents (
   id uuid PRIMARY KEY, access_hash text NOT NULL, data jsonb NOT NULL,
   assessment jsonb, routes jsonb, publish_state text NOT NULL DEFAULT 'PRIVATE',
   status text NOT NULL DEFAULT 'DRAFT', version integer NOT NULL DEFAULT 1,
   contact_email text, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
 )`);
 await pool.query(`CREATE TABLE IF NOT EXISTS onchain_os.provider_applications(
 id uuid PRIMARY KEY, display_name text NOT NULL, email text NOT NULL,
 capabilities jsonb NOT NULL DEFAULT '[]', regions jsonb NOT NULL DEFAULT '[]',
 description text NOT NULL DEFAULT '', website text, status text NOT NULL DEFAULT 'PENDING',
 created_at timestamptz NOT NULL DEFAULT now()
 )`);
 await pool.query(`CREATE TABLE IF NOT EXISTS onchain_os.provider_registry(
 id uuid PRIMARY KEY, name text NOT NULL, capabilities jsonb NOT NULL DEFAULT '[]',
 regions jsonb NOT NULL DEFAULT '[]', status text NOT NULL DEFAULT 'PENDING',
 evidence_ref text, created_at timestamptz NOT NULL DEFAULT now()
 )`);
 await pool.query(`CREATE TABLE IF NOT EXISTS onchain_os.proposal_requests(
 id uuid PRIMARY KEY, intent_id uuid NOT NULL REFERENCES onchain_os.intents(id),
 email text NOT NULL, company text, notes text, route_id text,
 status text NOT NULL DEFAULT 'NEW', created_at timestamptz NOT NULL DEFAULT now()
 )`);
 await pool.query(`CREATE TABLE IF NOT EXISTS onchain_os.events(
 id uuid PRIMARY KEY, intent_id uuid REFERENCES onchain_os.intents(id),
 event_type text NOT NULL, metadata jsonb NOT NULL DEFAULT '{}',
 created_at timestamptz NOT NULL DEFAULT now()
 )`);
 await pool.query(`CREATE TABLE IF NOT EXISTS onchain_os.request_dedupe(
 scope text NOT NULL, key text NOT NULL, response jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(scope,key)
 )`);
 await pool.query(`CREATE INDEX IF NOT EXISTS os_intents_status ON onchain_os.intents(status,created_at DESC)`);
 await pool.query(`CREATE INDEX IF NOT EXISTS os_proposals_intent ON onchain_os.proposal_requests(intent_id)`);
 return true;
}
export async function query(sql,params=[]){
 if(!pool)throw Object.assign(new Error("Persistent database is not connected"),{status:503,code:"DATABASE_NOT_READY"});
 return pool.query(sql,params);
}
export async function checkDatabase(){if(!pool)return false;try{await pool.query("SELECT 1");return true}catch{return false}}
