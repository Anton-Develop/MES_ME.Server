import { useState, useEffect } from "react";

const PLANS = [
  {
    id: 1, planName: 'План №1047', furnace: 'Печь №1',
    date: '2025-04-15', time: '08:00', status: 'В работе',
    sheets: [
      { id:101, melt:'102247', batch:'404', pack:'14', sheet:'343', grade:'А3',    thick:4.2, width:2000, len:8000, wt:530.4, status:'В работе',  loc:'Зона 1' },
      { id:102, melt:'102247', batch:'404', pack:'14', sheet:'344', grade:'А3',    thick:4.2, width:2000, len:8000, wt:530.4, status:'В работе',  loc:'Зона 2' },
      { id:103, melt:'102247', batch:'404', pack:'14', sheet:'345', grade:'А3',    thick:4.2, width:2000, len:8000, wt:530.4, status:'В работе',  loc:'Зона 3' },
      { id:104, melt:'102247', batch:'404', pack:'14', sheet:'346', grade:'А3',    thick:4.2, width:2000, len:8000, wt:530.4, status:'В работе',  loc:'Закалка' },
      { id:105, melt:'102247', batch:'404', pack:'14', sheet:'347', grade:'А3',    thick:4.2, width:2000, len:8000, wt:530.4, status:'Ожидание', loc:'' },
      { id:106, melt:'102247', batch:'404', pack:'14', sheet:'348', grade:'А3',    thick:4.2, width:2000, len:8000, wt:530.4, status:'Ожидание', loc:'' },
      { id:107, melt:'102247', batch:'404', pack:'15', sheet:'349', grade:'А3',    thick:4.2, width:2000, len:8000, wt:530.4, status:'Ожидание', loc:'' },
      { id:108, melt:'102247', batch:'404', pack:'15', sheet:'350', grade:'А3',    thick:4.2, width:2000, len:8000, wt:530.4, status:'Ожидание', loc:'' },
    ],
  },
  {
    id: 2, planName: 'План №1048', furnace: 'Печь №1',
    date: '2025-04-15', time: '14:30', status: 'Ожидание',
    sheets: [
      { id:201, melt:'102248', batch:'405', pack:'01', sheet:'001', grade:'09Г2С', thick:6.0, width:1800, len:9000, wt:763.0, status:'Ожидание', loc:'' },
      { id:202, melt:'102248', batch:'405', pack:'01', sheet:'002', grade:'09Г2С', thick:6.0, width:1800, len:9000, wt:763.0, status:'Ожидание', loc:'' },
      { id:203, melt:'102248', batch:'405', pack:'01', sheet:'003', grade:'09Г2С', thick:6.0, width:1800, len:9000, wt:763.0, status:'Ожидание', loc:'' },
      { id:204, melt:'102248', batch:'405', pack:'01', sheet:'004', grade:'09Г2С', thick:6.0, width:1800, len:9000, wt:763.0, status:'Ожидание', loc:'' },
      { id:205, melt:'102248', batch:'405', pack:'01', sheet:'005', grade:'09Г2С', thick:6.0, width:1800, len:9000, wt:763.0, status:'Ожидание', loc:'' },
    ],
  },
  {
    id: 3, planName: 'План №1049', furnace: 'Печь №1',
    date: '2025-04-16', time: '06:00', status: 'Создан',
    sheets: [
      { id:301, melt:'102249', batch:'406', pack:'01', sheet:'001', grade:'S355', thick:8.0, width:2000, len:10000, wt:1256.0, status:'Ожидание', loc:'' },
      { id:302, melt:'102249', batch:'406', pack:'01', sheet:'002', grade:'S355', thick:8.0, width:2000, len:10000, wt:1256.0, status:'Ожидание', loc:'' },
      { id:303, melt:'102249', batch:'406', pack:'01', sheet:'003', grade:'S355', thick:8.0, width:2000, len:10000, wt:1256.0, status:'Ожидание', loc:'' },
    ],
  },
];

