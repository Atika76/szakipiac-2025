// Dedicated local test database only; no schema changes or hosted access.
const {sql,as,owner,other,assert,check}=require('./pg-helper.cjs');
const E=require('../epulet-szamitas.js'),C=require('../epulet-teteladatok.js'),{fixture}=require('./component-fixture.cjs');
assert.equal(sql("select shobj_description(oid,'pg_database') from pg_database where datname=current_database()"),'Issue8 disposable synthetic test');
const id=require('node:crypto').randomUUID(),p=fixture(),literal=v=>"'"+JSON.stringify(v).replace(/'/g,"''")+"'::jsonb";
p.building_budget.custom_catalog=[{...C.rows[0],id:'sajat-component-db',egyseg:p.items[1].unit,budget_defaults:{material_mode:'components',components:E.copy(p.items[1].budget.components)}}];
check('összetevős ajánlat és saját összetevős katalógus teljes JSONB-köre',()=>{
 sql(as(owner,`insert into ajanlatok(id,user_id,project_name,payload) values('${id}','${owner}','Synthetic components',${literal(p)})`));
 assert.deepEqual(E.validatePayload(JSON.parse(sql(as(owner,`select payload from ajanlatok where id='${id}'`))),C),p);
 assert.equal(E.calculate(p.items,p.building_budget.settings).gross,219265.5);
 p.items[1].budget.components[0].unit_price=110;
 sql(as(owner,`update ajanlatok set payload=${literal(p)} where id='${id}'`));
 const read=JSON.parse(sql(as(owner,`select payload from ajanlatok where id='${id}'`)));assert.deepEqual(read,p);
 assert.equal(E.calculate(read.items,read.building_budget.settings).material,151730);
});
check('idegen felhasználó az összetevőárakat sem olvashatja vagy írhatja',()=>{
 assert.equal(sql(as(other,`select payload from ajanlatok where id='${id}'`)),'');
 assert.equal(sql(as(other,`update ajanlatok set payload='{}' where id='${id}' returning id`)),'');
 assert.deepEqual(JSON.parse(sql(as(owner,`select payload from ajanlatok where id='${id}'`))),p);
});
check('a régi JSONB-payload ugyanazon táblán változatlan marad',()=>{
 const oldId=require('node:crypto').randomUUID(),old={project_name:'Legacy',items:[{name:'Régi sor',qty:2,unit:'m²',mat_unit_price:100,lab_unit_price:200}]};
 sql(as(owner,`insert into ajanlatok(id,user_id,project_name,payload) values('${oldId}','${owner}','Legacy',${literal(old)})`));
 assert.deepEqual(E.validatePayload(JSON.parse(sql(as(owner,`select payload from ajanlatok where id='${oldId}'`))),C),old);
});
