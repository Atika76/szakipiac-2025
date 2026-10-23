const{sql,as,owner,other,check,assert}=require('./pg-helper.cjs'),E=require('../epulet-szamitas.js'),C=require('../epulet-teteladatok.js'),{fixture}=require('./quickquote-fixture.cjs');
assert.equal(sql("select shobj_description(oid,'pg_database') from pg_database where datname=current_database()"),'Issue8 disposable synthetic test');
const id=require('node:crypto').randomUUID(),p=fixture(),literal=x=>"'"+JSON.stringify(x).replaceAll("'","''")+"'::jsonb";
check('Gyorsajánlat, normák, anyagpillanatképek és jogszabályi referencia JSONB-köre',()=>{
 sql(as(owner,`insert into ajanlatok(id,user_id,project_name,payload) values('${id}','${owner}','Synthetic quickquote',${literal(p)})`));const read=E.validatePayload(JSON.parse(sql(as(owner,`select payload from ajanlatok where id='${id}'`))),C);assert.deepEqual(read,p);assert.equal(E.calculate(read.items,read.building_budget.settings).gross,562791.61);
});
check('idegen felhasználó a gyorsajánlatot sem olvashatja vagy írhatja',()=>{assert.equal(sql(as(other,`select payload from ajanlatok where id='${id}'`)),'');assert.equal(sql(as(other,`update ajanlatok set payload='{}' where id='${id}' returning id`)),'');assert.deepEqual(JSON.parse(sql(as(owner,`select payload from ajanlatok where id='${id}'`))),p);});
