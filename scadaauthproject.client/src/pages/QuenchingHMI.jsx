import { useState, useEffect } from "react";
import { useOpcUa, useOpcTag } from '../hooks/useOpcUa';
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

// ── Primitives ────────────────────────────────────────────────────────────────
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

// Compact segment for pressure display in SVG (rendered as foreignObject alternative — pure SVG rects)
const SvgSeg = ({x, y, value, unit='', w=46, h=18}) => (
  <g>
    <rect x={x} y={y} width={w} height={h} rx={2} fill={C.display} stroke="#1c6ca8" strokeWidth={1}/>
    <text x={x+w-4} y={y+h/2+4} textAnchor="end" fill="#4fc3f7"
      fontSize={10} fontFamily="monospace" fontWeight={700}>{value}</text>
    {unit && <text x={x+w+2} y={y+h/2+4} fill={C.dim} fontSize={8}>{unit}</text>}
  </g>
);


// ── SVG helpers ───────────────────────────────────────────────────────────────
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
    const cx = x + i*13 + 6;
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

// ── Main ──────────────────────────────────────────────────────────────────────
export default function QuenchingHMI() {
  const [time, setTime]                 = useState(new Date());
  const [selSheetId, setSelSheet]       = useState(null);
  const [inputSheet, setInputSheet]     = useState(null);
  const [temps, setTemps]               = useState([852, 920, 922, 905]);
  const [coolT, setCoolT]               = useState(19.1);
  const [running, setRunning]           = useState(true);  // setRunning используется в панели управления (раскомментировать блок УПРАВЛЕНИЕ) // eslint-disable-line no-unused-vars
  const [loading, setLoading]           = useState(true);
  const [sheetsLoading, setSheetsLoading] = useState(false);
  const [error, setError]               = useState(null);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [plans, setPlans]               = useState([]);
// --- Новое состояние для реальных температур ---
   // const [realTemps, setRealTemps] = useState([0, 0, 0, 0]); // Инициализируем нулями или значениями по умолчанию
// --- Новая функция для загрузки реальных температур ---
const { values, connected, write } = useOpcUa([
    'T_F1_MedAct', 'T_F2_MedAct', 'T_F3_MedAct', 'T_F4_MedAct',
    
  ]);
// Создаем массив realTemps из полученных значений
const realTemps = [
  Math.round(values['T_F1_MedAct']?.value ?? 0),
  Math.round(values['T_F2_MedAct']?.value ?? 0),
  Math.round(values['T_F3_MedAct']?.value ?? 0),
  Math.round(values['T_F4_MedAct']?.value ?? 0),
];
const setZoneTemp = async (zone, temp) => {
    const ok = await write(`z${zone}_setpoint`, temp);
    console.log('Write result:', ok);
  };

// ---Через restapi чтение с базы, но это жопа ---
  /*  const fetchRealTemps = async () => {
        try {
            console.log("Загрузка реальных температур...");
            const response = await api.get('/quenchinghmi/zonetemperatures');
            
            const data = response.data; // Ожидаем { Zone1: val, Zone2: val, Zone3: val, Zone4: val }
            console.log("Полученные реальные температуры:", data);
            // Обновляем состояние с температурами по зонам
            setRealTemps([
               Math.round( parseFloat(data.zone1)) || 0, // Используем parseFloat и fallback к 0
               Math.round (parseFloat(data.zone2)) || 0,
               Math.round( parseFloat(data.zone3)) || 0,
               Math.round( parseFloat(data.zone4)) || 0
            ]);
        } catch (err) {
            console.error("Ошибка при загрузке реальных температур:", err);
            // Опционально: setError(err.message); - если хотите показывать ошибку температуры отдельно
            // Для простоты, оставим старые значения или установим 0, если ошибка
        }
    };*/
   // Функция для загрузки списка планов
  const fetchPlans = async () => {
        try {
            setLoading(true);
            console.log("Загрузка списка планов с бэкенда...");
            const response = await api.get('/quenchinghmi/plans');
            //console.log("Полученные response:", response); 
           
            //if (!response.ok) {
              //  throw new Error(`Ошибка загрузки планов: ${response.status}`); 
            //}
            
            const data = response.data;//await response.json();
            //console.log("Полученные планы:", response.data);
            setPlans(data);
            setError(null); // Сбросить ошибку при успешной загрузке
        } catch (err) {
            console.error("Ошибка при загрузке планов:", err);
            setError(err.message);
            setPlans([]); // Очистить список в случае ошибки
        } finally {
            setLoading(false);
        }
    };

  // Функция для загрузки листов конкретного плана
    const fetchPlanSheets = async (planId) => {
        try {
            setSheetsLoading(true);
            console.log(`Загрузка листов для плана ${planId} с бэкенда...`);
            const response = await api.get(`/quenchinghmi/plans/${planId}/sheets`);
            if (response.status < 200 || response.status >= 300) {
            // Бросаем ошибку, если статус неуспешный
            throw new Error(`Ошибка загрузки листов плана ${planId}: ${response.status}`);
        }
            const sheets = response.data;
            console.log(`Полученные листы для плана ${planId}:`, sheets);

            const basePlan = plans.find(p => p.id === planId);
            setSelectedPlan({ ...basePlan, sheets });
        } catch (err) {
            console.error("Ошибка при загрузке листов плана:", err);
            setError(err.message);
            setSelectedPlan(null);
        } finally {
            setSheetsLoading(false);
        }
    };
  
    // Загрузка списка планов при первом рендере компонента
    useEffect(() => {
        fetchPlans();
    }, []);

    const handleSelectPlan = (plan) => {
        console.log("Выбран план:", plan);
        setSelectedPlan(plan);
        fetchPlanSheets(plan.id);
        setSelSheet(null); // сброс выбранного листа при смене плана
    };

     // --- Таймер для обновления часов и  температур ---
    useEffect(() => {
      const id = setInterval(() => {
        setTime(new Date());
        // fetchRealTemps();
       // setTemps(t => t.map(v => Math.round((v + (Math.random() - 0.5) * 2) * 10) / 10));
        setCoolT(t => Math.round((t + (Math.random() - 0.5) * 0.4) * 10) / 10);
      }, 10000);
      return () => clearInterval(id);
    }, []);


  const allSheets  = selectedPlan ? selectedPlan.sheets : [];// plans.flatMap(p => p.sheets);
  const inLoc      = loc => Array.isArray(allSheets) ? allSheets.find(s => s.loc === loc) : undefined;//loc => allSheets.find(s => s.loc === loc);
  const zones      = [1,2,3,4].map(i => inLoc(`Зона ${i}`));
  const qS         = inLoc('Закалка');
  const cS         = inLoc('Охл.');
  const planSheets = selectedPlan?.sheets || [];//plans.find(p => p.id === selectedPlan?.id)?.sheets ?? [];
  const selSheet   = planSheets.find(s => s.id === selSheetId);
  const canAdd     = !!selSheetId && selSheet?.status === 'Ожидание' && !inputSheet;

  const addToConveyor = () => {
    if (!canAdd) return;
    setInputSheet(selSheet);
    setSelectedPlan(prev => ({
      ...prev,
      sheets: prev.sheets.map(s =>
        s.id === selSheetId ? {...s, status:'На рольганге', loc:'Вход'} : s
      ),
    }));
    setSelSheet(null);
  };

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

  // ── SVG layout ─────────────────────────────────────────────────────────────
  // SVG is purely the process diagram. No legends. No overlap.
  const VW = 1000, VH = 230;
  // Vertical: rY is centre of rollers
  const rY = 110, rH = 30, rW = 16, rGap = 5;

  // Horizontal positions
  const inX  = 10, inN = 5;
  const fX   = inX + inN*(rW+rGap) + 22;
  const zW   = 118, zGap = 2, furnW = 4*zW + 3*zGap;
  const qX   = fX + furnW + 20;
  const qW   = 126;
  const outX = qX + qW + 20;
  const outN = 6;
  const finX = outX + outN*(rW+rGap) + 18;
  const finN = 4;

  const zoneX = i => fX + i*(zW+zGap);

  // Pressure display position — above cooling section
  const presX = outX - 4;
  const presY = rY - 56; // above rollers

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

        {/* 1. LED indicators — fixed compact block */}
        <div style={{display:'flex', flexDirection:'column', gap:4, flexShrink:0, minWidth:155}}>
          {[
            {on:false,  color:C.red,    label:'Аварийный останов'},
            {on:false,  color:C.red,    label:'Блокировка нагрева'},
            {on:running,color:C.green,  label:'Готовность к запуску'},
            {on:!!inputSheet,color:C.accent,label:'Лист на рольганге'},
          ].map(({on,color,label}) => (
            <div key={label} style={{display:'flex', alignItems:'center', gap:6}}>
              <Led on={on} color={color}/>
              <span style={{fontSize:14, color:C.dim}}>{label}</span>
            </div>
          ))}
        </div>

        <div style={{width:1, height:48, background:C.panelBd, flexShrink:0}}/>

        {/* 2. Zone temps temps  */}
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

        {/* 3. Current sheet info */}
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

        {/* 4. Grade + thick — compact */}
        <div style={{flexShrink:0}}>
          <div style={{fontSize:14, color:C.dim, marginBottom:3}}>Марка / Толщ.</div>
          <Seg value={zones[0]?.grade||'──'} width={52}/>
          <div style={{height:4}}/>
          <Seg value={zones[0]?.thick??'─.─'} unit="мм" width={52}/>
        </div>

        <div style={{width:1, height:48, background:C.panelBd, flexShrink:0}}/>

        {/* 5. Speed / Temp / Len — compact vertical */}
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

        {/* 6. Clock — pushed right */}
        <div style={{marginLeft:'auto', textAlign:'right', flexShrink:0}}>
          <div style={{fontSize:14, color:C.dim}}>Время</div>
          <div style={{fontSize:24, color:C.accent, fontWeight:700, letterSpacing:3}}>{fmt(time)}</div>
          <div style={{fontSize:14, color:C.dim}}>{new Date().toLocaleDateString('ru-RU')}</div>
        </div>
      </div>

      {/* ══ PROCESS + RIGHT BUTTONS ROW ═══════════════════════════════════ */}
      <div style={{display:'flex', gap:8, marginBottom:8}}>

        {/* ── Process panel ──────────────────────────────────────────────── */}
        <div style={{
          background:C.panel, border:`1px solid ${C.panelBd}`,
          borderRadius:6, padding:'8px 10px', flex:1, minWidth:0,
          display:'flex', flexDirection:'column', gap:5,
        }}>
          <div style={{fontSize:14, color:C.dim, letterSpacing:1}}>
            ТЕХНОЛОГИЧЕСКАЯ СХЕМА — ЛИНИЯ ЗАКАЛКИ
          </div>

          {/* Zone strip */}
          <div style={{display:'flex', gap:5, flexWrap:'wrap'}}>
            {[
              {label:'Вход. рольганг', sheet:inputSheet, color:C.accent},
              {label:'Зона 1',          sheet:zones[0],   color:'#f87171'},
              {label:'Зона 2',          sheet:zones[1],   color:'#fb923c'},
              {label:'Зона 3',          sheet:zones[2],   color:'#fbbf24'},
              {label:'Зона 4',          sheet:zones[3],   color:'#a3e635'},
              {label:'Закалка',         sheet:qS,         color:'#60a5fa'},
              {label:'Охлаждение',      sheet:cS,         color:'#34d399'},
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

          {/* ── SVG ──────────────────────────────────────────────────────── */}
          <svg width="100%" viewBox={`0 0 ${VW} ${VH}`} style={{display:'block'}}>
            <defs>
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
            </defs>

            {/* Ground */}
            <line x1={0} y1={rY+rH+6} x2={VW} y2={rY+rH+6}
              stroke={C.panelBd} strokeWidth={1}/>

            {/* ── INPUT CONVEYOR ── */}
            <text x={inX+inN*(rW+rGap)/2} y={rY-14} textAnchor="middle"
              fill={C.dim} fontSize={9}>Вход. рольганг</text>
            <Rollers x={inX} y={rY} count={inN} w={rW} gap={rGap} h={rH}/>
            {inputSheet && (
              <SheetRect x={inX+1} y={rY-13} w={inN*(rW+rGap)-4} h={13}
                label={`${inputSheet.melt}/${inputSheet.sheet}`} color={C.accent}/>
            )}
            {/* В ПЕЧЬ button below input conveyor */}
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

            {/* arrow → furnace */}
            <line x1={inX+inN*(rW+rGap)+2} y1={rY+rH/2}
                  x2={fX-4}              y2={rY+rH/2}
              stroke={C.accent} strokeWidth={1.5} markerEnd="url(#arr)"/>

            {/* ── 4 FURNACE ZONES ── */}
            {[0,1,2,3].map(i => {
              const zx = zoneX(i), sh = zones[i];
              return (
                <g key={i}>
                  <rect x={zx} y={rY-42} width={zW} height={rH+46} rx={3}
                    fill={`url(#gz${i})`} stroke={ZONE_STROKE[i]} strokeWidth={1.5}/>
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
                </g>
              );
            })}
            {/* Furnace outer border */}
            <rect x={fX-3} y={rY-46} width={furnW+6} height={rH+54} rx={4}
              fill="none" stroke="#3a3a3a" strokeWidth={1} strokeDasharray="5,3"/>
            <text x={fX+furnW/2} y={rY+rH+26} textAnchor="middle"
              fill="#3a3a3a" fontSize={9} letterSpacing={5}>П Е Ч Ь   З А К А Л К И</text>

            {/* arrow furnace → quench */}
            <line x1={fX+furnW+4} y1={rY+rH/2}
                  x2={qX-4}       y2={rY+rH/2}
              stroke={C.accent} strokeWidth={1.5} markerEnd="url(#arr)"/>

            {/* ── QUENCHING ── */}
            <rect x={qX} y={rY-42} width={qW} height={rH+46} rx={3}
              fill="url(#gq)" stroke="#3b82f6" strokeWidth={1.5}/>
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
            {/* В ЗАКАЛКУ button below quenching — same style as В ПЕЧЬ */}
            <g style={{cursor:'default'}} >
              <rect x={qX} y={rY+rH+12} width={qW} height={16}
                rx={3} fill="#1a2a4a" stroke="#3b82f6" strokeWidth={1}/>
              <text x={qX+qW/2} y={rY+rH+23} textAnchor="middle"
                fill="#60a5fa" fontSize={9} fontWeight={700}>▶ В ЗАКАЛКУ</text>
            </g>

            {/* arrow quench → cooling */}
            <line x1={qX+qW+4} y1={rY+rH/2}
                  x2={outX-4}   y2={rY+rH/2}
              stroke={C.accent} strokeWidth={1.5} markerEnd="url(#arr)"/>

            {/* ── НАПОРНЫЕ КЛАПАНА — above cooling section ── */}
            {/* Header */}
            <text x={presX+35} y={presY-35} fill={C.dim} fontSize={14} letterSpacing={0.5}>НАПОРНЫЕ КЛАПАНА</text>
            {/* Column headers */}
            {['Скор.','Лам.1','Лам.2'].map((l,i) => (
              <text key={l} x={presX+i*54+22+30} y={presY-20} textAnchor="middle"
                fill={C.dim} fontSize={14}>{l}</text>
            ))}
            {/* Верх row */}
            <text x={presX+25} y={presY} fill={C.dim} fontSize={14} textAnchor="end">Верх</text>
            {[2.00,3.00,3.00].map((v,i) => (
              <SvgSeg key={i} x={presX+i*54+30} y={presY-12} value={v.toFixed(2)} w={46} h={15}/>
            ))}
            {/* Низ row */}
            <text x={presX+25} y={presY+20} fill={C.dim} fontSize={14} textAnchor="end">Низ</text>
            {[10.00,10.00,10.00].map((v,i) => (
              <SvgSeg key={i} x={presX+i*54+30} y={presY+10} value={v.toFixed(2)} w={46} h={15}/>
            ))}

            {/* ── COOLING CONVEYOR ── */}
            <text x={outX+outN*(rW+rGap)/2} y={rY-14} textAnchor="middle"
              fill={C.dim} fontSize={14}>Охлаждение</text>
            <Rollers x={outX} y={rY} count={outN} w={rW} gap={rGap} h={rH}/>
            {cS && <SheetRect x={outX+1} y={rY-13} w={outN*(rW+rGap)-4} h={13}
              label={`${cS.melt}/${cS.sheet}`} color="#0e4a6b"/>}
            <text x={outX+outN*(rW+rGap)/2} y={rY+rH+22} textAnchor="middle"
              fill={C.dim} fontSize={14}>{coolT} °C</text>

            {/* arrow cooling → output */}
            <line x1={outX-8+outN*(rW+rGap)+4} y1={rY+rH/2}
                  x2={finX-10}                y2={rY+rH/2}
              stroke={C.accent} strokeWidth={1.5} markerEnd="url(#arr)"/>

            {/* ── OUTPUT ── */}
            <text x={(finX+finN*(rW+rGap)/2)-10} y={rY-14} textAnchor="middle"
              fill={C.dim} fontSize={14}>Выдача</text>
            <Rollers x={finX-10} y={rY} count={finN} w={rW} gap={rGap} h={rH}/>
          </svg>
        </div>

        {/* ── Right control panel ────────────────────────────────────────── */}
       {/* <div style={{
          background:C.panel, border:`1px solid ${C.panelBd}`,
          borderRadius:6, padding:10, width:160,
          display:'flex', flexDirection:'column', gap:5, flexShrink:0,
        }}>
		 
          <div style={{fontSize:14, color:C.dim, letterSpacing:1, borderBottom:`1px solid ${C.panelBd}`, paddingBottom:4}}>
            УПРАВЛЕНИЕ
          </div>
		 
          <div style={{display:'flex', flexDirection:'column', gap:4}}>
            <Btn label="Все в АВТО"     color="#1a4731" full/>
            <Btn label="▶  СТАРТ"       color="#145a32" onClick={()=>setRunning(true)}  disabled={running} full/>
            <Btn label="■  Стоп нагрев" color="#5a1414" onClick={()=>setRunning(false)} disabled={!running} full/>
            <Btn label="Стоп охл."      color="#1a3a5a" full/>
          </div>

          <div style={{borderTop:`1px solid ${C.panelBd}`, paddingTop:4, display:'flex', flexDirection:'column', gap:4}}>
            <Btn label="▶ В ПЕЧЬ"
              color={inputSheet ? '#1e3a6e' : '#21262d'}
              disabled={!inputSheet}
              onClick={loadToFurnace}
              full/>
            <Btn label="▶ В ЗАКАЛКУ"
              color="#1a2a4a"
              disabled
              full/>
            <Btn label="Рольганги" color="#252a30" full/>
          </div>

          <div style={{borderTop:`1px solid ${C.panelBd}`, paddingTop:4, display:'flex', gap:4}}>
            <Btn label="КИП"    color="#1a2a4a"/>
            <Btn label="Тренды" color="#1a2a4a"/>
          </div>

          <div style={{borderTop:`1px solid ${C.panelBd}`, paddingTop:4}}>
            <Btn label="Сброс ошибок" color="#4a2a0a" full/>
          </div>
		 
        </div> */}
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
            <button onClick={addToConveyor} disabled={!canAdd} style={{
              background: canAdd ? '#1a4731' : '#21262d',
              color: canAdd ? C.green : C.dim,
              border: `1px solid ${canAdd ? C.green : C.panelBd}`,
              borderRadius:4, padding:'6px 14px', fontSize:14,
              cursor: canAdd ? 'pointer' : 'default',
              fontFamily:'monospace', fontWeight:700,
            }}>▶ Подать на входной рольганг</button>
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