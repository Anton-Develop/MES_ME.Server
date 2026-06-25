import autoTable from 'jspdf-autotable';

export function drawHeader(pdf, meta) {
    pdf.setFontSize(18);
    pdf.setFont('Roboto', 'bold');
    pdf.text('ОТЧЕТ ПО ТЕРМООБРАБОТКЕ ЛИСТА', 148, 15, { align: 'center' });
    
    autoTable(pdf, {
        startY: 25,
        theme: 'grid',
        styles: {
            fontSize: 10,
            font: 'Roboto',  // ⬅️ Явно указываем шрифт
            fontStyle: 'normal'
        },
        headStyles: {
            font: 'Roboto',  // ⬅️ Для заголовков (если есть)
            fontStyle: 'bold'
        },
        body: [
            ['Лист', meta.sheet],
            ['Сляб', meta.slab ?? '—'],
            ['Плавка', meta.melt],
            ['Партия', meta.partNo],
            ['Пачка', meta.pack],
            ['Марка', meta.alloyCodeText],
            ['Толщина', `${meta.thickness} мм`]
        ]
    });
}