import autoTable from 'jspdf-autotable';

export function drawHeader(pdf, meta,quenchingSession) {
    const pageWidth = pdf.internal.pageSize.getWidth();

    const fmtVal  = (v, dec = 2, unit = '') => v != null ? `${Number(v).toFixed(dec)}${unit ? ' ' + unit : ''}` : null;
    const fmtTemp = (v) => v  != null ? `${Number(v).toFixed(1)} °C`  : '—';

    // ── Цветная полоса сверху ──
    pdf.setFillColor(21, 101, 192); // #1565c0
    pdf.rect(0, 0, pageWidth, 7, 'F');

    // ── Заголовок ──
    pdf.setFontSize(20);
    pdf.setFont('Roboto', 'bold');
    pdf.setTextColor(21, 101, 192);
    pdf.text('ОТЧЁТ ПО ТЕРМООБРАБОТКЕ ЛИСТА', pageWidth / 2, 20, { align: 'center' });

    // ── Подзаголовок с номером листа ──
    pdf.setFontSize(12);
    pdf.setFont('Roboto', 'normal');
    pdf.setTextColor(100, 100, 100);
    pdf.text(`Лист №${meta.sheet}`, pageWidth / 2, 27, { align: 'center' });

    // ── Таблица метаданных (2 колонки) ──
    pdf.setTextColor(0, 0, 0);
    autoTable(pdf, {
        startY: 30,
        theme: 'plain',
        margin: { left: 10, right: 20 },
        styles: {
            font: 'Roboto',
            fontSize: 10,
            cellPadding: 3,
            lineColor: [220, 220, 220],
            lineWidth: 0.2,
        },
        headStyles: {
            fillColor: [240, 244, 248],
            textColor: [50, 50, 50],
            fontStyle: 'bold',
            fontSize: 9,
        },
        columnStyles: {
            0: { cellWidth: 90, fontStyle: 'bold', fillColor: [248, 249, 250] },
            1: { cellWidth: 50 },
            2: { cellWidth: 90, fontStyle: 'bold', fillColor: [248, 249, 250] },
            3: { cellWidth: 50 },
        },
        body: [
           // ['Лист', meta.sheet ?? '—', 'Сляб', meta.slab ?? '—'],
           // ['Плавка', meta.melt ?? '—', 'Партия', meta.partNo ?? '—'],
           // ['Пачка', meta.pack ?? '—', 'Марка стали', meta.alloyCodeText ?? '—'],
           // ['Толщина', meta.thickness != null ? `${Number(meta.thickness).toFixed(1)} мм` : '—'],

           ['Лист', meta.sheet ?? '—', 'Плавка', meta.melt ?? '—'],
           ['Партия', meta.partNo ?? '—', 'Пачка', meta.pack ?? '—'],
           ['Марка стали', meta.alloyCodeText ?? '—','Толщина', meta.thickness != null ? `${Number(meta.thickness).toFixed(1)} мм` : '—'],
           ['Температура закалочной жидкости', fmtTemp(quenchingSession.tempHaccum ?? '-'),'Давление воды в коллекторе закалочной машины', fmtVal((((quenchingSession.pressTopZak)+(quenchingSession.pressBotZak))/2),2,'бар') ?? '-' ],

        ],
    });
}