const C = {
  bg:'#0d1117',panel:'#161b22',panelBd:'#30363d',
  text:'#e6edf3',dim:'#7d8590',accent:'#58a6ff',
  green:'#3fb950',red:'#f85149',yellow:'#d29922',
  water:'#2980b9',roller:'#484f58',rollerBd:'#6e7681',display:'#010409',
};
const ZONE_FILLS   = ['#7f1d1d','#7c2d12','#713f12','#3b2f0c'];
const ZONE_STROKES = ['#dc2626','#ea580c','#ca8a04','#a16207'];
const ZONE_TEXT    = ['#fca5a5','#fdba74','#fde68a','#fef08a'];

const statusColor = s => ({
  'В работе':'#3fb950','На рольганге':'#58a6ff','Завершён':'#7d8590',
  'Ожидание':'#d29922','Создан':'#8b949e',
}[s] ?? '#f85149');

const Led = ({on,color='#3fb950',size=11}) => (
  <span style={{
    display:'inline-block',width:size,height:size,borderRadius:'50%',
    background:on?color:'#2a2a2a',boxShadow:on?`0 0 6px ${color}`:'none',flexShrink:0,
  }}/>
);
const Seg = ({value,unit='',width=90}) => (
  <div style={{
    background:C.display,border:'1px solid #1c6ca8',borderRadius:3,
    padding:'2px 6px',minWidth:width,textAlign:'right',display:'inline-block',
  }}>
    <span style={{fontFamily:'monospace',fontSize:14,color:'#4fc3f7',fontWeight:700}}>{value}</span>
    {unit&&<span style={{fontSize:9,color:C.dim,marginLeft:3}}>{unit}</span>}
  </div>
);
const Btn = ({label,color='#1f4068',onClick,disabled}) => (
  <button onClick={onClick} disabled={disabled} style={{
    background:disabled?'#21262d':color,color:disabled?C.dim:C.text,
    border:`1px solid ${disabled?C.panelBd:color}`,borderRadius:4,
    padding:'5px 9px',fontSize:11,cursor:disabled?'default':'pointer',
    fontFamily:'monospace',fontWeight:600,whiteSpace:'nowrap',
  }}>{label}</button>
);

// SVG helpers
const Rollers = ({x,y,count,w=17,gap=5,h=28}) => (
  <>{Array.from({length:count}).map((_,i)=>(
    <g key={i}>
      <rect x={x+i*(w+gap)} y={y} width={w} height={h} rx={w/2}
        fill={C.roller} stroke={C.rollerBd} strokeWidth={1}/>
      <circle cx={x+i*(w+gap)+w/2} cy={y+h/2} r={3}
        fill="none" stroke={C.rollerBd} strokeWidth={1.5}/>
    </g>
  ))}</>
);

const SheetRect = ({x,y,w,h=15,label,color}) => (
  <g>
    <rect x={x} y={y} width={w} height={h} rx={2}
      fill={color} stroke="#8b949e" strokeWidth={1} opacity={0.9}/>
    {label&&<text x={x+w/2} y={y+h/2+3.5} textAnchor="middle"
      fill="#e6edf3" fontSize={7.5} fontFamily="monospace">{label}</text>}
  </g>
);

// 9 nozzles in a row
const Nozzles9 = ({x,y,active,side}) => (
  <>{Array.from({length:9}).map((_,i)=>{
    const cx = x+i*13+6;
    const tipY = side==='top' ? y+10 : y-10;
    return (
      <g key={i}>
        <polygon
          points={`${cx-4},${y} ${cx+4},${y} ${cx},${tipY}`}
          fill={active?C.water:'#2a2a2a'}
          stroke={active?'#60a5fa':'#444'} strokeWidth={0.5}
        />
        {active&&<line x1={cx} y1={tipY} x2={cx} y2={side==='top'?tipY+8:tipY-8}
          stroke={C.water} strokeWidth={1.5} strokeDasharray="2,2" opacity={0.7}/>}
      </g>
    );
  })}</>
);

