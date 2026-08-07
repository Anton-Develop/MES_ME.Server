// src/utils/excelExport.js
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

export const exportToExcel = (jsonData, fileName = 'export.xlsx') => {
  if (!jsonData || jsonData.length === 0) {
    alert('Нет данных для экспорта');
    return;
  }

  // Создаем книгу
  const ws = XLSX.utils.json_to_sheet(jsonData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Данные');

  // Настраиваем ширину колонок автоматически
  const colWidths = Object.keys(jsonData[0]).map(key => ({
    wch: Math.max(key.length, ...jsonData.map(row => String(row[key] || '').length)) + 2
  }));
  ws['!cols'] = colWidths;

  // Генерируем и скачиваем
  const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([excelBuffer], { type: 'application/octet-stream' });
  saveAs(blob, fileName);
};