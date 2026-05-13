import { useState, useEffect } from "react";
import { useOpcUa } from '../hooks/useOpcUa';
import api from '../api';

const C = {
  bg:'#0d1117', panel:'#161b22', panelBd:'#30363d',
  text:'#e6edf3', dim:'#7d8590', accent:'#58a6ff',
  green:'#3fb950', red:'#f85149', yellow:'#d29922',
  water:'#2980b9', roller:'#3a3f47', rollerBd:'#555d68', display:'#010409',
};
const ZONE_FILL   = ['#7f1d1d','#7c2d12','#713f12','#3b3009'];
const ZONE_STROKE = ['#dc2626','#ea580c','#ca8a04','#a16207'];
const ZONE_LABEL  = ['#fca5a5','#fdba74','#fde68a','#fef08a'];

const statusColor = s => ({
  'В работе':'#3fb950','На рольганге':'#58a6ff',
  'Завершён':'#7d8590','Ожидание':'#d29922','Создан':'#8b949e',
}[s] ?? '#f85149');

const toBool = v => v === true || v === 1 || v === '1' || v === 'true';
const toStr  = v => (v === null || v === undefined) ? '—' : String(v);

// ── Primitives ─────────────────────────────────────────────────────────────
const Led = ({on, color='#3fb950', size=10}) => (
  <span style={{
    display:'inline-block', width:size, height:size, borderRadius:'50%',
    background: on ? color : '#252a30',
    boxShadow: on ? `0 0 5px ${color}` : 'none', flexShrink:0,
  }}/>
);

const Seg = ({value, unit='', width=70}) => (
  <div style={{
    background:C.display, border:'1px solid #1c6ca8', borderRadius:3,
    padding:'2px 5px', minWidth:width, textAlign:'right',
    display:'inline-flex', alignItems:'center', justifyContent:'flex-end', gap:3,
  }}>
    <span style={{fontFamily:'monospace', fontSize:13, color:'#4fc3f7', fontWeight:700}}>{value}</span>
    {unit && <span style={{fontSize:14, color:C.dim}}>{unit}</span>}
  </div>
);

const SvgSeg = ({x, y, value, unit='', w=46, h=18}) => (
  <g>
    <rect x={x} y={y} width={w} height={h} rx={2} fill={C.display} stroke="#1c6ca8" strokeWidth={1}/>
    <text x={x+w-4} y={y+h/2+4} textAnchor="end" fill="#4fc3f7"
      fontSize={10} fontFamily="monospace" fontWeight={700}>{value}</text>
    {unit && <text x={x+w+2} y={y+h/2+4} fill={C.dim} fontSize={8}>{unit}</text>}
  </g>
);

// ── SVG helpers ─────────────────────────────────────────────────────────────
const Rollers = ({x, y, count, w=16, gap=5, h=30}) => (
  <>{Array.from({length:count}).map((_,i) => (
    <g key={i}>
      <rect x={x+i*(w+gap)} y={y} width={w} height={h} rx={w/2}
        fill={C.roller} stroke={C.rollerBd} strokeWidth={1}/>
      <circle cx={x+i*(w+gap)+w/2} cy={y+h/2} r={3}
        fill="none" stroke={C.rollerBd} strokeWidth={1.5}/>
    </g>
  ))}</>
);

const SheetRect = ({x, y, w, h=16, label, color}) => (
  <g>
    <rect x={x} y={y} width={w} height={h} rx={2}
      fill={color} stroke="#8b949e" strokeWidth={1} opacity={0.92}/>
    {label && <text x={x+w/2} y={y+h/2+3.5} textAnchor="middle"
      fill="#e6edf3" fontSize={8} fontFamily="monospace" fontWeight={600}>{label}</text>}
  </g>
);

const Nozzles9 = ({x, y, active, side}) => (
  <>{Array.from({length:9}).map((_,i) => {
    const cx  = x + i*13 + 6;
    const tipY = side==='top' ? y+10 : y-10;
    return (
      <g key={i}>
        <polygon
          points={`${cx-4},${y} ${cx+4},${y} ${cx},${tipY}`}
          fill={active ? C.water : '#252a30'}
          stroke={active ? '#60a5fa' : '#333'} strokeWidth={0.5}
        />
        {active && <line x1={cx} y1={tipY} x2={cx}
          y2={side==='top' ? tipY+9 : tipY-9}
          stroke={C.water} strokeWidth={1.5} strokeDasharray="2,2" opacity={0.7}/>}
      </g>
    );
  })}</>
);

// ── Animated flow arrow ─────────────────────────────────────────────────────
const FlowArrow = ({x1, y1, x2, y2, active}) => (
  <line
    x1={x1} y1={y1} x2={x2} y2={y2}
    stroke={active ? '#3fb950' : '#58a6ff'}
    strokeWidth={active ? 2.5 : 1.5}
    strokeDasharray={active ? '6 4' : 'none'}
    markerEnd="url(#arr)"
    style={active ? {animation:'dashMove 0.4s linear infinite'} : {}}
  />
);

