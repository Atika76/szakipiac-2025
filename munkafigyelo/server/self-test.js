process.env.DB_PATH=':memory:'
process.env.PUBLIC_APP_URL='http://127.0.0.1:4174'
process.env.ADMIN_EMAIL='admin@test.hu'
process.env.ADMIN_PASSWORD='Erős-Teszt-Jelszó-2026!'

const { db,initializeDatabase }=await import('./db.js')
await initializeDatabase()
const { insertLead,listLeads,classify }=await import('./ingest.js')
const first=await insertLead({title:'Sürgősen burkolót keresek',excerpt:'Fürdőszoba teljes burkolása.',source:'Teszt',sourceUrl:'https://example.hu/1',city:'Pécs',county:'Baranya'},{notify:false})
if(!first.inserted||classify(first.lead.title)!=='Burkoló')throw new Error('A lead beszúrása vagy szakmafelismerése hibás.')
if((await listLeads({trade:'Burkoló'})).length!==1)throw new Error('A leadszűrés hibás.')
if((await insertLead({title:'Sürgősen burkolót keresek',source:'Teszt',sourceUrl:'https://example.hu/1'},{notify:false})).inserted)throw new Error('A duplikációszűrés hibás.')

const { recordEvent,analyticsSummary }=await import('./analytics.js')
await recordEvent({sessionId:'self-test-session-1234',event:'page_view'})
if((await analyticsSummary()).visitorsToday!==1)throw new Error('Az anonim statisztika hibás.')

const { createSubmission,verifySubmission,listSubmissions,approveSubmission,getManagedSubmission,updateManagedSubmission,closeManagedSubmission }=await import('./submissions.js')
const created=await createSubmission({title:'Villanyszerelőt keresek családi házhoz',excerpt:'Teljes vezetékcsere és új elosztótábla kialakítása szükséges.',city:'Érd',county:'Pest',trade:'Villanyszerelő',contactName:'Teszt Megrendelő',contactEmail:'megrendelo@example.hu',expiryDays:30,consent:true})
if(!created.debugVerificationUrl)throw new Error('A helyi e-mail-megerősítő link hiányzik.')
const verificationToken=new URL(created.debugVerificationUrl).searchParams.get('token')
await verifySubmission(verificationToken)
if((await listSubmissions()).length!==1)throw new Error('Az e-mail-megerősítés vagy moderálási lista hibás.')
const approved=await approveSubmission(created.id)
const managed=await getManagedSubmission(created.id,created.manageToken)
if(managed.status!=='active'||!approved.leadId)throw new Error('A jóváhagyás vagy hirdetéskezelés hibás.')

const { createContactRequest,createReport,listContactRequests,listReports }=await import('./engagement.js')
await createContactRequest(approved.leadId,{name:'Teszt Szakember',email:'szaki@example.hu',message:'Szívesen elvégezném a munkát, kérem keressen vissza.',website:''})
await createReport(approved.leadId,{reason:'hibás adatok',details:'Teszt jelentés',email:'jelento@example.hu'})
if((await listContactRequests()).length!==1||(await listReports()).length!==1)throw new Error('A kapcsolatközvetítés vagy jelentés hibás.')
await updateManagedSubmission(created.id,created.manageToken,{...managed,title:'Módosított villanyszerelő munka',expiryDays:14})

const { initializeAdmin,loginAdmin,resetPassword,requestPasswordReset }=await import('./auth.js')
await initializeAdmin();const headers={};const response={setHeader:(name,value)=>{headers[name]=value}}
if(!await loginAdmin('admin@test.hu','Erős-Teszt-Jelszó-2026!',response)||!headers['Set-Cookie'])throw new Error('Az admin bejelentkezés hibás.')
const resetToken=await requestPasswordReset('admin@test.hu');await resetPassword(resetToken,'Még-Erősebb-Jelszó-2026!')
await closeManagedSubmission(created.id,created.manageToken)
await db.destroy()
console.log('Önteszt sikeres: tartós adatmodell, leadek, e-mail-megerősítés, hirdetéskezelés, kapcsolatközvetítés, jelentés, admin munkamenet és jelszó-visszaállítás.')
