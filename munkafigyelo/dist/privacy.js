fetch('/api/config').then(response=>response.json()).then(config=>{
  document.querySelector('#operator-name').textContent=config.operatorName||'SzakiLead üzemeltető'
  const link=document.querySelector('#contact-email')
  link.textContent=config.contactEmail||'Nincs még beállítva'
  if(config.contactEmail)link.href=`mailto:${config.contactEmail}`
}).catch(()=>{})
