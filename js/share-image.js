
document.addEventListener("click",function(e){
 const btn=e.target.closest(".share-image-btn");
 if(!btn) return;

 const card=btn.closest(".border, .hirdetes, .card") || document;
 const title=card.querySelector("h2,h3,.title")?.innerText || "SzakiPiac hirdetés";
 const text=card.querySelector("p")?.innerText || "";

 const canvas=document.createElement("canvas");
 canvas.width=1200;
 canvas.height=630;
 const ctx=canvas.getContext("2d");

 ctx.fillStyle="#facc15";
 ctx.fillRect(0,0,1200,630);

 ctx.fillStyle="#111";
 ctx.font="bold 60px Arial";
 wrapText(ctx,title,80,200,1040,70);

 ctx.font="36px Arial";
 wrapText(ctx,text.substring(0,180),80,340,1040,50);

 ctx.font="28px Arial";
 ctx.fillText("szakipiac-2025.hu",80,560);

 const url=canvas.toDataURL("image/png");
 const a=document.createElement("a");
 a.href=url;
 a.download="szakipiac-hirdetes.png";
 a.click();
});

function wrapText(ctx,text,x,y,maxWidth,lineHeight){
 const words=text.split(" ");
 let line="";
 for(let n=0;n<words.length;n++){
  const test=line+words[n]+" ";
  const metrics=ctx.measureText(test);
  if(metrics.width>maxWidth && n>0){
   ctx.fillText(line,x,y);
   line=words[n]+" ";
   y+=lineHeight;
  }else{
   line=test;
  }
 }
 ctx.fillText(line,x,y);
}
