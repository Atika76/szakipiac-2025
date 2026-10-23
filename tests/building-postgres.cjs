// Run after postgres-integration.cjs in the guarded, disposable issue8_test database.
const {sql,as,owner,other,assert,check}=require('./pg-helper.cjs');
const E=require('../epulet-szamitas.js'),C=require('../epulet-teteladatok.js');
assert.equal(sql('select current_database()'),'issue8_test');
assert.equal(sql("select shobj_description(oid,'pg_database') from pg_database where datname=current_database()"),'Issue8 disposable synthetic test');
const id='77777777-7777-4777-8777-777777777777',p=E.sample(C);
const literal=value=>"'"+value.replace(/'/g,"''")+"'";
check('részletes projekt JSONB-mentés és visszatöltés megőrzi minden új adatát',()=>{
 sql(as(owner,`delete from ajanlatok where id='${id}' and quote_status='draft'`));
 sql(as(owner,`insert into ajanlatok(id,user_id,project_name,payload) values('${id}','${owner}','Synthetic building',${literal(JSON.stringify(p))}::jsonb)`));
 const read=JSON.parse(sql(as(owner,`select payload from ajanlatok where id='${id}'`)));
 assert.deepEqual(E.validatePayload(read,C),p);
 p.items[0].mat_unit_price=100;
 sql(as(owner,`update ajanlatok set payload=${literal(JSON.stringify(p))}::jsonb where id='${id}'`));
 assert.equal(JSON.parse(sql(as(owner,`select payload from ajanlatok where id='${id}'`))).items[0].mat_unit_price,100);
});
check('idegen felhasználó az új JSONB-költségvetést sem olvashatja/módosíthatja',()=>{
 assert.equal(sql(as(other,`select payload from ajanlatok where id='${id}'`)),'');
 assert.equal(sql(as(other,`update ajanlatok set payload='{}' where id='${id}' returning id`)),'');
 assert.equal(JSON.parse(sql(as(owner,`select payload from ajanlatok where id='${id}'`))).building_budget.schema_version,1);
});