export default function QuenchingHMI() {
  const [time,setTime]             = useState(new Date());
  const [plans,setPlans]           = useState(PLANS);
  const [selectedPlan,setSelPlan]  = useState(PLANS[0]);
  const [selSheetId,setSelSheet]   = useState(null);
  const [inputSheet,setInputSheet] = useState(null);
  const [temps,setTemps]           = useState([855,918,921,903]);
  const [coolT,setCoolT]           = useState(19);
  const [running,setRunning]       = useState(true);

  useEffect(()=>{
    const id=setInterval(()=>{
      setTime(new Date());
      setTemps(t=>t.map(v=>Math.round((v+(Math.random()-.5)*2)*10)/10));
      setCoolT(t=>Math.round((t+(Math.random()-.5)*.4)*10)/10);
    },1500);
    return ()=>clearInterval(id);
  },[]);

  const allSheets = plans.flatMap(p=>p.sheets);
  const inLoc = loc => allSheets.find(s=>s.loc===loc);
  const z = [1,2,3,4].map(i=>inLoc(`Зона ${i}`));
  const qS = inLoc('Закалка'), cS = inLoc('Охл.');

  const planSheets = plans.find(p=>p.id===selectedPlan?.id)?.sheets ?? [];
  const selSheet   = planSheets.find(s=>s.id===selSheetId);

  const addToConveyor = () => {
    if(!selSheetId||inputSheet) return;
    const sh = allSheets.find(s=>s.id===selSheetId);
    if(!sh||sh.status!=='Ожидание') return;
    setInputSheet(sh);
    setPlans(prev=>prev.map(p=>({...p,sheets:p.sheets.map(s=>
      s.id===selSheetId?{...s,status:'На рольганге',loc:'Вход'}:s)})));
    setSelSheet(null);
  };

  const loadToFurnace = () => {
    if(!inputSheet) return;
    const free = ['Зона 1','Зона 2','Зона 3','Зона 4'].find(z=>!inLoc(z));
    if(!free) return;
    setPlans(prev=>prev.map(p=>({...p,sheets:p.sheets.map(s=>
      s.id===inputSheet.id?{...s,status:'В работе',loc:free}:s)})));
    setInputSheet(null);
  };

  // SVG layout
  const svgW=1020, svgH=240;
  const rY=138, rH=28, rW=16, rGap=5;
  const inX=12,  inN=5;
  const fX=115,  zW=118, zGap=2, furnW=4*zW+3*zGap;
  const qX=fX+furnW+16, qW=132;
  const outX=qX+qW+16, outN=6;
  const finX=outX+outN*(rW+rGap)+14, finN=4;
  const zoneX = i => fX+i*(zW+zGap);

  const fmt = d => d.toTimeString().slice(0,8);

  const canAdd = selSheetId && selSheet?.status==='Ожидание' && !inputSheet;

  return (
    <div style={{background:C.bg,color:C.text,fontFamily:"'Courier New',monospace",minHeight:'100vh',padding:10,fontSize:12}}>

      {/* TOP BAR */}
      <div style={{display:'flex',gap:8,flexWrap:'wrap',alignItems:'stretch',
        background:C.panel,border:`1px solid ${C.panelBd}`,borderRadius:6,padding:'7px 12px',marginBottom:8}}>
        <div style={{display:'flex',flexDirection:'column',gap:4,justifyContent:'center',minWidth:165}}>
          {[
            {on:false,color:C.red,  label:'Аварийный останов'},
            {on:false,color:C.red,  label:'Блокировка нагрева'},
            {on:running,color:C.green,label:'Готовность к запуску'},
            {on:!!inputSheet,color:C.accent,label:'Лист на рольганге'},
          ].map(({on,color,label})=>(
            <div key={label} style={{display:'flex',alignItems:'center',gap:6}}>
              <Led on={on} color={color}/><span style={{fontSize:10,color:C.dim}}>{label}</span>
            </div>
          ))}
        </div>
        <div style={{width:1,background:C.panelBd}}/>
        <div style={{display:'flex',flexDirection:'column',justifyContent:'center',gap:4}}>
          <span style={{fontSize:9,color:C.dim,letterSpacing:1}}>ТЕМПЕРАТУРЫ ЗОН НАГРЕВА</span>
          <div style={{display:'flex',gap:5}}>
            {temps.map((t,i)=>(
              <div key={i} style={{textAlign:'center'}}>
                <div style={{fontSize:9,color:ZONE_TEXT[i],marginBottom:2}}>Зона {i+1}</div>
                <Seg value={t} unit="°C" width={68}/>
              </div>
            ))}
          </div>
        </div>
        <div style={{width:1,background:C.panelBd}}/>
        <div style={{display:'flex',flexDirection:'column',justifyContent:'center',gap:3}}>
          <span style={{fontSize:9,color:C.dim,letterSpacing:1}}>ЛИСТ В ЗОНЕ 1</span>
          <div style={{display:'grid',gridTemplateColumns:'auto auto auto auto',gap:'2px 8px',fontSize:10}}>
            {['Плавка','Партия','Пачка','Лист'].map(l=>(
              <span key={l} style={{color:C.dim,fontSize:9}}>{l}</span>
            ))}
            {[z[0]?.melt||'──────',z[0]?.batch||'───',z[0]?.pack||'──',z[0]?.sheet||'────'].map((v,i)=>(
              <Seg key={i} value={v} width={i===0?74:44}/>
            ))}
          </div>
        </div>
        <div style={{width:1,background:C.panelBd}}/>
        <div style={{display:'flex',flexDirection:'column',justifyContent:'center',gap:3}}>
          <span style={{fontSize:9,color:C.dim}}>Марка / Толщ.</span>
          <Seg value={z[0]?.grade||'──'} width={58}/>
          <Seg value={z[0]?.thick??'─.─'} unit="мм" width={58}/>
        </div>
        <div style={{marginLeft:'auto',display:'flex',flexDirection:'column',justifyContent:'center',alignItems:'flex-end',gap:2}}>
          <span style={{fontSize:9,color:C.dim}}>Время</span>
          <span style={{fontSize:22,color:C.accent,fontWeight:700,letterSpacing:3}}>{fmt(time)}</span>
          <span style={{fontSize:9,color:C.dim}}>{new Date().toLocaleDateString('ru-RU')}</span>
        </div>
      </div>

      {/* MAIN ROW */}
      <div style={{display:'flex',gap:8,marginBottom:8}}>
        {/* PROCESS SVG */}
        <div style={{background:C.panel,border:`1px solid ${C.panelBd}`,borderRadius:6,padding:8,flex:1,minWidth:0}}>
          <div style={{fontSize:9,color:C.dim,marginBottom:3,letterSpacing:1}}>ТЕХНОЛОГИЧЕСКАЯ СХЕМА — ЛИНИЯ ЗАКАЛКИ</div>
          <svg width="100%" viewBox={`0 0 ${svgW} ${svgH}`} style={{display:'block'}}>
            <defs>
              {ZONE_FILLS.map((_,i)=>(
                <linearGradient key={i} id={`gz${i}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={ZONE_FILLS[i]} stopOpacity={0.8}/>
                  <stop offset="100%" stopColor={ZONE_FILLS[i]}/>
                </linearGradient>
              ))}
              <linearGradient id="gq" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#1e3a5f"/><stop offset="100%" stopColor="#1e40af"/>
              </linearGradient>
              <marker id="arr" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                <path d="M0,0 L6,3 L0,6 Z" fill={C.accent}/>
              </marker>
            </defs>

            {/* ground */}
            <line x1={8} y1={rY+rH+6} x2={svgW-8} y2={rY+rH+6} stroke={C.panelBd} strokeWidth={1}/>

            {/* INPUT CONVEYOR */}
            <text x={inX} y={rY-34} fill={C.dim} fontSize={10}>Входной рольганг</text>
            <Rollers x={inX} y={rY} count={inN} w={rW} gap={rGap} h={rH}/>
            {inputSheet&&<SheetRect x={inX+2} y={rY-14} w={inN*(rW+rGap)-6} h={14}
              label={`${inputSheet.melt}/${inputSheet.sheet}`} color={C.accent}/>}
            {inputSheet&&(
              <text x={inX} y={rY+rH+20} fill={C.green} fontSize={9} style={{cursor:'pointer'}}
                onClick={loadToFurnace}>▶ Загрузить в печь</text>
            )}

            {/* arrow in→furnace */}
            <line x1={inX+inN*(rW+rGap)+2} y1={rY+rH/2} x2={fX-4} y2={rY+rH/2}
              stroke={C.accent} strokeWidth={1.5} markerEnd="url(#arr)"/>

            {/* 4 ZONES */}
            {[0,1,2,3].map(i=>{
              const zx=zoneX(i), sh=z[i];
              return (
                <g key={i}>
                  <rect x={zx} y={rY-46} width={zW} height={rH+50} rx={3}
                    fill={`url(#gz${i})`} stroke={ZONE_STROKES[i]} strokeWidth={1.5}/>
                  <text x={zx+zW/2} y={rY-34} textAnchor="middle"
                    fill={ZONE_TEXT[i]} fontSize={9} fontWeight={700}>ЗОНА {i+1} НАГРЕВА</text>
                  <text x={zx+zW/2} y={rY-19} textAnchor="middle"
                    fill={ZONE_TEXT[i]} fontSize={13} fontWeight={700}>{temps[i]} °C</text>
                  {sh
                    ? <SheetRect x={zx+5} y={rY-3} w={zW-10} h={rH-4}
                        label={`${sh.melt} / ${sh.sheet}`} color={ZONE_FILLS[i]}/>
                    : <text x={zx+zW/2} y={rY+rH/2+4} textAnchor="middle"
                        fill="#3a3a3a" fontSize={9}>— пусто —</text>
                  }
                </g>
              );
            })}

            {/* furnace outer dashed border */}
            <rect x={fX-3} y={rY-50} width={furnW+6} height={rH+58} rx={4}
              fill="none" stroke="#444" strokeWidth={1} strokeDasharray="4,3"/>
            <text x={fX+furnW/2} y={rY+rH+32} textAnchor="middle"
              fill="#444" fontSize={9} letterSpacing={5}>П Е Ч Ь   З А К А Л К И</text>

            {/* arrow furnace→quench */}
            <line x1={fX+furnW+4} y1={rY+rH/2} x2={qX-4} y2={rY+rH/2}
              stroke={C.accent} strokeWidth={1.5} markerEnd="url(#arr)"/>

            {/* QUENCHING SECTION */}
            <rect x={qX} y={rY-46} width={qW} height={rH+50} rx={3}
              fill="url(#gq)" stroke="#3b82f6" strokeWidth={1.5}/>
            <text x={qX+qW/2} y={rY-34} textAnchor="middle"
              fill="#93c5fd" fontSize={9} fontWeight={700}>ЗАКАЛКА</text>
            <text x={qX+qW/2} y={rY-22} textAnchor="middle"
              fill="#60a5fa" fontSize={8}>9 × 9 клапанов</text>

            {/* 9 nozzles top */}
            <Nozzles9 x={qX+4} y={rY-12} active={running&&!!qS} side="top"/>
            {/* 9 nozzles bottom */}
            <Nozzles9 x={qX+4} y={rY+rH+6} active={running&&!!qS} side="bottom"/>

            {qS
              ? <SheetRect x={qX+5} y={rY-2} w={qW-10} h={rH-4}
                  label={`${qS.melt} / ${qS.sheet}`} color="#1e3a8a"/>
              : <text x={qX+qW/2} y={rY+rH/2+4} textAnchor="middle"
                  fill="#2a2a4a" fontSize={9}>— пусто —</text>
            }
            <text x={qX+qW/2} y={rY+rH+24} textAnchor="middle"
              fill={C.water} fontSize={8}>0.1 бар</text>

            {/* arrow quench→cooling */}
            <line x1={qX+qW+4} y1={rY+rH/2} x2={outX-4} y2={rY+rH/2}
              stroke={C.accent} strokeWidth={1.5} markerEnd="url(#arr)"/>

            {/* COOLING */}
            <text x={outX} y={rY-34} fill={C.dim} fontSize={10}>Рольганг охлаждения</text>
            <Rollers x={outX} y={rY} count={outN} w={rW} gap={rGap} h={rH}/>
            {cS&&<SheetRect x={outX+2} y={rY-14} w={outN*(rW+rGap)-6} h={14}
              label={`${cS.melt}/${cS.sheet}`} color="#0e4a6b"/>}
            <text x={outX+outN*(rW+rGap)/2} y={rY+rH+20} textAnchor="middle"
              fill={C.dim} fontSize={9}>{coolT} °C</text>

            {/* arrow cooling→output */}
            <line x1={outX+outN*(rW+rGap)+4} y1={rY+rH/2} x2={finX-4} y2={rY+rH/2}
              stroke={C.accent} strokeWidth={1.5} markerEnd="url(#arr)"/>

            {/* OUTPUT */}
            <text x={finX} y={rY-34} fill={C.dim} fontSize={10}>Выдача</text>
            <Rollers x={finX} y={rY} count={finN} w={rW} gap={rGap} h={rH}/>

            {/* ZONE STATUS LEFT LEGEND */}
            {[
              {label:'Вход. рольганг',sheet:inputSheet,color:C.accent},
              {label:'Зона 1',sheet:z[0],color:'#f87171'},
              {label:'Зона 2',sheet:z[1],color:'#fb923c'},
              {label:'Зона 3',sheet:z[2],color:'#fbbf24'},
              {label:'Зона 4',sheet:z[3],color:'#a3e635'},
              {label:'Закалка',sheet:qS,color:'#60a5fa'},
              {label:'Охлаждение',sheet:cS,color:'#34d399'},
            ].map(({label,sheet,color},i)=>(
              <g key={i}>
                <circle cx={16} cy={16+i*23} r={5}
                  fill={sheet?color:'#21262d'} stroke={color} strokeWidth={1}
                  style={sheet?{filter:`drop-shadow(0 0 3px ${color})`}:{}}/>
                <text x={26} y={20+i*23} fill={C.dim} fontSize={9}>{label}</text>
                <text x={100} y={20+i*23} fill={sheet?C.text:C.dim} fontSize={9} fontFamily="monospace">
                  {sheet?`${sheet.melt} / ${sheet.sheet}`:'─────────────'}
                </text>
              </g>
            ))}
          </svg>
        </div>
<div></div>
        {/* RIGHT CONTROL PANEL */}
        <div style={{background:C.panel,border:`1px solid ${C.panelBd}`,borderRadius:6,
          padding:10,width:178,display:'flex',flexDirection:'column',gap:6}}>
          <div style={{fontSize:9,color:C.dim,letterSpacing:1,borderBottom:`1px solid ${C.panelBd}`,paddingBottom:4}}>
            НАПОРНЫЕ КЛАПАНА
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:'2px 5px',fontSize:9,textAlign:'center'}}>
            {['Скор.','Лам.1','Лам.2','Верх','Верх','Верх'].map((l,i)=>(
              <span key={i} style={{color:C.dim}}>{l}</span>
            ))}
            {[2.00,3.00,3.00].map((v,i)=><Seg key={i} value={v.toFixed(2)} width={44}/>)}
            {['Низ','Низ','Низ'].map((l,i)=><span key={i} style={{color:C.dim}}>{l}</span>)}
            {[10.00,10.00,10.00].map((v,i)=><Seg key={i} value={v.toFixed(2)} width={44}/>)}
          </div>
          <div style={{borderTop:`1px solid ${C.panelBd}`,paddingTop:5,display:'flex',flexDirection:'column',gap:5}}>
            <Btn label="Все в АВТО"     color="#1a4731"/>
            <Btn label="▶  СТАРТ"       color="#145a32" onClick={()=>setRunning(true)}  disabled={running}/>
            <Btn label="■  Стоп нагрев" color="#5a1414" onClick={()=>setRunning(false)} disabled={!running}/>
            <Btn label="Стоп охл."      color="#1a3a5a"/>
          </div>
          <div style={{borderTop:`1px solid ${C.panelBd}`,paddingTop:5,display:'flex',flexDirection:'column',gap:5}}>
            <Btn label="▶ В ПЕЧЬ" color={inputSheet?'#1e3a6e':'#21262d'}
              disabled={!inputSheet} onClick={loadToFurnace}/>
            <Btn label="В ЗАКАЛКУ" color="#21262d" disabled/>
            <Btn label="Рольганги" color="#2a2a2a"/>
          </div>
          <div style={{borderTop:`1px solid ${C.panelBd}`,paddingTop:5,display:'flex',flexDirection:'column',gap:4}}>
            {[['Скорость','850','мм/с'],['Уст.темп.','915.0','°C'],['Длина','3','м']].map(([l,v,u])=>(
              <div key={l} style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                <span style={{fontSize:10,color:C.dim}}>{l}</span>
                <Seg value={v} unit={u} width={68}/>
              </div>
            ))}
          </div>
          <div style={{borderTop:`1px solid ${C.panelBd}`,paddingTop:5,display:'flex',gap:4}}>
            <Btn label="КИП"    color="#1a2a4a"/>
            <Btn label="Тренды" color="#1a2a4a"/>
          </div>
          <Btn label="Сброс ошибок" color="#4a2a0a"/>
        </div>
      </div>

      {/* PLAN + SHEET TABLES */}
      <div style={{display:'flex',gap:8}}>

        {/* Plans list */}
        <div style={{background:C.panel,border:`1px solid ${C.panelBd}`,borderRadius:6,
          padding:10,width:290,flexShrink:0}}>
          <div style={{fontSize:11,color:C.accent,fontWeight:700,letterSpacing:1,marginBottom:8}}>
            ПЛАНЫ ЗАКАЛКИ
          </div>
          <div style={{display:'flex',flexDirection:'column',gap:4}}>
            {plans.map(plan=>{
              const sel=selectedPlan?.id===plan.id;
              const sc=statusColor(plan.status);
              return (
                <div key={plan.id}
                  onClick={()=>{setSelPlan(plan);setSelSheet(null);}}
                  style={{
                    background:sel?'#1f3a5a':'transparent',
                    border:`1px solid ${sel?C.accent:C.panelBd}`,
                    borderLeft:`3px solid ${sel?C.accent:'transparent'}`,
                    borderRadius:4,padding:'7px 10px',cursor:'pointer',transition:'all .12s',
                  }}
                >
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:3}}>
                    <span style={{fontWeight:700,fontSize:12}}>{plan.planName}</span>
                    <span style={{background:sc+'22',color:sc,border:`1px solid ${sc}`,
                      borderRadius:3,padding:'0 5px',fontSize:10}}>{plan.status}</span>
                  </div>
                  <div style={{display:'flex',gap:8,fontSize:10,color:C.dim,flexWrap:'wrap'}}>
                    <span>📅 {plan.date}</span>
                    <span>⏰ {plan.time}</span>
                    <span>📋 {plan.sheets.length} л.</span>
                    <span>{plan.furnace}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Sheet list */}
        <div style={{background:C.panel,border:`1px solid ${C.panelBd}`,borderRadius:6,padding:10,flex:1,minWidth:0}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
            <div style={{fontSize:11,color:C.accent,fontWeight:700,letterSpacing:1}}>
              {selectedPlan
                ? `СОСТАВ: ${selectedPlan.planName} — ${planSheets.length} листов`
                : 'ВЫБЕРИТЕ ПЛАН ИЗ СПИСКА'}
            </div>
            <button onClick={addToConveyor} disabled={!canAdd}
              style={{
                background:canAdd?'#1a4731':'#21262d',
                color:canAdd?C.green:C.dim,
                border:`1px solid ${canAdd?C.green:C.panelBd}`,
                borderRadius:4,padding:'6px 14px',fontSize:12,
                cursor:canAdd?'pointer':'default',
                fontFamily:'monospace',fontWeight:700,
              }}>
              ▶ Подать на входной рольганг
            </button>
          </div>

          {selectedPlan ? (
            <div style={{overflowX:'auto'}}>
              <table style={{width:'100%',borderCollapse:'collapse',fontSize:11}}>
                <thead>
                  <tr style={{borderBottom:`1px solid ${C.panelBd}`}}>
                    {['№','Плавка','Партия','Пачка','Лист','Марка','Толщ.','Ширина','Длина','Вес кг','Статус','Позиция'].map(h=>(
                      <th key={h} style={{padding:'3px 7px',color:C.dim,textAlign:'left',fontWeight:400,whiteSpace:'nowrap'}}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {planSheets.map((row,i)=>{
                    const sel=selSheetId===row.id;
                    const sc=statusColor(row.status);
                    return (
                      <tr key={row.id}
                        onClick={()=>row.status==='Ожидание'&&setSelSheet(sel?null:row.id)}
                        style={{
                          background:sel?'#1f3a5a':(i%2?'#161b22':'transparent'),
                          borderLeft:`3px solid ${sel?C.accent:'transparent'}`,
                          cursor:row.status==='Ожидание'?'pointer':'default',
                          opacity:row.status==='Завершён'?0.4:1,
                        }}
                      >
                        <td style={{padding:'3px 7px',color:C.dim}}>{i+1}</td>
                        <td style={{padding:'3px 7px',fontFamily:'monospace'}}>{row.melt}</td>
                        <td style={{padding:'3px 7px',fontFamily:'monospace'}}>{row.batch}</td>
                        <td style={{padding:'3px 7px',fontFamily:'monospace'}}>{row.pack}</td>
                        <td style={{padding:'3px 7px',fontFamily:'monospace',color:C.accent,fontWeight:700}}>{row.sheet}</td>
                        <td style={{padding:'3px 7px',color:C.yellow}}>{row.grade}</td>
                        <td style={{padding:'3px 7px',textAlign:'right'}}>{row.thick}</td>
                        <td style={{padding:'3px 7px',textAlign:'right'}}>{row.width}</td>
                        <td style={{padding:'3px 7px',textAlign:'right'}}>{row.len}</td>
                        <td style={{padding:'3px 7px',textAlign:'right',color:C.dim}}>{row.wt}</td>
                        <td style={{padding:'3px 7px'}}>
                          <span style={{background:sc+'22',color:sc,border:`1px solid ${sc}`,
                            borderRadius:3,padding:'0 5px',fontSize:10,whiteSpace:'nowrap'}}>{row.status}</span>
                        </td>
                        <td style={{padding:'3px 7px',color:row.loc?C.text:C.dim}}>{row.loc||'—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{color:C.dim,padding:20,textAlign:'center'}}>
              Выберите план закалки из списка слева
            </div>
          )}
        </div>
      </div>
    </div>
  );
}