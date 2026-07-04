import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const port=4188;const base=`http://127.0.0.1:${port}`;const dbPath=path.join(os.tmpdir(),`szakilead-http-${Date.now()}.db`)
const server=spawn(process.execPath,['server/index.js'],{cwd:path.resolve(import.meta.dirname,'..'),env:{...process.env,PORT:String(port),HOST:'127.0.0.1',DB_PATH:dbPath,PUBLIC_APP_URL:base,ADMIN_EMAIL:'admin@test.hu',ADMIN_PASSWORD:'Erős-HTTP-Teszt-2026!',VAPID_KEY_SEED:'http-test-vapid',SEED_DEMO:'false',NODE_ENV:'test'},stdio:['ignore','ignore','pipe']})
let serverError='';server.stderr.on('data',chunk=>{serverError+=chunk})
const request=async(url,options={})=>{const response=await fetch(`${base}${url}`,options);const data=response.status===204?{}:await response.json().catch(()=>({}));if(!response.ok)throw new Error(`${response.status} ${data.error||url}`);return{response,data}}
const wait=async()=>{for(let i=0;i<30;i++){try{if((await fetch(`${base}/api/health`)).ok)return}catch{}await new Promise(resolve=>setTimeout(resolve,150))}throw new Error(`A tesztszerver nem indult el. ${serverError}`)}

try{
  await wait()
  const ad={title:'HTTP teszt – tetőfedőt keresek',excerpt:'Családi ház kisebb tetőjavításához keresek megbízható szakembert.',city:'Érd',county:'Pest',trade:'Tetőfedő',budget:'Ajánlatkérés',contactName:'Folyamat Teszt',contactEmail:'folyamat@example.hu',contactPhone:'',expiryDays:7,sourceUrl:'',consent:true,website:''}
  const created=(await request('/api/submissions',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(ad)})).data.submission
  if(!created.debugVerificationUrl||!created.manageToken)throw new Error('Hiányzik a megerősítő vagy kezelési token.')
  const verification=new URL(created.debugVerificationUrl);const verificationResponse=await fetch(`${base}${verification.pathname}${verification.search}`,{redirect:'manual'});if(verificationResponse.status!==302)throw new Error('A megerősítő link nem irányított vissza az oldalra.')
  await request(`/api/submissions/${created.id}/manage`,{method:'PUT',headers:{'Content-Type':'application/json','X-Manage-Token':created.manageToken},body:JSON.stringify({...ad,title:'HTTP teszt – módosított tetőmunka'})})
  const login=await request('/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:'admin@test.hu',password:'Erős-HTTP-Teszt-2026!'})})
  const cookie=login.response.headers.get('set-cookie').split(';')[0]
  const pending=(await request('/api/admin/submissions',{headers:{Cookie:cookie}})).data.submissions
  if(!pending.some(item=>item.id===created.id))throw new Error('A megerősített hirdetés nem került moderációra.')
  const approved=(await request(`/api/admin/submissions/${created.id}/approve`,{method:'POST',headers:{Cookie:cookie}})).data
  const leads=(await request('/api/leads')).data.leads;const lead=leads.find(item=>item.id===approved.leadId)
  if(!lead||'contactEmail'in lead||!lead.hasContactForm)throw new Error('A nyilvános lead vagy az adatvédelem hibás.')
  await request(`/api/leads/${lead.id}/contact`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:'Teszt Szakember',email:'szaki@example.hu',message:'Szeretnék ajánlatot adni erre a tetőjavítási munkára.',website:''})})
  await request(`/api/leads/${lead.id}/report`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({reason:'hibás adatok',details:'Automatikus folyamatpróba',email:'',website:''})})
  const contacts=(await request('/api/admin/contacts',{headers:{Cookie:cookie}})).data.contacts;const reports=(await request('/api/admin/reports',{headers:{Cookie:cookie}})).data.reports
  if(contacts.length!==1||reports.length!==1)throw new Error('A kapcsolat vagy jelentés nem került az adminhoz.')
  await request(`/api/submissions/${created.id}/close`,{method:'POST',headers:{'X-Manage-Token':created.manageToken}})
  if((await request('/api/leads')).data.leads.some(item=>item.id===lead.id))throw new Error('A lezárt hirdetés látható maradt.')
  await request(`/api/submissions/${created.id}`,{method:'DELETE',headers:{'X-Manage-Token':created.manageToken}})
  console.log('HTTP önteszt sikeres: beküldés, e-mail-megerősítés, módosítás, admin belépés, moderálás, adatvédelem, kapcsolat, jelentés, lezárás és törlés.')
}finally{
  server.kill();await new Promise(resolve=>setTimeout(resolve,200))
  for(const suffix of['','-wal','-shm'])fs.rmSync(`${dbPath}${suffix}`,{force:true})
}
