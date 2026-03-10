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

// Константы для цветов статусов вынесены за предента
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
          @page { margin: 1cm; size: A4 portrait; }
          body { -webkit-print-color-adjust: exact; }
          .no-print { display: none !important; }
          .MuiDialog-container, .MuiDialog-paper {
            position: static !important;
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
          table { width: 100%; font-size: 9pt; border-collapse: collapse; }
          th, td { border: 1px solid #000 !important; padding: 3px !important; vertical-align: top; }
          th { background-color: #f5f5f5 !important; }
        }
      `}</style>

      <DialogTitle id="cassette-details-dialog-title" ref={componentRef}>
        {/* Информация о кассете в заголовке диалога */}
        {/* Используем Box для группировки элементов в заголовке, избегая вложенности h6 в h2 */}
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Box>
            {/* Теперь текст "Отчет по кассете - ID" - это содержимое h6 */}
            <Typography variant="h6" component="span">
              Отчет по кассете - {details ? details.cassette.id : 'Загрузка...'}
            </Typography>
            {/* Чип со статусом добавим рядом, не внутри h6 */}
            {details && (
              <Chip
                label={details.cassette.status}
                color={CASSETTE_STATUS_COLORS[details.cassette.status] || CASSETTE_STATUS_COLORS['default']}
                size="small"
                sx={{ ml: 1, verticalAlign: 'middle' }} // Отступ слева и выравнивание
              />
            )}
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
              {/* Используем div для обертки каждого элемента, чтобы избежать вложенности div (Chip) в p */}
              <Box component="div" mb={0.5}> {/* mb - отступ снизу */}
                <Typography variant="body2" component="span"> {/* span вместо p */}
                  <strong>ID:</strong> {details.cassette.id}
                </Typography>
              </Box>
              <Box component="div" mb={0.5}>
                <Typography variant="body2" component="span">
                  <strong>Статус:</strong>
                </Typography>
                {/* Отдельно выводим чип, не внутри span с strong */}
                <Chip
                  label={details.cassette.status}
                  color={CASSETTE_STATUS_COLORS[details.cassette.status] || CASSETTE_STATUS_COLORS['default']}
                  size="small"
                  sx={{ ml: 1, verticalAlign: 'middle' }}
                />
              </Box>
              <Box component="div" mb={0.5}>
                <Typography variant="body2" component="span">
                  <strong>Дата создания:</strong> {fmtDateTime(details.cassette.createdAt)}
                </Typography>
              </Box>
              <Box component="div" mb={0.5}>
                <Typography variant="body2" component="span">
                  <strong>Создал:</strong> {details.cassette.createdBy || 'N/A'}
                </Typography>
              </Box>
              <Box component="div">
                <Typography variant="body2" component="span">
                  <strong>Заметки:</strong> {details.cassette.notes || 'Нет'}
                </Typography>
              </Box>
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

                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {details.sheets.map((sheet, index) => (
                      <TableRow key={`${sheet.matId}-${index}`}>
                        <TableCell>{sheet.matId}</TableCell>
                        <TableCell>{sheet.meltNumber}</TableCell>
                        <TableCell>{sheet.batchNumber}</TableCell>
                        <TableCell>{sheet.packNumber}</TableCell>
                        <TableCell>{sheet.steelGrade}</TableCell>
                        <TableCell>{sheet.sheetDimensions}</TableCell>
                        <TableCell>{sheet.slabNumber}</TableCell>

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