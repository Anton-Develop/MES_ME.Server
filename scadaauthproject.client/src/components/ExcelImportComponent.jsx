// src/components/ExcelImportComponent.jsx
import React, { useState } from 'react';
import {
  Container,
  Paper,
  Typography,
  Button,
  Box,
  Alert,
  LinearProgress,
  Stack,
  IconButton,
  Tooltip,
  CircularProgress,
} from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import CancelIcon from '@mui/icons-material/Cancel';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import api from '../api';

const ExcelImportComponent = () => {
  const [selectedFile, setSelectedFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [fileInfo, setFileInfo] = useState(null);

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Б';
    const k = 1024;
    const sizes = ['Б', 'КБ', 'МБ', 'ГБ'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handleFileChange = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    if (!file.name.endsWith('.xlsx')) {
      setError('Поддерживается только файл в формате .xlsx');
      setSelectedFile(null);
      setFileInfo(null);
      // ИСПРАВЛЕНО: сбрасываем значение input, чтобы можно было выбрать тот же файл повторно
      event.target.value = '';
      return;
    }

    setSelectedFile(file);
    setError('');
    setMessage('');
    setFileInfo({
      name: file.name,
      size: formatFileSize(file.size),
    });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!selectedFile) {
      setError('Пожалуйста, выберите файл для импорта.');
      return;
    }

    setIsUploading(true);
    setMessage('');
    setError('');

    const formData = new FormData();
    formData.append('file', selectedFile);

    try {
      const response = await api.post('/import/upload-excel', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (progressEvent) => {
          const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          setUploadProgress(progress);
        },
      });

      const data = response.data;
      setMessage(
        data.message ||
          `Успешно импортировано ${data.count ?? 'неизвестное количество'} листов.`
      );
      setSelectedFile(null);
      setFileInfo(null);
      setUploadProgress(0);
    } catch (err) {
      console.error('Ошибка импорта:', err);

      let errorMsg = 'Неизвестная ошибка при загрузке файла.';
      if (err.response) {
        const { status, data } = err.response;
        if (status === 401) {
          errorMsg = 'Сессия истекла. Пожалуйста, войдите снова.';
        } else if (data?.message || data?.Message || data?.error) {
          errorMsg = data.message || data.Message || data.error;
        } else {
          errorMsg = `Ошибка сервера (${status})`;
        }
      } else if (err.request) {
        errorMsg = 'Нет ответа от сервера. Проверьте соединение.';
      }

      setError(errorMsg);
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const handleReset = () => {
    setSelectedFile(null);
    setError('');
    setMessage('');
    setFileInfo(null);
    setUploadProgress(0);
  };

  return (
    <Container maxWidth="md" sx={{ mt: 4 }}>
      <Paper sx={{ p: 3, borderRadius: 2, boxShadow: 3 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" mb={3}>
          <Typography variant="h5" fontWeight="bold" color="primary">
            Импорт данных из Excel
          </Typography>
          <Tooltip title="Файл должен быть в формате .xlsx. Данные будут импортированы в таблицу «Входные данные».">
            {/* ИСПРАВЛЕНО: заменён alert на Tooltip — нативный alert блокирует поток */}
            <Button size="small" sx={{ color: 'text.secondary', minWidth: 32 }}>
              ?
            </Button>
          </Tooltip>
        </Stack>

        {/* ИСПРАВЛЕНО: форма использует onSubmit, не нужен отдельный <form> тег с вложенными кнопками type="submit" */}
        <Box component="form" onSubmit={handleSubmit}>
          <Box sx={{ mb: 3 }}>
            <input
              accept=".xlsx"
              style={{ display: 'none' }}
              id="excel-file-input"
              type="file"
              onChange={handleFileChange}
            />
            <label htmlFor="excel-file-input">
              <Button
                variant="outlined"
                component="span"
                startIcon={<CloudUploadIcon />}
                fullWidth
                disabled={isUploading}
                sx={{ py: 2, textTransform: 'none', fontSize: '1rem' }}
              >
                {selectedFile ? 'Файл выбран' : 'Выбрать файл Excel (.xlsx)'}
              </Button>
            </label>

            {selectedFile && fileInfo && (
              <Box sx={{ mt: 2, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                <Stack direction="row" alignItems="center" spacing={2}>
                  <Typography variant="body2" noWrap>
                    📄 {fileInfo.name}
                  </Typography>
                  <Typography variant="caption" color="textSecondary">
                    ({fileInfo.size})
                  </Typography>
                  <Box sx={{ flexGrow: 1 }} />
                  <IconButton size="small" onClick={handleReset} aria-label="сбросить">
                    <CancelIcon fontSize="small" />
                  </IconButton>
                </Stack>
                <Typography variant="caption" color="textSecondary" sx={{ mt: 1, display: 'block' }}>
                  Ожидается файл с листом «База ММК» и заголовками в строке 1.
                </Typography>
              </Box>
            )}
          </Box>

          <Stack direction="row" spacing={2} mb={3}>
            <Button
              type="submit"
              variant="contained"
              color="primary"
              disabled={!selectedFile || isUploading}
              fullWidth
              sx={{ py: 1.5 }}
            >
              {isUploading ? (
                <Stack direction="row" alignItems="center" spacing={1}>
                  <CircularProgress size={16} color="inherit" />
                  <span>Импорт...</span>
                </Stack>
              ) : (
                'Импортировать'
              )}
            </Button>

            {selectedFile && (
              <Button
                variant="outlined"
                color="error"
                onClick={handleReset}
                fullWidth
                sx={{ py: 1.5 }}
              >
                Сбросить
              </Button>
            )}
          </Stack>

          {isUploading && (
            <Box sx={{ mb: 3 }}>
              <LinearProgress variant="determinate" value={uploadProgress} />
              <Typography variant="caption" color="textSecondary" align="right" display="block">
                {uploadProgress}% завершено
              </Typography>
            </Box>
          )}

          {message && (
            <Alert severity="success" icon={<CheckCircleIcon fontSize="inherit" />} sx={{ mb: 1 }}>
              {message}
            </Alert>
          )}
          {error && (
            <Alert severity="error" icon={<CancelIcon fontSize="inherit" />}>
              {error}
            </Alert>
          )}
        </Box>
      </Paper>

      <Box sx={{ mt: 3, textAlign: 'center' }}>
        {/* ИСПРАВЛЕНО: "Дождем." → осмысленный текст */}
        <Typography variant="body2" color="textSecondary">
          После импорта данные появятся в разделе «Входные данные».
        </Typography>
      </Box>
    </Container>
  );
};

export default ExcelImportComponent;
