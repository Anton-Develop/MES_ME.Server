import React, { useState, useEffect } from 'react';
import {
  Box, Paper, Tabs, Tab, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Typography, Button,
  TextField, Grid, CircularProgress, Stack
} from '@mui/material';
import { FileDownload, Search } from '@mui/icons-material';
import PageContainer from '../components/PageContainer';
import { furnaceApi } from '../api/furnaceApi';
import { quenchingApi } from '../api/quenchingApi'; // Используем официальный модуль
import api from '../api';
import { exportToExcel } from '../utils/excelExport';

// ─── Стили таблиц (точно как в Excel-паспорте) ───
const headerCellSx = {
  whiteSpace: 'normal', wordBreak: 'break-word', maxWidth: 140, minWidth: 80,
  lineHeight: 1.15, fontSize: '0.7rem', fontWeight: 700, textAlign: 'center',
  verticalAlign: 'middle', py: 1, px: 0.5, bgcolor: '#fafafa', border: '1px solid #e0e0e0',
};
const bodyCellSx = {
  fontSize: '0.75rem', textAlign: 'center', py: 0.5, px: 0.5,
  border: '1px solid #eeeeee', fontFamily: 'monospace',
};

// ─── Форматтеры ───
const fmtDateRu = (d) => d ? new Date(d).toLocaleDateString('ru-RU') : '';
const fmtTimeRu = (d) => d ? new Date(d).toLocaleTimeString('ru-RU') : '';
const fmtNum = (v, dec = 1) => v != null ? Number(v).toFixed(dec) : '';

