// src/pages/ImportPage.jsx
import React from 'react';
import ExcelImportComponent from '../components/ExcelImportComponent';

// ИСПРАВЛЕНО: удалена обёртка <div> без семантики и стилей —
// ExcelImportComponent самодостаточен и содержит Container внутри себя,
// лишняя обёртка создавала лишний DOM-узел
const ImportPage = () => <ExcelImportComponent />;

export default ImportPage;
