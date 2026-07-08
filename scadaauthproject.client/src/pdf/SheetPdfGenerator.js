import jsPDF from 'jspdf';
import { savePdf } from './utils/savePdf';
import { drawHeader } from './sections/HeaderSection';
import { drawHeating } from './sections/HeatingSection';
import { drawTempering } from './sections/TemperingSection';
import { registerFonts } from './fonts/fonts';

const fmtDate = v => v ? new Date(v).toLocaleString('ru-RU') : '—';

function addPageFooter(pdf, meta) {
    const totalPages = pdf.internal.getNumberOfPages();
    const pageWidth  = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();

    for (let i = 1; i <= totalPages; i++) {
        pdf.setPage(i);

        pdf.setDrawColor(200, 200, 200);
        pdf.setLineWidth(0.2);
        pdf.line(10, pageHeight - 12, pageWidth - 10, pageHeight - 12);

        pdf.setFont('Roboto', 'normal');
        pdf.setFontSize(8);
        pdf.setTextColor(130, 130, 130);
        pdf.text(`Сформировано: ${fmtDate(new Date())}`, 10, pageHeight - 7);
        pdf.text(`Лист №${meta.sheet}`, pageWidth / 2, pageHeight - 7, { align: 'center' });
        pdf.text(`Стр. ${i} / ${totalPages}`, pageWidth - 10, pageHeight - 7, { align: 'right' });
    }
    pdf.setTextColor(0, 0, 0);
}

export async function generateSheetPdf({
    meta, furnaceSession, quenchingSession, temperingData, heatingChartRef, temperingChartRef
}) {
    const pdf = new jsPDF('l', 'mm', 'a4');

    await registerFonts(pdf);
    pdf.setFont('Roboto', 'normal');

    // ── Страница 1: Шапка + Нагрев (всё на одной странице) ──
    drawHeader(pdf, meta,quenchingSession);

    const heatingChart = heatingChartRef?.current?.chart;
    if (heatingChart) {
        await drawHeating(pdf, furnaceSession, heatingChart);
    }

    // ── Страница 2: Отпуск (если есть) ──
    const temperingChart = temperingChartRef?.current?.chart;
    if (temperingChart) {
        pdf.addPage();
        await drawTempering(pdf, temperingData, temperingChart);
    }

    // ── Footer на всех страницах ──
    addPageFooter(pdf, meta);

    savePdf(pdf, meta);
}