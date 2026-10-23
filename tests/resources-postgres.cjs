// Only the existing disposable synthetic PostgreSQL fixtures, never hosted data.
const {sql,as,owner,other,assert,check}=require('./pg-helper.cjs');
const E=require('../epulet-szamitas.js'),C=require('../epulet-teteladatok.js'),{fixture}=require('./resources-fixture.cjs');
assert.equal(sql("select shobj_description(oid,'pg_database') from pg_database where datname=current_database()"),'Issue8 disposable synthetic test');
const id=require('node:crypto').randomUUID(),p=fixture(),literal=p=>"'"+JSON.stringify(p).replace(/'/g,"''")+"'::jsonb";
check('anyag/normakatalógus és rezsióradíjak teljes JSONB-köre, új séma nélkül',()=>{
 sql(as(owner,`insert into ajanlatok(id,user_id,project_name,payload) values('${id}','${owner}','Synthetic stage3',${literal(p)})`));
 assert.deepEqual(E.validatePayload(JSON.parse(sql(as(owner,`select payload from ajanlatok where id='${id}'`))),C),p);
});
check('katalógusfrissítés után régi ajánlatár és normapillanatkép változatlan',()=>{
 const t=E.calculate(p.items,p.building_budget.settings);p.building_budget.material_catalog.at(-1).unit_price=99999;p.building_budget.norm_catalog.at(-1).norm=99;
 sql(as(owner,`update ajanlatok set payload=${literal(p)} where id='${id}'`));const read=E.validatePayload(JSON.parse(sql(as(owner,`select payload from ajanlatok where id='${id}'`))),C);
 assert.deepEqual(read,p);assert.equal(E.calculate(read.items,read.building_budget.settings).gross,t.gross);
});
check('idegen felhasználó a katalógusokat és az ajánlatot sem olvashatja/írhatja',()=>{
 assert.equal(sql(as(other,`select payload from ajanlatok where id='${id}'`)),'');assert.equal(sql(as(other,`update ajanlatok set payload='{}' where id='${id}' returning id`)),'');assert.deepEqual(JSON.parse(sql(as(owner,`select payload from ajanlatok where id='${id}'`))),p);
});
