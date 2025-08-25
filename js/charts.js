(function(global){
  function miniChart(canvas, labels, wind, gust){
    if(!canvas) return;
    return new Chart(canvas.getContext("2d"), {
      type:"line",
      data:{ labels, datasets:[
        { label:"Wind (kn)", data:wind, borderWidth:2, tension:.25, pointRadius:0 },
        { label:"Vlagen (kn)", data:gust, borderWidth:2, tension:.25, pointRadius:0 }
      ]},
      options:{
        responsive:true, maintainAspectRatio:false,
        plugins:{ legend:{ display:false } },
        interaction:{ mode:"index", intersect:false },
        scales:{
          x:{ ticks:{ maxRotation:0, autoSkip:true } },
          y:{ ticks:{ maxTicksLimit:3 }, beginAtZero:true }
        }
      }
    });
  }
  global.SWA=global.SWA||{}; global.SWA.charts={ miniChart };
})(window);