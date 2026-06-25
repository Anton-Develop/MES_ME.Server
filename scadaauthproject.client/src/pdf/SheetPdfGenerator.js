import jsPDF from 'jspdf';
import { savePdf } from './utils/savePdf';
import { drawHeader } from './sections/HeaderSection';
import { drawHeating } from './sections/HeatingSection';
import { drawTempering } from './sections/TemperingSection';
import { registerFonts } from './fonts/fonts';

export async function generateSheetPdf({
    meta,
    furnaceSession,
    temperingData,
    heatingChartRef,
    temperingChartRef,
}) {
    const pdf = new jsPDF('l', 'mm', 'a4');

    await registerFonts(pdf);
    pdf.setFont('Roboto', 'normal');

    // ── Шапка (всегда) ──
    drawHeader(pdf, meta);

    // ── График нагрева (опционально) ──
    const heatingChart = heatingChartRef?.current?.chart;
    if (heatingChart) {
        await drawHeating(pdf, furnaceSession, heatingChart);
    } else {
        console.warn('[PDF] График нагрева отсутствует — секция пропущена');
    }

    // ── График отпуска (опционально, на новой странице) ──
    const temperingChart = temperingChartRef?.current?.chart;
    if (temperingChart) {
        pdf.addPage();
        await drawTempering(pdf, temperingData, temperingChart);
    } else {
        console.warn('[PDF] График отпуска отсутствует — страница не добавлена');
    }

    savePdf(pdf, meta);
}