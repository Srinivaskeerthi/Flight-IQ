/**
 * chartUtils.js — Highcharts config builders with midnight teal + coral theme.
 */

const PAL = ['#0ee8c8','#9b72ff','#ff6b6b','#ffd166','#06b6d4','#34d399','#f59e0b','#e879f9','#84cc16','#38bdf8','#fb923c','#a78bfa'];

const BASE = {
  chart:   { backgroundColor:'transparent', style:{ fontFamily:"'Outfit',sans-serif" }, spacing:[10,10,10,10], animation:{ duration:550 } },
  title:   { text:null },
  credits: { enabled:false },
  colors:  PAL,
  exporting: { enabled:false },
  legend:  { itemStyle:{ color:'#8ab5a8', fontWeight:'400', fontSize:'12px' }, itemHoverStyle:{ color:'#e8f4f0' } },
  tooltip: { backgroundColor:'#10202e', borderColor:'rgba(14,232,200,0.2)', borderRadius:10, shadow:false, style:{ color:'#e8f4f0', fontSize:'13px' } },
};

const AX = {
  labels:        { style:{ color:'#8ab5a8', fontSize:'11px', fontFamily:"'Fira Code',monospace" } },
  lineColor:     'rgba(14,232,200,0.08)',
  tickColor:     'rgba(14,232,200,0.08)',
  gridLineColor: 'rgba(14,232,200,0.06)',
};

function axes(data, columns=[]) {
  if (!data?.length) return { catKey:null, valKeys:[] };
  const keys   = columns.length ? columns : Object.keys(data[0]);
  const sample = data.slice(0,20);
  const isNum  = k => sample.every(r => r[k]==null || typeof r[k]==='number');
  let catKey=null; const valKeys=[];
  for (const k of keys) {
    if (!catKey && !isNum(k)) catKey=k;
    else if (isNum(k) && valKeys.length<5) valKeys.push(k);
  }
  if (!catKey && valKeys.length) catKey=valKeys.shift();
  return { catKey, valKeys };
}

const fmt  = k => k.replace(/_/g,' ').replace(/\b\w/g, c=>c.toUpperCase());
const safe = v => { if (v==null) return null; const n=Number(v); return isFinite(n)?n:null; };
const abbr = v => v==null?'': v>=1e6?`${(v/1e6).toFixed(1)}M`: v>=1e3?`${(v/1e3).toFixed(1)}k`: v.toFixed(1);

// ── Bar ──────────────────────────────────────────────────────────────────
function bar(data, title='') {
  const { catKey, valKeys } = axes(data);
  if (!catKey||!valKeys.length) return null;
  const multi = valKeys.length>1;
  return {
    ...BASE, chart:{ ...BASE.chart, type:'bar' },
    title:{ text:title, style:{ color:'#8ab5a8', fontSize:'12px' } },
    xAxis:{ categories:data.map(r=>String(r[catKey]??'')), ...AX,
      labels:{ ...AX.labels, formatter(){ const v=String(this.value); return v.length>20?v.slice(0,18)+'…':v; } } },
    yAxis:{ title:{ text:multi?null:fmt(valKeys[0]), style:{ color:'#3d6b5e' } }, ...AX },
    plotOptions:{ bar:{ stacking:valKeys.length>2?'normal':undefined, groupPadding:0.1, pointPadding:0.06,
      borderRadius:4,
      dataLabels:{ enabled:!multi, style:{ color:'#e8f4f0', fontSize:'11px', textOutline:'none', fontWeight:'400' },
        formatter(){ return abbr(this.y); } } } },
    legend:{ ...BASE.legend, enabled:multi },
    series: valKeys.map((k,i) => ({ name:fmt(k), type:'bar', data:data.map(r=>safe(r[k])), color:PAL[i%PAL.length], borderRadius:4 })),
  };
}

// ── Line ─────────────────────────────────────────────────────────────────
function line(data, title='') {
  const { catKey, valKeys } = axes(data);
  if (!catKey||!valKeys.length) return null;
  const cats = data.map(r=>String(r[catKey]??''));
  return {
    ...BASE, chart:{ ...BASE.chart, type:'spline' },
    title:{ text:title, style:{ color:'#8ab5a8', fontSize:'12px' } },
    xAxis:{ categories:cats, ...AX,
      labels:{ ...AX.labels, rotation:data.length>12?-30:0,
        formatter(){ const v=String(this.value); return data.length>20&&v.length>7?v.slice(0,6)+'…':v; } } },
    yAxis:{ title:{ text:valKeys.length===1?fmt(valKeys[0]):null, style:{ color:'#3d6b5e' } }, ...AX },
    plotOptions:{ series:{ connectNulls:true } },
    legend:{ ...BASE.legend, enabled:valKeys.length>1 },
    series: valKeys.map((k,i) => ({
      name:fmt(k), data:data.map(r=>safe(r[k])),
      color:PAL[i%PAL.length], lineWidth:2.5,
      marker:{ enabled:data.length<=40, radius:4, symbol:'circle' },
      type: i===0 ? 'areaspline' : 'spline',
      ...(i===0 ? { fillColor:{ linearGradient:{x1:0,y1:0,x2:0,y2:1},
        stops:[[0,`${PAL[0]}30`],[1,`${PAL[0]}00`]] }, fillOpacity:0.18 } : {}),
    })),
  };
}

// ── Pie ──────────────────────────────────────────────────────────────────
function pie(data, title='') {
  const { catKey, valKeys } = axes(data);
  if (!catKey||!valKeys.length) return null;
  const vk = valKeys[0];
  let slices = [...data]
    .map(r=>({ name:String(r[catKey]??''), y:safe(r[vk])||0 }))
    .filter(p=>p.y>0).sort((a,b)=>b.y-a.y);
  if (slices.length>10) {
    const tail = slices.slice(10).reduce((s,p)=>s+p.y,0);
    slices = [...slices.slice(0,10), { name:'Other', y:tail, color:'#1c3050' }];
  }
  slices = slices.map((p,i)=>({ ...p, color:p.color??PAL[i%PAL.length] }));
  return {
    ...BASE, chart:{ ...BASE.chart, type:'pie' },
    title:{ text:title, style:{ color:'#8ab5a8', fontSize:'12px' } },
    plotOptions:{ pie:{
      innerSize:'38%', borderColor:'#060d14', borderWidth:2,
      allowPointSelect:true, cursor:'pointer', showInLegend:data.length>6,
      dataLabels:{ enabled:true, distance:16,
        format:'<span style="color:{point.color};font-family:Fira Code,monospace;font-size:11px">{point.name}</span><br/><b>{point.percentage:.1f}%</b>',
        style:{ color:'#e8f4f0', fontSize:'11px', textOutline:'none', fontWeight:'400' },
        connectorColor:'rgba(14,232,200,0.15)' },
    } },
    legend:{ ...BASE.legend, enabled:data.length>6, maxHeight:80 },
    series:[{ name:fmt(vk), data:slices }],
  };
}

// ── Dispatcher ────────────────────────────────────────────────────────────
export function buildChartConfig(type, data, question='') {
  if (!Array.isArray(data)||!data.length) return null;
  const title = question.length>55 ? question.slice(0,52)+'…' : question;
  switch (type) {
    case 'bar':  return bar(data, title);
    case 'line': return line(data, title);
    case 'pie':  return pie(data, title);
    default:     return null;
  }
}

export { bar as buildBarConfig, line as buildLineConfig, pie as buildPieConfig };