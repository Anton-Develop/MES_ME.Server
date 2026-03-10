// src/components/CassetteDetailsModal.jsx
import React, { useState, useEffect, useRef } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Box,
  CircularProgress,
  Alert,
  IconButton,
  Tooltip,
  Chip,
} from '@mui/material';
import { Print as PrintIcon } from '@mui/icons-material';
import api from '../api';

// Константы для цветов статусов вынесены за пределы компонента
const CASSETTE_STATUS_COLORS = {
  'Создана': 'default',
  'Формируется': 'info',
  'Готова к отправке': 'warning',
  'Отправлена в печь': 'secondary',
  'Извлечена аварийно': 'error',
  'Отпуск завершён': 'success',
  'Завершена': 'success',
  'Отменена': 'error',
  'default': 'default', // Резервный вариант
};

// Вспомогательная функция форматирования дат
const fmtDateTime = (dt) =>
  dt ? new Date(dt).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' }) : 'N/A';

const CassetteDetailsModal = ({ isOpen, cassetteId, onClose }) => {
  const [details, setDetails] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const componentRef = useRef(); // Ref для области, которую хотим печатать

  useEffect(() => {
    if (isOpen && cassetteId) {
      fetchDetails(cassetteId);
    } else if (!isOpen) {
      // Сброс состояний при закрытии
      setDetails(null);
      setError('');
    }
  }, [isOpen, cassetteId]);

  const fetchDetails = async (id) => {
    setLoading(true);
    setError('');
    try {
      const response = await api.get(`/cassette/${id}/details`);
      setDetails(response.data);
    } catch (err) {
      console.error('Ошибка при получении деталей кассеты:', err);
      setError(
        err.response?.data?.message ||
        err.message ||
        'Ошибка при загрузке деталей кассеты.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <Dialog
      open={isOpen}
      onClose={onClose}
      maxWidth="lg"
      fullWidth
      scroll="paper"
      aria-labelledby="cassette-details-dialog-title"
    >
      <style>{`
        @media print {
          @page { margin: 1cm; size: A4 portrait; } /* Настройка страницы для печати */
          body { -webkit-print-color-adjust: exact; } /* Печать цветов как есть */
          .no-print { display: none !important; } /* Скрыть элементы с классом no-print */
          .MuiDialog-container, .MuiDialog-paper {
            position: static !important; /* Печатать как обычный элемент */
            box-shadow: none !important;
            margin: 0 !important;
            max-height: none !important;
            max-width: none !important;
            width: 100% !important;
            height: auto !important;
          }
          .MuiDialog-paperScrollPaper {
             max-height: none !important;
          }
          .MuiDialogContent-root {
             padding-top: 0 !important;
             padding-bottom: 0 !important;
          }
          table { width: 100%; font-size: 9pt; border-collapse: collapse; } /* Стили таблицы */
          th, td { border: 1px solid #000 !important; padding: 3px !important; vertical-align: top; } /* Стили ячеек */
          th { background-color: #f5f5f5 !important; } /* Цвет фона шапки */
        }
      `}</style>

      <DialogTitle id="cassette-details-dialog-title" ref={componentRef}>
        {/* Информация о кассете в заголовке диалога */}
        {details ? (
          <Box display="flex" justifyContent="space-between" alignItems="center">
            <Box>
              <Typography variant="h6" component="span">
                Отчет по кассете - {details.cassette.id}
              </Typography>
              <Chip
                label={details.cassette.status}
                color={CASSETTE_STATUS_COLORS[details.cassette.status] || CASSETTE_STATUS_COLORS['default']}
                size="small"
                sx={{ ml: 1 }} // Отступ слева
              />
            </Box>
            <Box className="no-print"> {/* Кнопка "Печать" не будет печататься */}
              <IconButton
                onClick={handlePrint}
                color="primary"
                size="small"
                aria-label="Печать"
              >
                <Tooltip title="Печать отчета">
                  <PrintIcon />
                </Tooltip>
              </IconButton>
            </Box>
          </Box>
        ) : (
          <Typography variant="h6">
            Отчет по кассете
          </Typography>
        )}
      </DialogTitle>

      <DialogContent dividers>
        {loading && (
          <Box display="flex" justifyContent="center" my={2}>
            <CircularProgress />
          </Box>
        )}
        {error && (
          <Alert severity="error" sx={{ my: 2 }}>
            {error}
          </Alert>
        )}
        {!loading && !error && details && (
          <Box sx={{ py: 1 }}>
            {/* Информация о кассете */}
            <Typography variant="h6" gutterBottom>
              Информация о кассете
            </Typography>
            <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
              <Typography variant="body2"><strong>ID:</strong> {details.cassette.id}</Typography>
              <Typography variant="body2"><strong>Статус:</strong> <Chip label={details.cassette.status} color={CASSETTE_STATUS_COLORS[details.cassette.status] || CASSETTE_STATUS_COLORS['default']} size="small" /></Typography>
              <Typography variant="body2"><strong>Дата создания:</strong> {fmtDateTime(details.cassette.createdAt)}</Typography>
              <Typography variant="body2"><strong>Создал:</strong> {details.cassette.createdBy || 'N/A'}</Typography>
              <Typography variant="body2"><strong>Заметки:</strong> {details.cassette.notes || 'Нет'}</Typography>
            </Paper>

            {/* Список листов */}
            <Typography variant="h6" gutterBottom>
              Список листов в кассете
            </Typography>
            <Typography variant="body2" color="textSecondary" paragraph>
              Всего листов: {details.sheets.length}
            </Typography>
            {details.sheets.length > 0 ? (
              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>ID Листа (MatId)</TableCell>
                      <TableCell>Плавка</TableCell>
                      <TableCell>Партия</TableCell>
                      <TableCell>Пачка (Система)</TableCell>
                      <TableCell>Марка стали</TableCell>
                      <TableCell>Размеры</TableCell>
                      <TableCell>Номер листа в пачке</TableCell>
                      <TableCell>Номер сляба</TableCell>
                      <TableCell>Вес</TableCell>
                      <TableCell>Номер заказа</TableCell>
                      <TableCell>Статус</TableCell>
                      <TableCell>Дата нагрева</TableCell>
                      <TableCell>Статус после нагрева ГП</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {details.sheets.map((sheet, index) => (
                      <TableRow key={`${sheet.matId}-${index}`}>
                        <TableCell>{sheet.matId}</TableCell>
                        <TableCell>{sheet.meltNumber}</TableCell>
                        <TableCell>{sheet.batchNumber}</TableCell>
                        <TableCell>{sheet.packNumberSystem}</TableCell>
                        <TableCell>{sheet.steelGrade}</TableCell>
                        <TableCell>{sheet.sheetDimensions}</TableCell>
                        <TableCell>{sheet.sheetNumberInPack}</TableCell>
                        <TableCell>{sheet.slabNumber}</TableCell>
                        <TableCell>{sheet.weight}</TableCell>
                        <TableCell>{sheet.orderNumber}</TableCell>
                        <TableCell>{sheet.status}</TableCell>
                        <TableCell>{fmtDateTime(sheet.actualHeatDate)}</TableCell>
                        <TableCell>{sheet.statusAfterAcceptanceGP}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            ) : (
              <Typography variant="body2" align="center" color="textSecondary" sx={{ py: 2 }}>
                Кассета не содержит листов.
              </Typography>
            )}
          </Box>
        )}
        {!loading && !error && !details && !cassetteId && (
          <Typography variant="body2" align="center" color="textSecondary">
            Нет данных для отображения.
          </Typography>
        )}
      </DialogContent>
      <DialogActions className="no-print"> {/* Кнопка "Закрыть" не будет печататься */}
        <Button onClick={onClose} color="primary">
          Закрыть
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default CassetteDetailsModal;