const BatchPassportPage = () => {
  const now = new Date();
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const toLocalISO = (d) => {
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  const [filters, setFilters] = useState({
    dateFrom: toLocalISO(yesterday),
    dateTo: toLocalISO(now),
    alloyCode: '', melt: '', partNo: '', batch: '', sheet: '',
  });

  const [tab, setTab] = useState(0);
  const [loading, setLoading] = useState(false);
  
  // Мастер-данные от API нагрева
  const [furnaceSessions, setFurnaceSessions] = useState([]);
  // Обогащенные данные для таблицы закалки
  const [quenchTableData, setQuenchTableData] = useState([]);
  // Данные отпуска
  const [temperData, setTemperData] = useState([]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. МАСТЕР-ЗАПРОС: Нагрев (определяет состав партии)
      const fRes = await furnaceApi.getSessions({
        page: 1, pageSize: 10000,
        from: filters.dateFrom || undefined,
        to: filters.dateTo || undefined,
        alloyCode: filters.alloyCode || undefined,
        melt: filters.melt || undefined,
        part: filters.partNo || undefined, // В FurnaceController это 'part'
        batch: filters.batch || undefined,
        sheet: filters.sheet || undefined,
      });
      const sessions = fRes.data.items ?? [];
      setFurnaceSessions(sessions);

      // 2. ЗАКАЛКА: Подтягиваем детали по каждому листу из нагрева
      // Параллельные запросы к QuenchingController.by-sheet/{sheet}
      const quenchPromises = sessions.map(async (s) => {
        try {
          // Ищем сессию закалки, соответствующую текущему нагреву
          const qRes = await quenchingApi.getSessionsBySheet(s.sheet);
          const qList = qRes.data || [];
          
          // Матчинг по бизнес-ключу или параметрам плавки/партии
          const matched = qList.find(q => 
            q.melt === s.melt && 
            q.partNo === s.partNo && 
            q.pack === s.pack && 
            q.reheatNum === (s.reheatNum ?? 0)
          ) || qList[0]; // Fallback на первую, если точное совпадение не найдено

          return { ...s, quench: matched || null };
        } catch {
          return { ...s, quench: null };
        }
      });

      const enriched = await Promise.all(quenchPromises);
      setQuenchTableData(enriched);

      // 3. ОТПУСК: История завершенных кассет
      const tRes = await api.get('/tempering/history', { params: { pageSize: 1000 } });
      setTemperData(tRes.data.sessions || []);

    } catch (err) {
      console.error("Ошибка загрузки паспорта:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  // ─── Экспорт в Excel ───
  const handleExport = () => {
    let data = [];
    let fileName = 'passport';

    if (tab === 0) {
      data = quenchTableData.map((r, i) => ({
            '№ п/п': i + 1,
            'Дата загрузки листа в закалочную печь': fmtDateRu(r.enteredAt),
            'Время загрузки листа в закалочную печь': fmtTimeRu(r.enteredAt),
            'Толщина листа, мм': r.thickness ?? 6,
            'Номер листа': r.sheet,
            
            // ✅ ИЗ НАГРЕВА
            'Заданная температура, С': fmtNum(r.tmpSet, 0),
            'Фактическая температура рабочего пространства закалочной печи перед загрузкой, С': 
                fmtNum(r.avgZ1_1 ?? r.tmpSet, 0),
            
            'Время нахождения листа в закалочной печи, мин': fmtNum(r.totalMin),
            
            // ✅ ИЗ ЗАКАЛКИ
            'Давление воды в коллекторе закалочной машины, бар': r.quench 
                ? fmtNum(((r.quench.pressTopZak || 0) + (r.quench.pressBotZak || 0)) / 2 * 10, 1) 
                : '',
            'Температура воды в закалочной машине, С': r.quench 
                ? fmtNum(r.quench.tempHaccum) 
                : '',
            }));
      fileName = 'Закалка_6мм';
    } else {
      data = temperData.map((r, i) => ({
        '№ п/п': i + 1,
        'Дата': fmtDateRu(r.loaded_at),
        'Время загрузки листов в печь отпуска': fmtTimeRu(r.loaded_at),
        'Номера листов': '', // TODO: вычислить диапазон по cassette_business_key
        'Номер кассеты': r.cassette_number,
        'Фактическая температура в отпускной печи при выдержке металла, 0С': fmtNum(r.max_temp, 0),
        'Время выдержки в отпускной печи, мин': r.total_time_min,
      }));
      fileName = 'Отпуск_6мм';
    }
    exportToExcel(data, `${fileName}_${new Date().toISOString().slice(0,10)}.xlsx`);
  };

  return (
    <PageContainer>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h5" fontWeight={700}>Паспорт партии</Typography>
        <Button variant="contained" startIcon={<FileDownload />} onClick={handleExport} disabled={loading}>
          Сохранить в Excel
        </Button>
      </Stack>

      {/* Фильтры (управляют мастер-запросом нагрева) */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Grid container spacing={2} alignItems="flex-end">
          <Grid item xs={3}><TextField label="Дата с" type="datetime-local" size="small" fullWidth value={filters.dateFrom} onChange={e => setFilters({...filters, dateFrom: e.target.value})} InputLabelProps={{ shrink: true }} /></Grid>
          <Grid item xs={3}><TextField label="Дата по" type="datetime-local" size="small" fullWidth value={filters.dateTo} onChange={e => setFilters({...filters, dateTo: e.target.value})} InputLabelProps={{ shrink: true }} /></Grid>
          <Grid item xs={2}><TextField label="Марка стали" size="small" fullWidth value={filters.alloyCode} onChange={e => setFilters({...filters, alloyCode: e.target.value})} /></Grid>
          <Grid item xs={2}><TextField label="Плавка" size="small" fullWidth value={filters.melt} onChange={e => setFilters({...filters, melt: e.target.value.replace(/\D/g,'')})} inputProps={{inputMode:'numeric'}} /></Grid>
          <Grid item xs={2}><TextField label="Партия" size="small" fullWidth value={filters.partNo} onChange={e => setFilters({...filters, partNo: e.target.value.replace(/\D/g,'')})} inputProps={{inputMode:'numeric'}} /></Grid>
          <Grid item xs={2}><TextField label="Пачка" size="small" fullWidth value={filters.batch} onChange={e => setFilters({...filters, batch: e.target.value.replace(/\D/g,'')})} inputProps={{inputMode:'numeric'}} /></Grid>
          <Grid item xs={2}><TextField label="Лист" size="small" fullWidth value={filters.sheet} onChange={e => setFilters({...filters, sheet: e.target.value.replace(/\D/g,'')})} inputProps={{inputMode:'numeric'}} /></Grid>
          <Grid item xs={2}><Button variant="contained" fullWidth startIcon={<Search />} onClick={fetchData} disabled={loading}>Применить</Button></Grid>
        </Grid>
      </Paper>

      <Paper sx={{ p: 3, mb: 3, border: '1px solid #ccc' }}>
        <Typography variant="h6" align="center" fontWeight={800} gutterBottom>ПАСПОРТ ТЕРМИЧЕСКОЙ ОБРАБОТКИ</Typography>
      </Paper>

      <Paper sx={{ borderRadius: 0, border: '1px solid #ccc' }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="fullWidth" textColor="primary">
          <Tab label={`Закалка (${quenchTableData.length} л.)`} />
          <Tab label={`Отпуск (${temperData.length} кассет)`} />
        </Tabs>

        <Box sx={{ p: 0 }}>
          {loading && <Box sx={{p:4, textAlign:'center'}}><CircularProgress/></Box>}

          {/* ═══════════ ВКЛАДКА ЗАКАЛКИ ═══════════ */}
          {!loading && tab === 0 && (
            <TableContainer sx={{ maxHeight: 700 }}>
              <Table stickyHeader size="small" sx={{ minWidth: 1000 }}>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{...headerCellSx, width: 50}}>№ п/п</TableCell>
                    <TableCell sx={{...headerCellSx, maxWidth: 100}}>Дата загрузки листа в закалочную печь</TableCell>
                    <TableCell sx={{...headerCellSx, maxWidth: 90}}>Время загрузки листа в закалочную печь</TableCell>
                    <TableCell sx={{...headerCellSx, width: 60}}>Толщина листа, мм</TableCell>
                    <TableCell sx={{...headerCellSx, width: 60}}>Номер листа</TableCell>
                    <TableCell sx={{...headerCellSx, maxWidth: 80}}>Заданная температура, С</TableCell>
                    <TableCell sx={{...headerCellSx, maxWidth: 130}}>Фактическая температура рабочего пространства закалочной печи перед загрузкой, С</TableCell>
                    <TableCell sx={{...headerCellSx, maxWidth: 100}}>Время нахождения листа в закалочной печи, мин</TableCell>
                    <TableCell sx={{...headerCellSx, maxWidth: 110}}>Давление воды в коллекторе закалочной машины, бар</TableCell>
                    <TableCell sx={{...headerCellSx, maxWidth: 100}}>Температура воды в закалочной машине, С</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {quenchTableData.map((r, i) => (
                    <TableRow key={`${r.melt}-${r.sheet}-${i}`}>
                        <TableCell sx={bodyCellSx}>{i + 1}</TableCell>
                        {/* Даты/время — из нагрева */}
                        <TableCell sx={bodyCellSx}>{fmtDateRu(r.enteredAt)}</TableCell>
                        <TableCell sx={bodyCellSx}>{fmtTimeRu(r.enteredAt)}</TableCell>
                        <TableCell sx={bodyCellSx}>{r.thickness ?? 6}</TableCell>
                        <TableCell sx={{...bodyCellSx, fontWeight: 700}}>{r.sheet}</TableCell>
                        
                        {/* ✅ ИСПРАВЛЕНО: Заданная температура — из НАГРЕВА (tmpSet) */}
                        <TableCell sx={bodyCellSx}>{fmtNum(r.tmpSet, 0)}</TableCell>
                        
                        {/* ✅ ИСПРАВЛЕНО: Факт. температура печи перед загрузкой — из НАГРЕВА (avgZ1_1) */}
                        <TableCell sx={bodyCellSx}>{fmtNum(r.avgZ1_1 ?? r.tmpSet, 0)}</TableCell>
                        
                        {/* Время в печи — из нагрева (totalMin) */}
                        <TableCell sx={bodyCellSx}>{fmtNum(r.totalMin)}</TableCell>
                        
                        {/* Давление и T воды — ТОЛЬКО из закалки */}
                        <TableCell sx={bodyCellSx}>
                        {r.quench ? fmtNum(((r.quench.pressTopZak||0)+(r.quench.pressBotZak||0))/2*10, 1) : '—'}
                        </TableCell>
                        <TableCell sx={bodyCellSx}>
                        {r.quench ? fmtNum(r.quench.tempHaccum) : '—'}
                        </TableCell>
                    </TableRow>
                    ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}

          {/* ═══════════ ВКЛАДКА ОТПУСКА ═══════════ */}
          {!loading && tab === 1 && (
            <TableContainer>
              <Table size="small" sx={{ minWidth: 800 }}>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{...headerCellSx, width: 50}}>№ п/п</TableCell>
                    <TableCell sx={{...headerCellSx, maxWidth: 90}}>Дата</TableCell>
                    <TableCell sx={{...headerCellSx, maxWidth: 100}}>Время загрузки листов в печь отпуска</TableCell>
                    <TableCell sx={{...headerCellSx, maxWidth: 90}}>Номера листов</TableCell>
                    <TableCell sx={{...headerCellSx, width: 70}}>Номер кассеты</TableCell>
                    <TableCell sx={{...headerCellSx, maxWidth: 130}}>Фактическая температура в отпускной печи при выдержке металла, 0С</TableCell>
                    <TableCell sx={{...headerCellSx, maxWidth: 100}}>Время выдержки в отпускной печи, мин</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {temperData.map((r, i) => (
                    <TableRow key={i}>
                      <TableCell sx={bodyCellSx}>{i + 1}</TableCell>
                      <TableCell sx={bodyCellSx}>{fmtDateRu(r.loaded_at)}</TableCell>
                      <TableCell sx={bodyCellSx}>{fmtTimeRu(r.loaded_at)}</TableCell>
                      <TableCell sx={bodyCellSx}>{/* TODO: range */ ''}</TableCell>
                      <TableCell sx={{...bodyCellSx, fontWeight: 700}}>{r.cassette_number}</TableCell>
                      <TableCell sx={bodyCellSx}>{fmtNum(r.max_temp, 0)}</TableCell>
                      <TableCell sx={bodyCellSx}>{r.total_time_min}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Box>
        
        <Box sx={{ p: 1.5, borderTop: '1px solid #ccc', display: 'flex', justifyContent: 'space-between' }}>
          <Typography variant="caption" fontStyle="italic">Инженер-технолог</Typography>
          <Typography variant="caption" color="text.secondary">стр. {tab + 2}</Typography>
        </Box>
      </Paper>
    </PageContainer>
  );
};

export default BatchPassportPage;