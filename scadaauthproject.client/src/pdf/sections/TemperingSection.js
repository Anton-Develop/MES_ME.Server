import autoTable from 'jspdf-autotable';
import { chartToImage } from '../utils/chartToImage';

const fmtDate = v => v ? new Date(v).toLocaleString('ru-RU') : '—';
const fmtMin  = v => v != null ? `${Number(v).toFixed(1)} мин` : '—';
const fmtTemp = v => v != null ? `${Number(v).toFixed(1)} °C` : '—';

export async function drawTempering(pdf, temperingData, chart) {
    const pageWidth = pdf.internal.pageSize.getWidth();
    const session = temperingData?.session;

    // ── Заголовок секции с цветной полосой слева ──
    pdf.setFillColor(191, 54, 12); // оранжево-красный
    pdf.rect(10, 10, 3, 8, 'F');

    pdf.setFontSize(16);
    pdf.setFont('Roboto', 'bold');
    pdf.setTextColor(191, 54, 12);
    pdf.text('ОТПУСК', 17, 17);

    // ── Таблица параметров отпуска ──
    pdf.setTextColor(0, 0, 0);
    autoTable(pdf, {
        startY: 23,
        theme: 'grid',
        margin: { left: 20, right: 20 },
        styles: {
            font: 'Roboto',
            fontSize: 10,
            cellPadding: 3,
            halign: 'center',
        },
        headStyles: {
            fillColor: [191, 54, 12],
            textColor: [255, 255, 255],
            fontStyle: 'bold',
        },
        columnStyles: {
            0: { cellWidth: 50 },
            1: { cellWidth: 65 },
            2: { cellWidth: 65 },
            3: { cellWidth: 45 },
            4: { cellWidth: 40 },
        },
        head: [['Печь', 'Загрузка', 'Выгрузка', 'Время в печи', 'Температура']],
        body: [[
            session ? `№${session.furnaceNumber ?? '—'}` : '—',
            fmtDate(session?.loadedAt),
            fmtDate(session?.unloadedAt),
            fmtMin(session?.totalTimeMin),
            fmtTemp(session?.tempRef),
        ]],
    });

    // ── Рамка для графика ──
    const chartStartY = pdf.lastAutoTable.finalY + 5;
    pdf.setDrawColor(220, 220, 220);
    pdf.setLineWidth(0.3);
    pdf.rect(10, chartStartY, pageWidth - 20, 90);

    // ── График ──
    const image = await chartToImage(chart);
    pdf.addImage(image, 'PNG', 12, chartStartY + 2, pageWidth - 24, 86);

    // ── Подписи ответственных лиц ──
    const signY = chartStartY + 100;
    pdf.setFontSize(10);
    pdf.setFont('Roboto', 'normal');
    pdf.setTextColor(60, 60, 60);

   /* const signatures = [
        { label: 'Оператор смены',    x: 15 },
        { label: 'Контролёр ОТК',     x: 110 },
        { label: 'Начальник смены',   x: 205 },
    ];

    signatures.forEach(({ label, x }) => {
        pdf.text(label, x, signY);
        pdf.setDrawColor(150, 150, 150);
        pdf.setLineWidth(0.3);
        pdf.line(x, signY + 8, x + 70, signY + 8);
        pdf.setFontSize(8);
        pdf.setTextColor(150, 150, 150);
        pdf.text('(подпись / ФИО)', x, signY + 13);
        pdf.setFontSize(10);
        pdf.setTextColor(60, 60, 60);
    });*/
}