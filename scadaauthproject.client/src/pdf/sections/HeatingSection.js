import autoTable from 'jspdf-autotable';
import { chartToImage } from '../utils/chartToImage';

const fmtDate = v => v ? new Date(v).toLocaleString('ru-RU') : '—';
const fmtMin  = v => v != null ? `${Number(v).toFixed(1)} мин` : '—';

export async function drawHeating(pdf, session, chart) {
    const pageWidth  = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();

    // ── Заголовок секции с цветной полосой слева ──
    pdf.setFillColor(21, 101, 192);
    pdf.rect(10, 72, 3, 7, 'F');

    pdf.setFontSize(15);
    pdf.setFont('Roboto', 'bold');
    pdf.setTextColor(21, 101, 192);
    pdf.text('НАГРЕВ', 17, 78);

    // ── Рамка для графика ──
    pdf.setDrawColor(220, 220, 220);
    pdf.setLineWidth(0.3);
    pdf.rect(10, 82, pageWidth - 20, 85);

    // ── График (уменьшили с 90 до 85 мм) ──
    const image = await chartToImage(chart);
    pdf.addImage(image, 'PNG', 12, 83, pageWidth - 24, 83);

    // ── Таблица параметров нагрева (сразу под графиком) ──
    pdf.setTextColor(0, 0, 0);
    autoTable(pdf, {
        startY: 172,   // ⬅️ подняли выше (было 185)
        theme: 'grid',
        margin: { left: 20, right: 20 },
        styles: {
            font: 'Roboto',
            fontSize: 10,
            cellPadding: 3,
            halign: 'center',
        },
        headStyles: {
            fillColor: [21, 101, 192],
            textColor: [255, 255, 255],
            fontStyle: 'bold',
        },
        columnStyles: {
            0: { cellWidth: 90 },
            1: { cellWidth: 90 },
            2: { cellWidth: 90 },
        },
        head: [['Вход в печь', 'Выход из печи', 'Время нагрева']],
        body: [[
            fmtDate(session?.enteredAt),
            fmtDate(session?.exitedAt),
            fmtMin(session?.totalMin),
        ]],
    });

    // ── Проверка: если таблица ушла за пределы — не страшно, footer её перекроет ──
    const tableEnd = pdf.lastAutoTable.finalY;
    const footerY  = pageHeight - 12;
    if (tableEnd > footerY) {
        console.warn(`[PDF] Таблица нагрева (${tableEnd}мм) перекрывает footer (${footerY}мм)`);
    }
}