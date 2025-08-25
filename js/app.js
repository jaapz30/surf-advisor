(async function(){
  const { SPOTS, fetchAllSpots } = SWA.data;
  const { ensembleForSpot, areaBlendForSchok, gustiness } = SWA.ens;
  const settings = SWA.settings.get();
  document.getElementById("cfgStart").textContent = settings.start;
  document.getElementById("cfgEnd").textContent = settings.end;
  SWA.settings.uiInit(()=>{ location.reload(); });

  const notice = document.getElementById("notice");
  const noticeText = document.getElementById("noticeText");
  document.getElementById("btnRetry").addEventListener("click", ()=> location.reload());
  const showError = msg => { notice.hidden=false; noticeText.textContent=msg; };

  try{
    const {spots, errors} = await fetchAllSpots();
    if(errors.length) console.warn("Fetch warnings:", errors);

    const perSpot = {};
    Object.entries(spots).forEach(([name, data])=>{
      perSpot[name] = ensembleForSpot(name, data.seriesByModel);
    });

    const schokBlend = areaBlendForSchok(perSpot["Schokkerhaven"], { Ketelhaven:perSpot["Ketelhaven"], Marknesse:perSpot["Marknesse"] }) || perSpot["Schokkerhaven"];

    const BEST_LIST = ["Schokkerhaven","Lelystad","Urk","Stavoren"];
    const row = document.getElementById("bestSpots"); row.innerHTML="";
    const today = new Date().toISOString().slice(0,10);
    const inWindow = iso => iso.slice(0,10)===today && (iso.slice(11,16) >= settings.start) && (iso.slice(11,16) <= settings.end);

    function rolling8(series){
      if(!series || !Array.isArray(series.time) || !series.time.length) return {labels:[],w:[],g:[]};
      const nowISO=new Date().toISOString().slice(0,13);
      let idx=series.time.findIndex(t=> t.startsWith(nowISO)); if(idx<0) idx=0;
      const end=Math.min(series.time.length, idx+8);
      return { labels: series.time.slice(idx,end).map(t=>t.slice(11,16)), w: series.wsp.slice(idx,end), g:series.gust.slice(idx,end) };
    }

    function bestBlock(series, dayFilter){
      const idxs = series.time.map((t,i)=> (dayFilter? dayFilter(t):inWindow(t))? i : -1).filter(i=> i>=0);
      if(!idxs.length) return null;
      let best=null;
      for(let a=0; a<idxs.length-1; a++){
        let b=a; while(b<idxs.length && series.wsp[idxs[b]]>=settings.threshold) b++;
        const len=b-a;
        if(len>=2){
          const from=idxs[a], to=idxs[b-1];
          const avgW = series.wsp.slice(from,to+1).reduce((x,y)=>x+y,0)/len;
          const avgR = (series.rel?.slice(from,to+1).reduce((x,y)=>x+(y||0),0) || 0)/len;
          const score = avgW*(avgR/100);
          if(!best || score>best.score) best={from,to,avgW,avgR,score};
          a=b;
        }
      }
      return best;
    }

    function spotScore(series){
      const idxs = series.time.map((t,i)=> inWindow(t)? i : -1).filter(i=> i>=0);
      if(!idxs.length) return -1;
      const wmean = idxs.map(i=>series.wsp[i]).reduce((x,y)=>x+y,0)/idxs.length;
      const rmean = idxs.map(i=>series.rel?.[i]||0).reduce((x,y)=>x+y,0)/idxs.length;
      return wmean * (rmean/100);
    }

    const ranking = BEST_LIST.map(name=>{
      const s = (name==="Schokkerhaven") ? schokBlend : perSpot[name];
      return [name, s? spotScore(s):-1, s];
    }).sort((a,b)=> b[1]-a[1]);

    ranking.forEach(([name, score, series], idx)=>{
      if(score<0 || !series) return;
      const idxs = series.time.map((t,i)=> inWindow(t)? i : -1).filter(i=> i>=0);
      const wmean = idxs.length? Math.round(idxs.map(i=>series.wsp[i]).reduce((x,y)=>x+y,0)/idxs.length):0;
      const gmean = idxs.length? Math.round(idxs.map(i=>series.gust[i]).reduce((x,y)=>x+y,0)/idxs.length):0;
      const rmean = idxs.length? Math.round(idxs.map(i=>series.rel?.[i]||0).reduce((x,y)=>x+y,0)/idxs.length):0;
      const gusty = idxs.length? Math.round(100*gustiness(wmean, gmean)):0;
      const best = bestBlock(series);
      const bestText = best? `${series.time[best.from].slice(11,16)}–${series.time[best.to].slice(11,16)} (${Math.round(best.avgW)} kn, ${Math.round(best.avgR)}%)` : "—";
      const el=document.createElement("div"); el.className="spot";
      el.innerHTML = `
        <h3>${name} ${idx===0?'<img src="assets/trophy.svg" class="ico" alt="beste"/>':''}</h3>
        <div class="meta"><span>Wind: <b>${wmean} kn</b></span><span>Vlagen: <b>${gmean} kn</b></span><span>Betrouwbaarheid: <b>${rmean}%</b></span><span>Vlagerigheid: <b>${gusty}%</b></span></div>
        <div class="meta">Advies: ${ (best && best.avgR>=60) ? `<span class="badge go">Ga surfen</span> Beste tijd: ${bestText}` : `<span class="badge nogo">Niet surfen</span>` }</div>
        <details><summary>Grafiek — Komende 8 uur</summary><div class="chart-wrap"><canvas height="160"></canvas></div></details>`;
      const canvas = el.querySelector("canvas");
      const roll = rolling8(series);
      SWA.charts.miniChart(canvas, roll.labels, roll.w, roll.g);
      document.getElementById("bestSpots").appendChild(el);
    });

    // Schokkerhaven 8h + days
    const schok = schokBlend;
    const roll8 = rolling8(schok);
    SWA.charts.miniChart(document.getElementById("schok-8h"), roll8.labels, roll8.w, roll8.g);
    const daysWrap = document.getElementById("days"); daysWrap.innerHTML="";
    if(schok){
      const byDate={}; schok.time.forEach((iso,i)=>{ const d=iso.slice(0,10); (byDate[d]??=[]).push(i); });
      Object.entries(byDate).slice(0,7).forEach(([d, idxs])=>{
        const inWin = i => schok.time[i].slice(0,10)===d && schok.time[i].slice(11,16)>=settings.start && schok.time[i].slice(11,16)<=settings.end;
        const winIdx = idxs.filter(inWin);
        const wmean = winIdx.length? Math.round(winIdx.map(i=>schok.wsp[i]).reduce((x,y)=>x+y,0)/winIdx.length):0;
        const gmean = winIdx.length? Math.round(winIdx.map(i=>schok.gust[i]).reduce((x,y)=>x+y,0)/winIdx.length):0;
        const rmean = winIdx.length? Math.round(winIdx.map(i=>schok.rel?.[i]||0).reduce((x,y)=>x+y,0)/winIdx.length):0;
        const best = (function(){ const s={time:schok.time,wsp:schok.wsp,rel:schok.rel}; return (function(series){ const idxs=winIdx; if(!idxs.length) return null; let best=null; for(let a=0;a<idxs.length-1;a++){ let b=a; while(b<idxs.length && schok.wsp[idxs[b]]>=settings.threshold) b++; const len=b-a; if(len>=2){ const from=idxs[a], to=idxs[b-1]; const avgW=schok.wsp.slice(from,to+1).reduce((x,y)=>x+y,0)/len; const avgR=(schok.rel.slice(from,to+1).reduce((x,y)=>x+(y||0),0))/len; const score=avgW*(avgR/100); if(!best||score>best.score) best={from,to,avgW,avgR,score}; a=b; } } return best; })(); })();
        const bestText = best? `${schok.time[best.from].slice(11,16)}–${schok.time[best.to].slice(11,16)} (${Math.round(best.avgW)} kn, ${Math.round(best.avgR)}%)` : "—";
        const dayEl=document.createElement("div"); dayEl.className="day";
        dayEl.innerHTML = `<div><b>${d}</b></div>
          <div>Wind ~<b>${wmean} kn</b>, vlagen ~<b>${gmean} kn</b>, betrouwb. <b>${rmean}%</b></div>
          <div>Advies: ${ (best && best.avgR>=60) ? `<span class="badge go">Ga surfen</span> Beste tijd: ${bestText}` : `<span class="badge nogo">Niet surfen</span>` }</div>
          <details><summary>Toon 8-uur grafiek</summary><div class="chart-wrap"><canvas height="150"></canvas></div></details>`;
        const canv = dayEl.querySelector("canvas");
        const labels = winIdx.slice(0,8).map(i=> schok.time[i].slice(11,16));
        const wvals = winIdx.slice(0,8).map(i=> schok.wsp[i]);
        const gvals = winIdx.slice(0,8).map(i=> schok.gust[i]);
        SWA.charts.miniChart(canv, labels, wvals, gvals);
        daysWrap.appendChild(dayEl);
      });
    }

    document.getElementById("lastUpdated").textContent = new Date().toLocaleString("nl-NL",{hour12:false});
  }catch(err){ console.error(err); showError("Fout bij laden data: "+String(err)); }
})();