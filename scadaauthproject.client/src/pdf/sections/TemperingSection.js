import { chartToImage } from '../utils/chartToImage';

const fmtDate = value =>
    value ? new Date(value).toLocaleString('ru-RU') : '—';

const fmtMin = value =>
    value != null ? `${Number(value).toFixed(1)} мин` : '—';

const fmtTemp = value =>
    value != null ? `${Number(value).toFixed(1)} °C` : '—';

export async function drawTempering(pdf, temperingData, chart) {
    // ── Заголовок ──
    pdf.setFontSize(14);
    pdf.setFont('Roboto', 'bold');
    pdf.text('ОТПУСК', 15, 90);

    // ── График ──
    const image = await chartToImage(chart);
    pdf.addImage(image, 'PNG', 10, 55, 277, 120);

    // ── Метаданные сессии отпуска ──
    pdf.setFontSize(11);
    pdf.setFont('Roboto', 'normal');
    
    const session = temperingData?.session;
    if (session) {
        pdf.text(`Печь: №${session.furnaceNumber ?? '—'}`, 15, 185);
        pdf.text(`Загрузка: ${fmtDate(session.loadedAt)}`, 15, 192);
        pdf.text(`Выгрузка: ${fmtDate(session.unloadedAt)}`, 15, 199);
        pdf.text(`Время в печи: ${fmtMin(session.totalTimeMin)}`, 15, 206);
        pdf.text(`Температура: ${fmtTemp(session.tempRef)}`, 15, 213);
    }

    // ── Подписи ──
    pdf.text('Оператор смены', 20, 245);
    pdf.line(70, 245, 170, 245);

    pdf.text('Контролер ОТК', 20, 257);
    pdf.line(70, 257, 170, 257);

    pdf.text('Начальник смены', 20, 269);
    pdf.line(70, 269, 170, 269);
}