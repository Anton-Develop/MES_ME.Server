import React, { useState, useEffect, useRef } from 'react';
import { useReactToPrint } from 'react-to-print';
import {
    Dialog, DialogTitle, DialogContent, DialogActions, Button,
    Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
    Typography, Box, CircularProgress, IconButton, Paper
} from '@mui/material';
import { Print as PrintIcon, Close as CloseIcon } from '@mui/icons-material';
import api from '../api';
import dayjs from 'dayjs';

const PlanDetailsDialog = ({ open, planId, onClose }) => {
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState(null);
    const [error, setError] = useState('');

    const componentRef = useRef();

    useEffect(() => {
        if (open && planId) {
            fetchDetails();
        } else {
            setData(null);
            setError('');
        }
    }, [open, planId]);

    const fetchDetails = async () => {
        setLoading(true);
        setError('');
        setData(null);
        try {
            const response = await api.get(`/annealingbatchplan/${planId}/details`);
            setData(response.data);
        } catch (err) {
            setError('Ошибка загрузки данных плана');
            console.error(err);
            setData(null);
        } finally {
            setLoading(false);
        }
    };

    // ИСПРАВЛЕНИЕ: Используем правильный API для react-to-print
    const handlePrint = useReactToPrint({
        content: () => componentRef.current, // для версии 2.x используем content
        documentTitle: `Отчет_План_№${data?.planId || planId}`,
        onBeforePrint: () => {
            if (!componentRef.current) {
                console.warn("Контент для печати не найден.");
                return false;
            }
        },
    });

    // ИСПРАВЛЕНИЕ: Не вызываем handlePrint напрямую в рендере
    const onPrintClick = () => {
        if (!data || !componentRef.current) {
            alert("Данные для печати еще не готовы.");
            return;
        }

        // Для версии 2.x handlePrint не возвращает Promise, просто вызываем
        if (handlePrint) {
            handlePrint();
        } else {
            console.error("Функция печати не инициализирована");
        }
    };

    const formatDate = (dateStr) => {
        if (!dateStr) return '-';
        return dayjs(dateStr).format('DD.MM.YYYY HH:mm');
    };

    const renderReportContent = () => (
        <div ref={componentRef} style={{ padding: '20px', backgroundColor: 'white' }}>
            <Typography variant="h5" gutterBottom>
                Отчет по плану закалки № {data.planId}
            </Typography>
            <Typography variant="body1">
                <strong>Имя плана:</strong> {data.planName} |
                <strong> Печь:</strong> {data.furnaceNumber} |
                <strong> Статус:</strong> {data.status}
            </Typography>
            <Typography variant="body1">
                <strong>Запланировано:</strong> {formatDate(data.scheduledStartTime)} — {formatDate(data.scheduledEndTime)}
            </Typography>
            <Typography variant="body1" sx={{ mt: 1 }}>
                <strong>Всего листов:</strong> {data.totalSheetsCount} |
                <strong> Общий вес:</strong> {data.totalWeight?.toFixed(2) || '0'} кг
            </Typography>
            <hr style={{ marginTop: 10, borderColor: '#000' }} />

            <TableContainer component={Paper} variant="outlined" sx={{ boxShadow: 'none' }}>
                <Table size="small">
                    <TableHead>
                        <TableRow>
                            <TableCell>№ листа</TableCell>
                            <TableCell>Mat ID</TableCell>
                            <TableCell>Плавка</TableCell>
                            <TableCell>Партия</TableCell>
                            <TableCell>Пачка</TableCell>
                            <TableCell>Марка стали</TableCell>
                            <TableCell>Размеры (мм)</TableCell>
                            <TableCell>Сляб №</TableCell>
                            <TableCell align="right">Вес (кг)</TableCell>
                            <TableCell>Дата закалки</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {data.sheets?.map((sheet, index) => (
                            <TableRow key={sheet.matId || index}>
                                <TableCell>{sheet.sheetNumber || index + 1}</TableCell>
                                <TableCell>{sheet.matId ?? sheet.mat}</TableCell>
                                <TableCell>{sheet.meltNumber}</TableCell>
                                <TableCell>{sheet.batchNumber}</TableCell>
                                <TableCell>{sheet.packNumber}</TableCell>
                                <TableCell>{sheet.steelGrade}</TableCell>
                                <TableCell>{sheet.dimensions}</TableCell>
                                <TableCell>{sheet.slabNumber}</TableCell>
                                <TableCell align="right">{sheet.netWeight?.toFixed(2) || '0'}</TableCell>
                                <TableCell>{formatDate(sheet.quenchingDate)}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </TableContainer>
        </div>
    );

    return (
        <Dialog
            open={open}
            onClose={onClose}
            maxWidth="lg"
            fullWidth
            PaperProps={{ sx: { '@media print': { boxShadow: 'none', background: 'white' } } }}
        >
            <DialogTitle>
                <Box display="flex" justifyContent="space-between" alignItems="center">
                    <Typography variant="h6">
                        Детали плана: {data ? data.planName : `ID: ${planId}`}
                    </Typography>
                    <Box className="no-print">
                        <IconButton
                            onClick={onPrintClick}
                            color="primary"
                            title="Печать / PDF"
                            disabled={!data}
                        >
                            <PrintIcon />
                        </IconButton>
                        <IconButton onClick={onClose} color="default">
                            <CloseIcon />
                        </IconButton>
                    </Box>
                </Box>
            </DialogTitle>

            <DialogContent dividers>
                {loading && (
                    <Box display="flex" justifyContent="center" py={5}>
                        <CircularProgress />
                    </Box>
                )}
                {error && <Typography color="error">{error}</Typography>}
                {!loading && !error && data && renderReportContent()}
                {!loading && !error && !data && (
                    <Typography variant="body2" color="text.secondary" align="center">
                        Нет данных для отображения.
                    </Typography>
                )}
            </DialogContent>

            <DialogActions className="no-print">
                <Button onClick={onClose}>Закрыть</Button>
                <Button
                    variant="contained"
                    startIcon={<PrintIcon />}
                    onClick={onPrintClick}
                    disabled={!data}
                >
                    Печать в PDF
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default PlanDetailsDialog;