// ── Main ────────────────────────────────────────────────────────────────────
export default function QuenchingHMI() {
  const [time, setTime]                   = useState(new Date());
  const [selSheetId, setSelSheet]         = useState(null);
  const [inputSheet, setInputSheet]       = useState(null);
  const [coolT, setCoolT]                 = useState(19.1);
  const [running, setRunning]             = useState(true); // eslint-disable-line no-unused-vars
  const [loading, setLoading]             = useState(true);
  const [sheetsLoading, setSheetsLoading] = useState(false);
  const [error, setError]                 = useState(null);
  const [selectedPlan, setSelectedPlan]   = useState(null);
  const [plans, setPlans]                 = useState([]);
  const [submitting , setsubmitting]      = useState(false);

  // ── Live tracking state (derived from OPC, triggers re-render properly) ──
  const [liveData, setLiveData] = useState({
    entry:   null,
    furnace: [null, null, null, null],
    quench:  null,   // X1
    cool:    null,   // X1 (тот же лист)
    output:  null,   // X2
    arrows: {
      toFurnace: false,
      zones: [false, false, false, false],
    },
  });

  // ── OPC UA ──────────────────────────────────────────────────────────────
  const { values, connected, write } = useOpcUa([
    'T_F1_MedAct','T_F2_MedAct','T_F3_MedAct','T_F4_MedAct',
    'E1_Ocp','E1_Melt','E1_PartNo','E1_Pack','E1_Sheet',
    'F1_ZoneOccup','F1_InArrow','F1_OutArrow','F1_Melt','F1_PartNo','F1_Pack','F1_Sheet',
    'F2_ZoneOccup','F2_OutArrow','F2_Melt','F2_PartNo','F2_Pack','F2_Sheet',
    'F3_ZoneOccup','F3_OutArrow','F3_Melt','F3_PartNo','F3_Pack','F3_Sheet',
    'F4_ZoneOccup','F4_OutArrow','F4_Melt','F4_PartNo','F4_Pack','F4_Sheet',
    'X1_ZoneOccup','X1_Melt','X1_PartNo','X1_Pack','X1_Sheet',
    'X2_ZoneOccup','X2_Melt','X2_PartNo','X2_Pack','X2_Sheet',
  ]);

  // ── Пересчёт liveData при любом изменении values ─────────────────────
  // Создаём новый объект → React видит изменение → ре-рендер
  useEffect(() => {
    const makeSheet = (prefix) => {
      const occ = toBool(values[`${prefix}_ZoneOccup`]?.value ?? values[`${prefix}_Ocp`]?.value);
      if (!occ) return null;
      return {
        melt:  toStr(values[`${prefix}_Melt`]?.value),
        sheet: toStr(values[`${prefix}_Sheet`]?.value),
        pack:  toStr(values[`${prefix}_Pack`]?.value),
        batch: toStr(values[`${prefix}_PartNo`]?.value),
      };
    };

    const entryOcc = toBool(values['E1_Ocp']?.value);
    const entrySheet = entryOcc ? {
      melt:  toStr(values['E1_Melt']?.value),
      sheet: toStr(values['E1_Sheet']?.value),
      pack:  toStr(values['E1_Pack']?.value),
      batch: toStr(values['E1_PartNo']?.value),
    } : null;

    const x1Sheet = makeSheet('X1');  // X1 = закалка + охлаждение

    setLiveData({
      entry:   entrySheet,
      furnace: [1,2,3,4].map(i => makeSheet(`F${i}`)),
      quench:  x1Sheet,   // закалка
      cool:    x1Sheet,   // охлаждение (тот же лист в секции X1)
      output:  makeSheet('X2'),  // X2 = выдача рольганг
      arrows: {
        toFurnace: toBool(values['F1_InArrow']?.value),
        zones: [1,2,3,4].map(i => toBool(values[`F${i}_OutArrow`]?.value)),
      },
    });
  }, [values]);

  // ── Temperatures ─────────────────────────────────────────────────────────
  const realTemps = [
    Math.round(values['T_F1_MedAct']?.value ?? 0),
    Math.round(values['T_F2_MedAct']?.value ?? 0),
    Math.round(values['T_F3_MedAct']?.value ?? 0),
    Math.round(values['T_F4_MedAct']?.value ?? 0),
  ];

  const setZoneTemp = async (zone, temp) => {
    const ok = await write(`z${zone}_setpoint`, temp);
    console.log('Write result:', ok);
  }; // eslint-disable-line no-unused-vars

  // ── API ──────────────────────────────────────────────────────────────────
  const fetchPlans = async () => {
    try {
      setLoading(true);
      const response = await api.get('/quenchinghmi/plans');
      setPlans(response.data);
      setError(null);
    } catch (err) {
      console.error('Ошибка при загрузке планов:', err);
      setError(err.message);
      setPlans([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchPlanSheets = async (planId) => {
    try {
      setSheetsLoading(true);
      const response = await api.get(`/quenchinghmi/plans/${planId}/sheets`);
      if (response.status < 200 || response.status >= 300)
        throw new Error(`Ошибка загрузки листов плана ${planId}: ${response.status}`);
      const basePlan = plans.find(p => p.id === planId);
      setSelectedPlan({ ...basePlan, sheets: response.data });
    } catch (err) {
      console.error('Ошибка при загрузке листов плана:', err);
      setError(err.message);
      setSelectedPlan(null);
    } finally {
      setSheetsLoading(false);
    }
  };

  useEffect(() => { fetchPlans(); }, []);


 const addToConveyor = async () => {
    if (!canAdd || submitting) return;
    setsubmitting(true);
    try {
      await api.post('quenchinghmi/write-entry', {
        EntrPlateData_Melt: selSheet.melt,
        EntrPlateData_PartNo: selSheet.batch,
        EntrPlateData_Pack: selSheet.pack,
        EntrPlateData_Sheet: selSheet.sheet,
        UniqueId: selSheet.UniqueId,
      });
      setInputSheet(selSheet);
      setSelectedPlan(prev => ({
      ...prev,
      sheets: prev.sheets.map(s =>
        s.id === selSheetId ? {...s, status:'На рольганге', loc:'Вход'} : s
      ),
    }));
    setSelSheet(null);
    } catch (err) {
      setError ('Ошибка подачи листа: ${err.message}');
      
    }
    finally {
      setsubmitting(false)
    }   
  };


  // ── Clock + coolant temp sim ─────────────────────────────────────────────
  useEffect(() => {
    const id = setInterval(() => {
      setTime(new Date());
      setCoolT(t => Math.round((t + (Math.random() - 0.5) * 0.4) * 10) / 10);
    }, 10000);
    return () => clearInterval(id);
  }, []);

  // ── Plan / sheet helpers ─────────────────────────────────────────────────
  const handleSelectPlan = (plan) => {
    setSelectedPlan(plan);
    fetchPlanSheets(plan.id);
    setSelSheet(null);
  };

  const allSheets  = selectedPlan?.sheets ?? [];
  const inLoc      = loc => allSheets.find(s => s.loc === loc);
  const planSheets = selectedPlan?.sheets ?? [];
  const selSheet   = planSheets.find(s => s.id === selSheetId);
  const canAdd     = !!selSheetId && selSheet?.status === 'Ожидание' && !inputSheet;

  // SVG-источник: OPC live имеет приоритет, план — fallback
  const zones     = liveData.furnace.map((live, i) => live ?? inLoc(`Зона ${i+1}`));
  const qS        = liveData.quench  ?? inLoc('Закалка');
  const cS        = liveData.cool    ?? inLoc('Охл.');
  const svgEntry  = liveData.entry   ?? inputSheet;  // вход рольганг

 

  const loadToFurnace = () => {
    if (!inputSheet) return;
    const free = ['Зона 1','Зона 2','Зона 3','Зона 4'].find(z => !inLoc(z));
    if (!free) return;
    setSelectedPlan(prev => ({
      ...prev,
      sheets: prev.sheets.map(s =>
        s.id === inputSheet.id ? {...s, status:'В работе', loc:free} : s
      ),
    }));
    setInputSheet(null);
  };

  const fmt = d => d.toTimeString().slice(0,8);

  // ── SVG layout constants ─────────────────────────────────────────────────
  const VW = 1000, VH = 230;
  const rY = 110, rH = 30, rW = 16, rGap = 5;

  const inX  = 10,  inN = 5;
  const fX   = inX + inN*(rW+rGap) + 22;
  const zW   = 118, zGap = 2, furnW = 4*zW + 3*zGap;
  const qX   = fX + furnW + 20;
  const qW   = 126;
  const outX = qX + qW + 20;
  const outN = 6;
  const finX = outX + outN*(rW+rGap) + 18;
  const finN = 4;

  const zoneX = i => fX + i*(zW+zGap);

  const presX = outX - 4;
  const presY = rY - 56;

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div style={{
      background:C.bg, color:C.text, fontFamily:"'Courier New',monospace",
      minHeight:'100vh', padding:10, fontSize:14, boxSizing:'border-box',
    }}>

      {/* ══ TOP BAR ═══════════════════════════════════════════════════════ */}
      <div style={{
        display:'flex', gap:10, alignItems:'center', flexWrap:'nowrap',
        background:C.panel, border:`1px solid ${C.panelBd}`,
        borderRadius:6, padding:'7px 12px', marginBottom:8,
      }}>

        {/* 1. LED indicators */}
        <div style={{display:'flex', flexDirection:'column', gap:4, flexShrink:0, minWidth:155}}>
          {[
            {on:false,           color:C.red,    label:'Аварийный останов'},
            {on:false,           color:C.red,    label:'Блокировка нагрева'},
            {on:running,         color:C.green,  label:'Готовность к запуску'},
            {on:!!svgEntry,      color:C.accent, label:'Лист на рольганге'},
          ].map(({on,color,label}) => (
            <div key={label} style={{display:'flex', alignItems:'center', gap:6}}>
              <Led on={on} color={color}/>
              <span style={{fontSize:14, color:C.dim}}>{label}</span>
            </div>
          ))}
        </div>

        <div style={{width:1, height:48, background:C.panelBd, flexShrink:0}}/>

        {/* 2. Zone temps */}
        <div style={{flexShrink:0}}>
          <div style={{fontSize:14, color:C.dim, letterSpacing:1, marginBottom:3}}>ТЕМП. ЗОН</div>
          <div style={{display:'flex', gap:5}}>
            {realTemps.map((t,i) => (
              <div key={i} style={{textAlign:'center'}}>
                <div style={{fontSize:14, color:ZONE_LABEL[i], marginBottom:2}}>З{i+1}</div>
                <Seg value={t} unit="°C" width={62}/>
              </div>
            ))}
          </div>
        </div>

        <div style={{width:1, height:48, background:C.panelBd, flexShrink:0}}/>

        {/* 3. Current sheet info (зона 1) */}
        <div style={{flexShrink:0}}>
          <div style={{fontSize:14, color:C.dim, letterSpacing:1, marginBottom:3}}>ЛИСТ В ЗОНЕ 1</div>
          <div style={{display:'grid', gridTemplateColumns:'repeat(4,auto)', gap:'2px 8px', alignItems:'center'}}>
            {['Плавка','Партия','Пачка','Лист'].map(l => (
              <span key={l} style={{fontSize:14, color:C.dim}}>{l}</span>
            ))}
            {[zones[0]?.melt||'──────', zones[0]?.batch||'───', zones[0]?.pack||'──', zones[0]?.sheet||'────'].map((v,i) => (
              <Seg key={i} value={v} width={i===0?68:40}/>
            ))}
          </div>
        </div>

        <div style={{width:1, height:48, background:C.panelBd, flexShrink:0}}/>

        {/* 4. Grade + thick */}
        <div style={{flexShrink:0}}>
          <div style={{fontSize:14, color:C.dim, marginBottom:3}}>Марка / Толщ.</div>
          <Seg value={zones[0]?.grade||'──'} width={52}/>
          <div style={{height:4}}/>
          <Seg value={zones[0]?.thick??'─.─'} unit="мм" width={52}/>
        </div>

        <div style={{width:1, height:48, background:C.panelBd, flexShrink:0}}/>

        {/* 5. Параметры */}
        <div style={{flexShrink:0}}>
          <div style={{fontSize:14, color:C.dim, marginBottom:3}}>Параметры</div>
          <div style={{display:'flex', flexDirection:'column', gap:3}}>
            {[['Скорость','850','мм/с'],['Уст.темп.','915.0','°C'],['Длина','3','м']].map(([l,v,u]) => (
              <div key={l} style={{display:'flex', alignItems:'center', gap:6}}>
                <span style={{fontSize:10, color:C.dim, minWidth:62}}>{l}</span>
                <Seg value={v} unit={u} width={58}/>
              </div>
            ))}
          </div>
        </div>

        {/* 6. OPC status + clock */}
        <div style={{marginLeft:'auto', textAlign:'right', flexShrink:0}}>
          <div style={{display:'flex', alignItems:'center', gap:5, justifyContent:'flex-end', marginBottom:2}}>
            <Led on={connected} color={C.green} size={8}/>
            <span style={{fontSize:10, color: connected ? C.green : C.red}}>
            {/*  {connected ? 'OPC подключён' : 'OPC отключён'}*/}
            </span>
          </div>
          <div style={{fontSize:24, color:C.accent, fontWeight:700, letterSpacing:3}}>{fmt(time)}</div>
          <div style={{fontSize:14, color:C.dim}}>{new Date().toLocaleDateString('ru-RU')}</div>
        </div>
      </div>

      {/* ══ PROCESS PANEL ═════════════════════════════════════════════════ */}
      <div style={{
        background:C.panel, border:`1px solid ${C.panelBd}`,
        borderRadius:6, padding:'8px 10px', marginBottom:8,
        display:'flex', flexDirection:'column', gap:5,
      }}>
        <div style={{fontSize:14, color:C.dim, letterSpacing:1}}>
          ТЕХНОЛОГИЧЕСКАЯ СХЕМА — ЛИНИЯ ЗАКАЛКИ
        </div>

        {/* Zone strip */}
        <div style={{display:'flex', gap:5, flexWrap:'wrap'}}>
          {[
            {label:'Вход. рольганг', sheet:svgEntry,  color:C.accent},
            {label:'Зона 1',         sheet:zones[0],  color:'#f87171'},
            {label:'Зона 2',         sheet:zones[1],  color:'#fb923c'},
            {label:'Зона 3',         sheet:zones[2],  color:'#fbbf24'},
            {label:'Зона 4',         sheet:zones[3],  color:'#a3e635'},
            {label:'Закалка',        sheet:qS,         color:'#60a5fa'},
            {label:'Охлаждение',     sheet:cS,         color:'#34d399'},
            {label:'Выдача',         sheet:liveData.output, color:'#a78bfa'},
          ].map(({label, sheet, color}) => (
            <div key={label} style={{
              display:'flex', alignItems:'center', gap:5,
              background:'#0d1117', border:`1px solid ${C.panelBd}`,
              borderRadius:4, padding:'2px 7px', whiteSpace:'nowrap',
            }}>
              <span style={{
                width:7, height:7, borderRadius:'50%', flexShrink:0,
                display:'inline-block',
                background: sheet ? color : '#252a30',
                boxShadow: sheet ? `0 0 4px ${color}` : 'none',
              }}/>
              <span style={{fontSize:14, color:C.dim}}>{label}:</span>
              <span style={{fontSize:14, color: sheet ? C.text : C.dim, fontFamily:'monospace'}}>
                {sheet ? `${sheet.melt} / ${sheet.sheet}` : '—'}
              </span>
            </div>
          ))}
        </div>

        {/* ── SVG ───────────────────────────────────────────────────────── */}
        <svg width="100%" viewBox={`0 0 ${VW} ${VH}`} style={{display:'block'}}>
          <defs>
            <style>{`
              @keyframes dashMove { to { stroke-dashoffset: -20; } }
              .flow-active { animation: dashMove 0.4s linear infinite; }
            `}</style>
            {ZONE_FILL.map((_,i) => (
              <linearGradient key={i} id={`gz${i}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={ZONE_FILL[i]} stopOpacity={0.85}/>
                <stop offset="100%" stopColor={ZONE_FILL[i]}/>
              </linearGradient>
            ))}
            <linearGradient id="gq" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#1e3a5f"/>
              <stop offset="100%" stopColor="#1e40af"/>
            </linearGradient>
            <marker id="arr" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
              <path d="M0,0 L6,3 L0,6 Z" fill={C.accent}/>
            </marker>
            <marker id="arrGreen" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
              <path d="M0,0 L6,3 L0,6 Z" fill={C.green}/>
            </marker>
          </defs>

          {/* Ground */}
          <line x1={0} y1={rY+rH+6} x2={VW} y2={rY+rH+6}
            stroke={C.panelBd} strokeWidth={1}/>

          {/* ── INPUT CONVEYOR ── */}
          <text x={inX+inN*(rW+rGap)/2} y={rY-14} textAnchor="middle"
            fill={C.dim} fontSize={9}>Вход. рольганг</text>
          <Rollers x={inX} y={rY} count={inN} w={rW} gap={rGap} h={rH}/>
          {svgEntry && (
            <SheetRect x={inX+1} y={rY-13} w={inN*(rW+rGap)-4} h={13}
              label={`${svgEntry.melt}/${svgEntry.sheet}`} color={C.accent}/>
          )}
          {inputSheet && (
            <g style={{cursor:'pointer'}} onClick={loadToFurnace}>
              <rect x={inX} y={rY+rH+12} width={inN*(rW+rGap)} height={16}
                rx={3} fill="#145a32" stroke={C.green} strokeWidth={1}/>
              <text x={inX+inN*(rW+rGap)/2} y={rY+rH+23} textAnchor="middle"
                fill={C.green} fontSize={9} fontWeight={700}>▶ В ПЕЧЬ</text>
            </g>
          )}
          {!inputSheet && (
            <text x={inX+inN*(rW+rGap)/2} y={rY+rH+22} textAnchor="middle"
              fill="#333" fontSize={9}>▶ В ПЕЧЬ</text>
          )}

          {/* Arrow input → furnace */}
          <line
            x1={inX+inN*(rW+rGap)+2} y1={rY+rH/2}
            x2={fX-4}                 y2={rY+rH/2}
            stroke={liveData.arrows.toFurnace ? C.green : C.accent}
            strokeWidth={liveData.arrows.toFurnace ? 2.5 : 1.5}
            strokeDasharray={liveData.arrows.toFurnace ? '6 4' : 'none'}
            className={liveData.arrows.toFurnace ? 'flow-active' : ''}
            markerEnd={liveData.arrows.toFurnace ? 'url(#arrGreen)' : 'url(#arr)'}
          />

          {/* ── 4 FURNACE ZONES ── */}
          {[0,1,2,3].map(i => {
            const zx = zoneX(i);
            const sh = zones[i];
            const moving = liveData.arrows.zones[i];
            return (
              <g key={i}>
                <rect x={zx} y={rY-42} width={zW} height={rH+46} rx={3}
                  fill={`url(#gz${i})`}
                  stroke={sh ? ZONE_STROKE[i] : '#2a2a2a'}
                  strokeWidth={sh ? 2 : 1}
                  style={sh ? {filter:`drop-shadow(0 0 3px ${ZONE_STROKE[i]}55)`} : {}}
                />
                <text x={zx+zW/2} y={rY-30} textAnchor="middle"
                  fill={ZONE_LABEL[i]} fontSize={9} fontWeight={700}>ЗОНА {i+1} НАГРЕВА</text>
                <text x={zx+zW/2} y={rY-14} textAnchor="middle"
                  fill={ZONE_LABEL[i]} fontSize={13} fontWeight={700}>{realTemps[i]} °C</text>
                {sh
                  ? <SheetRect x={zx+5} y={rY-1} w={zW-10} h={rH-4}
                      label={`${sh.melt} / ${sh.sheet}`} color={ZONE_FILL[i]}/>
                  : <text x={zx+zW/2} y={rY+rH/2+4} textAnchor="middle"
                      fill="#333" fontSize={9}>— пусто —</text>
                }
                {/* Arrow out of this zone */}
                {i < 3 && (
                  <line
                    x1={zx+zW+1} y1={rY+rH/2}
                    x2={zoneX(i+1)-2} y2={rY+rH/2}
                    stroke={moving ? C.green : '#2a2a2a'}
                    strokeWidth={moving ? 2 : 1}
                    strokeDasharray={moving ? '5 3' : 'none'}
                    className={moving ? 'flow-active' : ''}
                    markerEnd={moving ? 'url(#arrGreen)' : ''}
                  />
                )}
              </g>
            );
          })}

          {/* Furnace outer border */}
          <rect x={fX-3} y={rY-46} width={furnW+6} height={rH+54} rx={4}
            fill="none" stroke="#3a3a3a" strokeWidth={1} strokeDasharray="5,3"/>
          <text x={fX+furnW/2} y={rY+rH+26} textAnchor="middle"
            fill="#3a3a3a" fontSize={9} letterSpacing={5}>П Е Ч Ь   З А К А Л К И</text>

          {/* Arrow furnace → quench */}
          {(() => {
            const moving = liveData.arrows.zones[3];
            return (
              <line
                x1={fX+furnW+4} y1={rY+rH/2}
                x2={qX-4}       y2={rY+rH/2}
                stroke={moving ? C.green : C.accent}
                strokeWidth={moving ? 2.5 : 1.5}
                strokeDasharray={moving ? '6 4' : 'none'}
                className={moving ? 'flow-active' : ''}
                markerEnd={moving ? 'url(#arrGreen)' : 'url(#arr)'}
              />
            );
          })()}

          {/* ── QUENCHING ── */}
          <rect x={qX} y={rY-42} width={qW} height={rH+46} rx={3}
            fill="url(#gq)"
            stroke={qS ? '#3b82f6' : '#1e2a3a'}
            strokeWidth={qS ? 2 : 1}
            style={qS ? {filter:'drop-shadow(0 0 3px #3b82f655)'} : {}}
          />
          <text x={qX+qW/2} y={rY-30} textAnchor="middle"
            fill="#93c5fd" fontSize={9} fontWeight={700}>ЗАКАЛКА</text>
          <text x={qX+qW/2} y={rY-19} textAnchor="middle"
            fill="#60a5fa" fontSize={8}>9 × 9 клапанов</text>
          <Nozzles9 x={qX+5} y={rY-10} active={running && !!qS} side="top"/>
          <Nozzles9 x={qX+5} y={rY+rH+6} active={running && !!qS} side="bottom"/>
          {qS
            ? <SheetRect x={qX+5} y={rY-1} w={qW-10} h={rH-4}
                label={`${qS.melt} / ${qS.sheet}`} color="#1e3a8a"/>
            : <text x={qX+qW/2} y={rY+rH/2+4} textAnchor="middle"
                fill="#252a50" fontSize={9}>— пусто —</text>
          }
          <g style={{cursor:'default'}}>
            <rect x={qX} y={rY+rH+12} width={qW} height={16}
              rx={3} fill="#1a2a4a" stroke="#3b82f6" strokeWidth={1}/>
            <text x={qX+qW/2} y={rY+rH+23} textAnchor="middle"
              fill="#60a5fa" fontSize={9} fontWeight={700}>▶ В ЗАКАЛКУ</text>
          </g>

          {/* Arrow quench → cooling */}
          <line x1={qX+qW+4} y1={rY+rH/2} x2={outX-4} y2={rY+rH/2}
            stroke={C.accent} strokeWidth={1.5} markerEnd="url(#arr)"/>

          {/* ── НАПОРНЫЕ КЛАПАНА ── */}
          <text x={presX+35} y={presY-35} fill={C.dim} fontSize={14} letterSpacing={0.5}>НАПОРНЫЕ КЛАПАНА</text>
          {['Скор.','Лам.1','Лам.2'].map((l,i) => (
            <text key={l} x={presX+i*54+22+30} y={presY-20} textAnchor="middle"
              fill={C.dim} fontSize={14}>{l}</text>
          ))}
          <text x={presX+25} y={presY} fill={C.dim} fontSize={14} textAnchor="end">Верх</text>
          {[2.00,3.00,3.00].map((v,i) => (
            <SvgSeg key={i} x={presX+i*54+30} y={presY-12} value={v.toFixed(2)} w={46} h={15}/>
          ))}
          <text x={presX+25} y={presY+20} fill={C.dim} fontSize={14} textAnchor="end">Низ</text>
          {[10.00,10.00,10.00].map((v,i) => (
            <SvgSeg key={i} x={presX+i*54+30} y={presY+10} value={v.toFixed(2)} w={46} h={15}/>
          ))}

          {/* ── COOLING CONVEYOR (X1) ── */}
          <text x={outX+outN*(rW+rGap)/2} y={rY-14} textAnchor="middle"
            fill={C.dim} fontSize={14}>Охлаждение</text>
          <Rollers x={outX} y={rY} count={outN} w={rW} gap={rGap} h={rH}/>
          {cS && (
            <SheetRect x={outX+1} y={rY-13} w={outN*(rW+rGap)-4} h={13}
              label={`${cS.melt}/${cS.sheet}`} color="#0e4a6b"/>
          )}
          <text x={outX+outN*(rW+rGap)/2} y={rY+rH+22} textAnchor="middle"
            fill={C.dim} fontSize={14}>{coolT} °C</text>

          {/* Arrow cooling → output */}
          <line
            x1={outX+outN*(rW+rGap)+4} y1={rY+rH/2}
            x2={finX-10}               y2={rY+rH/2}
            stroke={C.accent} strokeWidth={1.5} markerEnd="url(#arr)"/>

          {/* ── OUTPUT CONVEYOR (X2) ── */}
          <text x={(finX+finN*(rW+rGap)/2)-10} y={rY-14} textAnchor="middle"
            fill={C.dim} fontSize={14}>Выдача </text>
          <Rollers x={finX-10} y={rY} count={finN} w={rW} gap={rGap} h={rH}/>
          {liveData.output && (
            <SheetRect
              x={finX-10+1} y={rY-13}
              w={finN*(rW+rGap)-4} h={13}
              label={`${liveData.output.melt}/${liveData.output.sheet}`}
              color="#2d1f4a"
            />
          )}
        </svg>
      </div>

      {/* ══ PLANS + SHEETS ════════════════════════════════════════════════ */}
      <div style={{display:'flex', gap:8}}>

        {/* Plans */}
        <div style={{
          background:C.panel, border:`1px solid ${C.panelBd}`,
          borderRadius:6, padding:10, width:265, flexShrink:0,
        }}>
          <div style={{fontSize:14, color:C.accent, fontWeight:700, letterSpacing:1, marginBottom:8}}>
            ПЛАНЫ ЗАКАЛКИ
          </div>
          <div style={{display:'flex', flexDirection:'column', gap:4}}>
            {loading && (
              <div style={{color:C.dim, padding:10, textAlign:'center', fontSize:11}}>
                Загрузка планов...
              </div>
            )}
            {error && !loading && (
              <div style={{color:C.red, padding:10, fontSize:11, border:`1px solid ${C.red}`, borderRadius:4}}>
                ⚠ {error}
                <button onClick={fetchPlans} style={{marginLeft:8, background:'transparent',
                  color:C.accent, border:`1px solid ${C.accent}`, borderRadius:3,
                  padding:'1px 6px', cursor:'pointer', fontSize:11}}>
                  Повторить
                </button>
              </div>
            )}
            {!loading && !error && plans.length === 0 && (
              <div style={{color:C.dim, padding:10, textAlign:'center', fontSize:11}}>
                Нет доступных планов
              </div>
            )}
            {plans.map(plan => {
              const sel = selectedPlan?.id === plan.id;
              const sc  = statusColor(plan.status);
              return (
                <div key={plan.id}
                  onClick={() => handleSelectPlan(plan)}
                  style={{
                    background: sel ? '#1a2f4a' : 'transparent',
                    border: `1px solid ${sel ? C.accent : C.panelBd}`,
                    borderLeft: `3px solid ${sel ? C.accent : 'transparent'}`,
                    borderRadius:4, padding:'7px 10px', cursor:'pointer',
                  }}
                >
                  <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:3}}>
                    <span style={{fontWeight:700, fontSize:14}}>{plan.planName}</span>
                    <span style={{background:sc+'22', color:sc, border:`1px solid ${sc}`,
                      borderRadius:3, padding:'0 5px', fontSize:14}}>{plan.status}</span>
                  </div>
                  <div style={{display:'flex', gap:8, fontSize:14, color:C.dim, flexWrap:'wrap'}}>
                    <span>📅 {plan.date}</span>
                    <span>⏰ {plan.time}</span>
                    <span>📋 {plan.sheetCount} л.</span>
                    <span>{plan.furnace}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Sheets */}
        <div style={{
          background:C.panel, border:`1px solid ${C.panelBd}`,
          borderRadius:6, padding:10, flex:1, minWidth:0,
        }}>
          <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8}}>
            <div style={{fontSize:11, color:C.accent, fontWeight:700, letterSpacing:1}}>
              {sheetsLoading
                ? 'Загрузка листов...'
                : selectedPlan
                  ? `СОСТАВ: ${selectedPlan.planName} — ${planSheets.length} листов`
                  : 'ВЫБЕРИТЕ ПЛАН ИЗ СПИСКА'}
            </div>
            <button 
              onClick={addToConveyor} 
              disabled={!canAdd} 
              style={{
              background: canAdd ? '#1a4731' : '#21262d',
              color: canAdd ? C.green : C.dim,
              border: `1px solid ${canAdd ? C.green : C.panelBd}`,
              borderRadius:4, padding:'6px 14px', fontSize:14,
              cursor: canAdd && !submitting ? 'pointer' : 'default',
              fontFamily:'monospace', fontWeight:700,
            }}
            >
              
              {submitting ? '⏳ Запись....': '▶  Подать на входной рольганг'}</button>
          </div>

          {selectedPlan ? (
            <div style={{overflowX:'auto'}}>
              <table style={{width:'100%', borderCollapse:'collapse', fontSize:14}}>
                <thead>
                  <tr style={{borderBottom:`1px solid ${C.panelBd}`}}>
                    {['№','Плавка','Партия','Пачка','Лист','Марка','Толщ.','Ширина','Длина','Вес кг','Статус','Позиция'].map(h => (
                      <th key={h} style={{padding:'3px 7px', color:C.dim, textAlign:'left',
                        fontWeight:400, whiteSpace:'nowrap'}}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {planSheets.map((row, i) => {
                    const sel = selSheetId === row.id;
                    const sc  = statusColor(row.status);
                    return (
                      <tr key={row.id}
                        onClick={() => row.status==='Ожидание' && setSelSheet(sel ? null : row.id)}
                        style={{
                          background: sel ? '#1a2f4a' : (i%2 ? '#161b22' : 'transparent'),
                          borderLeft: `3px solid ${sel ? C.accent : 'transparent'}`,
                          cursor: row.status==='Ожидание' ? 'pointer' : 'default',
                          opacity: row.status==='Завершён' ? 0.4 : 1,
                        }}
                      >
                        <td style={{padding:'3px 7px', color:C.dim}}>{i+1}</td> 
                        <td style={{padding:'3px 7px', fontFamily:'monospace'}}>{row.melt}</td>
                        <td style={{padding:'3px 7px', fontFamily:'monospace'}}>{row.batch}</td>
                        <td style={{padding:'3px 7px', fontFamily:'monospace'}}>{row.pack}</td>
                        <td style={{padding:'3px 7px', fontFamily:'monospace', color:C.accent, fontWeight:700}}>{row.sheet}</td>
                        <td style={{padding:'3px 7px', color:C.yellow}}>{row.grade}</td>
                        <td style={{padding:'3px 7px', textAlign:'left'}}>{row.thick}</td>
                        <td style={{padding:'3px 7px', textAlign:'left'}}>{row.width}</td>
                        <td style={{padding:'3px 7px', textAlign:'left'}}>{row.len}</td>
                        <td style={{padding:'3px 7px', textAlign:'left', color:C.dim}}>{row.wt}</td>
                        <td style={{padding:'3px 7px'}}>
                          <span style={{background:sc+'22', color:sc, border:`1px solid ${sc}`,
                            borderRadius:3, padding:'0 5px', fontSize:14, whiteSpace:'nowrap'}}>
                            {row.status}
                          </span>
                        </td>
                        <td style={{padding:'3px 7px', color:row.loc ? C.text : C.dim}}>
                          {row.loc || '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{color:C.dim, padding:20, textAlign:'center'}}>
              Выберите план закалки из списка слева
            </div>
          )}
        </div>
      </div>
    </div>
  );
}