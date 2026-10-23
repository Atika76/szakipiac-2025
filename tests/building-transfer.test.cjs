const test=require('node:test'),assert=require('node:assert/strict');
const {edge,query}=require('./helpers.cjs');
function transfer({enabled,plan=false,user='owner',accepted=true}={}){
 let forwarded=0,writes=0,ownerReads=0;
 const client={auth:{getUser:async()=>({data:{user:{id:user,email:user+'@example.test'}}}),admin:{getUserById:async()=>{ownerReads++;return {data:{user:{email:'owner@example.test'}}};}}},from(table){
  if(table==='szakipiac_360_entitlements')return query({data:null});
  if(table==='kivitelezes_projektek')return query({data:{id:'plan',user_id:'owner',source_quote_id:'q',payload:{}}});
  const payload={items:[{name:'Canonical quote'}]};if(enabled!==undefined)payload.building_budget={enabled};
  const q=query({data:{id:'q',user_id:'owner',quote_status:accepted?'accepted':'draft',accepted_at:accepted?'2026-10-21':null,payload}});
  q.update=()=>{writes++;return q;};return q;
 }};
 const handler=edge('supabase/functions/send-quote-to-epitesnaplo/index.ts',{createClient:()=>client,fetch:async()=>{forwarded++;return Response.json({ok:true,request_id:'test',import_url:'https://example.test/import'});}});
 return {run:()=>handler(new Request('https://example.test',{method:'POST',headers:{Authorization:'Bearer synthetic'},body:JSON.stringify(plan?{kivitelezesProjectId:'plan'}:{quoteId:'q'})})),counts:()=>({forwarded,writes,ownerReads})};
}
for(const plan of [false,true]){
 test('detailed draft rejected before forwarding or marking import, planning='+plan,async()=>{
  for(const enabled of [true,'true','false',{},0,[]]){
   const x=transfer({plan,enabled}),r=await x.run();assert.equal(r.status,409);assert.match((await r.json()).error,/munkaváltozat/);
   assert.deepEqual(x.counts(),{forwarded:0,writes:0,ownerReads:0});
  }
 });
 test('legacy / explicit false / null quote transfer preserved, planning='+plan,async()=>{
  for(const enabled of [undefined,false,null]){const x=transfer({plan,enabled});assert.equal((await x.run()).status,200);assert.deepEqual(x.counts(),{forwarded:1,writes:1,ownerReads:1});}
 });
}
test('ownership and accepted-state checks are preserved',async()=>{
 assert.equal((await transfer({enabled:true,user:'other'}).run()).status,403);
 const x=transfer({enabled:false,accepted:false});assert.equal((await x.run()).status,409);assert.equal(x.counts().forwarded,0);
});
