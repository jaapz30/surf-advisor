(function(global){
  const MODELS=global.SWA.data.MODELS;
  const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
  const mean=a=>a.length?a.reduce((x,y)=>x+y,0)/a.length:NaN;
  const median=a=>{if(!a.length)return NaN; const s=[...a].sort((x,y)=>x-y); const m=Math.floor(s.length/2); return s.length%2?s[m]:(s[m-1]+s[m])/2;};
  const iqr=a=>{if(!a.length)return 0; const s=[...a].sort((x,y)=>x-y); const q1=s[Math.floor(s.length*0.25)], q3=s[Math.floor(s.length*0.75)]; return q3-q1;};
  const degAvg=arr=>{if(!arr.length)return NaN; const rad=arr.map(d=>d*Math.PI/180); const X=rad.reduce((a,r)=>a+Math.cos(r),0)/arr.length, Y=rad.reduce((a,r)=>a+Math.sin(r),0)/arr.length; let d=Math.atan2(Y,X)*180/Math.PI; if(d<0)d+=360; return d;};
  const median3=a=>a.map((v,i)=>{const A=a[i-1]??v,B=v,C=a[i+1]??v; return [A,B,C].sort((x,y)=>x-y)[1];});
  const spikeClamp=a=>a.map((v,i)=>{const L=a[i-1]??v,R=a[i+1]??v,M=(L+R)/2; return v>1.4*M?1.4*M:v;});
  function gustFix(w,g){ if(!Array.isArray(w)||!Array.isArray(g)) return g||[]; let x=g.map((v,i)=>Math.max(Number(v)||0,Number(w[i])||0)); x=median3(x); x=spikeClamp(x); x=x.map((v,i)=>Math.min(v,(Number(w[i])||0)*1.7)); x=x.map((v,i)=>Math.max(v,Number(w[i])||0)); return x; }
  const BIAS_KEY="swa_bias_v2"; const loadBias=()=>{try{return JSON.parse(localStorage.getItem(BIAS_KEY)||'{}');}catch(e){return {};}}; const saveBias=o=>localStorage.setItem(BIAS_KEY,JSON.stringify(o));
  function updateBiasFromHistory(spot, perModel){ const bias=loadBias(); const hours=new Set(); Object.values(perModel).forEach(s=>(s?.time||[]).forEach(t=>hours.add(t))); const base=[...hours].sort(); if(!base.length) return;
    const aligned={}; MODELS.forEach(m=>{const s=perModel[m]; if(!s) return; const map=new Map(s.time.map((t,i)=>[t,i])); const wsp=base.map(t=>{const i=map.get(t); const v=i!=null?s.wsp[i]:NaN; return Number.isFinite(v)?v:NaN}); const gust=base.map(t=>{const i=map.get(t); const v=i!=null?s.gust[i]:NaN; return Number.isFinite(v)?v:NaN}); aligned[m]={time:base,wsp,gust};});
    const nowHour=new Date().toISOString().slice(0,13); const idxEnd=base.findIndex(t=>t.startsWith(nowHour)); const last=idxEnd>0?idxEnd-1:base.length-1; if(last<0) return;
    const proxyW=base.map((_,i)=>median(MODELS.map(m=>aligned[m]?.wsp?.[i]).filter(Number.isFinite))); const proxyG=base.map((_,i)=>median(MODELS.map(m=>aligned[m]?.gust?.[i]).filter(Number.isFinite)));
    const look=Math.min(48,last+1); const start=Math.max(0,last-look+1);
    MODELS.forEach(m=>{ const s=aligned[m]; if(!s) return; const rW=[],rG=[]; for(let i=start;i<=last;i++){ const pw=proxyW[i],pg=proxyG[i], mw=s.wsp[i], mg=s.gust[i]; if(Number.isFinite(pw)&&Number.isFinite(mw)) rW.push(mw-pw); if(Number.isFinite(pg)&&Number.isFinite(mg)) rG.push(mg-pg); } const bW=mean(rW)||0,bG=mean(rG)||0; const prev=(bias[spot]?.[m])||{w:0,g:0}; bias[spot] ||= {}; bias[spot][m]={w:0.9*prev.w+0.1*bW, g:0.9*prev.g+0.1*bG}; });
    saveBias(bias);
  }
  function applyBias(spot,model,wsp,gust){ const b=(loadBias()?.[spot]?.[model])||{w:0,g:0}; const outW=wsp.map(v=> v - Math.max(-Math.abs(v)*0.2, Math.min(Math.abs(v)*0.2, b.w))); const outG=gust.map(v=> v - Math.max(-Math.abs(v)*0.3, Math.min(Math.abs(v)*0.3, b.g))); return {wsp:outW, gust:outG}; }
  function modelWeight(m,h){ if(h<=6){ const w={knmi_harmonie_arome_netherlands:3,icon_d2:3,icon_eu:1.2,ecmwf_ifs025:1.5,gfs_global:0.8,meteofrance_arpege_europe:1.2,knmi_seamless:1.0}; return (w[m]||1)*(m==="knmi_seamless"?1.1:1); } else if(h<=48){ const w={knmi_harmonie_arome_netherlands:0.5,icon_d2:0.8,icon_eu:2.5,ecmwf_ifs025:3,gfs_global:1.5,meteofrance_arpege_europe:1.2,knmi_seamless:1.0}; return (w[m]||1)*(m==="knmi_seamless"?1.1:1); } else { const w={knmi_harmonie_arome_netherlands:0.5,icon_d2:0.5,icon_eu:1.2,ecmwf_ifs025:2.5,gfs_global:2.0,meteofrance_arpege_europe:0.8,knmi_seamless:1.0}; return (w[m]||1)*(m==="knmi_seamless"?1.1:1); } }
  function align(base,s){ const map=new Map(s.time.map((t,i)=>[t,i])); const wsp=base.map(t=>{const i=map.get(t); const v=i!=null?s.wsp[i]:NaN; return Number.isFinite(v)?v:NaN}); const gust=base.map(t=>{const i=map.get(t); const v=i!=null?s.gust[i]:NaN; return Number.isFinite(v)?v:NaN}); const wdir=base.map(t=>{const i=map.get(t); const v=i!=null?s.wdir[i]:NaN; return Number.isFinite(v)?v:NaN}); return {time:base,wsp, gust, wdir}; }
  function ensembleForSpot(spot, perModel){ updateBiasFromHistory(spot, perModel); const first=Object.values(perModel).find(s=>s&&Array.isArray(s.time)&&s.time.length); if(!first) return null; const base=first.time.slice(); const nowHr=new Date(Date.parse(new Date().toISOString().slice(0,13)+":00:00.000Z")); const wsp=[],gust=[],wdir=[],rel=[];
    for(let i=0;i<base.length;i++){ const t=new Date(base[i]); const h=Math.max(Math.round((t-nowHr)/3600000),0); const wv=[], gv=[], dv=[];
      for(const m of MODELS){ const s=perModel[m]; if(!s) continue; const a=align(base,s); const gf=gustFix(a.wsp,a.gust); const b=applyBias(spot,m,a.wsp,gf); if(Number.isFinite(b.wsp[i])) wv.push(b.wsp[i]*modelWeight(m,h)); if(Number.isFinite(b.gust[i])) gv.push(b.gust[i]*modelWeight(m,h)); if(Number.isFinite(a.wdir[i])) dv.push(a.wdir[i]); }
      const sum=a=>a.reduce((x,y)=>x+y,0); const wAvg = wv.length? sum(wv)/sum(wv.map(_=>1)) : NaN; const gAvg = gv.length? sum(gv)/sum(gv.map(_=>1)) : NaN; const dAvg=degAvg(dv);
      wsp.push(Number.isFinite(wAvg)?wAvg:NaN); gust.push(Number.isFinite(gAvg)?gAvg:NaN); wdir.push(Number.isFinite(dAvg)?dAvg:NaN);
      const vals = wv.map(v=>v); const spread=iqr(vals); const ref=Math.max(mean(vals),1); const r=100*(1 - Math.max(0,Math.min(1, spread/Math.max(ref*0.7,1)))); rel.push(Math.round(r));
    }
    if(spot==="Schokkerhaven"){ for(let i=0;i<wsp.length;i++){ if(Number.isFinite(wsp[i])) wsp[i]*=1.05; if(Number.isFinite(gust[i])) gust[i]=Math.max(gust[i],wsp[i]); } }
    return {time:base,wsp,gust,wdir,rel};
  }
  function areaBlendForSchok(schok, neighbors){ const first=schok||neighbors.Ketelhaven||neighbors.Marknesse; if(!first) return null; const base=first.time.slice(); const wsp=[],gust=[],wdir=[],rel=[];
    for(let i=0;i<base.length;i++){ const arrW=[],arrG=[],arrD=[],arrR=[];
      const push=(s,wt)=>{ if(!s) return; if(Number.isFinite(s.wsp?.[i])) arrW.push(s.wsp[i]*wt); if(Number.isFinite(s.gust?.[i])) arrG.push(s.gust[i]*wt); if(Number.isFinite(s.wdir?.[i])) arrD.push(s.wdir[i]); if(Number.isFinite(s.rel?.[i])) arrR.push(s.rel[i]); };
      push(schok,1); push(neighbors.Ketelhaven,0.5); push(neighbors.Marknesse,0.5);
      const W=arrW.length? arrW.reduce((a,c)=>a+c,0)/(1+0.5+0.5) : NaN;
      const G=arrG.length? arrG.reduce((a,c)=>a+c,0)/(1+0.5+0.5) : NaN;
      const D=degAvg(arrD);
      const R=arrR.length? Math.round(arrR.reduce((a,c)=>a+c,0)/arrR.length):NaN;
      wsp.push(Number.isFinite(W)? W*1.02:NaN); gust.push(Number.isFinite(G)? Math.max(G,W):NaN); wdir.push(D); rel.push(R);
    } return {time:base,wsp,gust,wdir,rel}; }
  function gustiness(w,g){ return clamp((g-w)/Math.max(w,1),0,1); }
  global.SWA=global.SWA||{}; global.SWA.ens={ensembleForSpot, areaBlendForSchok, gustiness};
})(window);