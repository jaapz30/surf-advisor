(function(global){
  const KEY="swa_settings_v2";
  function load(){ try{ return JSON.parse(localStorage.getItem(KEY)||"{}"); }catch(e){ return {}; } }
  function save(obj){ localStorage.setItem(KEY, JSON.stringify(obj)); }
  function get(){ const s=load(); return { threshold:Number.isFinite(Number(s.threshold))?Number(s.threshold):15, start:s.start||"07:00", end:s.end||"20:00" }; }
  function set(s){ save(s); }
  function uiInit(onSave){
    const dlg=document.getElementById("dlgSettings");
    document.getElementById("btnSettings").addEventListener("click", ()=>{
      const s=get(); document.getElementById("inpThreshold").value=s.threshold; document.getElementById("inpStart").value=s.start; document.getElementById("inpEnd").value=s.end; dlg.showModal();
    });
    document.getElementById("btnSave").addEventListener("click", ()=>{
      const s={ threshold:Number(document.getElementById("inpThreshold").value||15),
        start:(document.getElementById("inpStart").value||"07:00").slice(0,5),
        end:(document.getElementById("inpEnd").value||"20:00").slice(0,5) };
      set(s); onSave?.(s);
    });
  }
  global.SWA=global.SWA||{}; global.SWA.settings={get,set,uiInit};
})(window);