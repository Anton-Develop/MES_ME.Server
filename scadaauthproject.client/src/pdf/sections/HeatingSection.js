import {chartToImage}from '../utils/chartToImage';

const fmtDate = value =>
    value
        ? new Date(value).toLocaleString('ru-RU')
        : '—';

const fmtMin = value =>
    value != null
        ? `${Number(value).toFixed(1)} мин`
        : '—';

export async function drawHeating(pdf,session,chart){

pdf.setFontSize(14);
pdf.setFont('Roboto', 'bold');

pdf.text('НАГРЕВ',15,90);



const image= await chartToImage(chart);

pdf.addImage(    image,'PNG', 10, 55, 277, 120);

pdf.setFontSize(11);

pdf.text(`Вход: ${fmtDate(session.enteredAt)}`,15,225);

pdf.text(`Выход: ${fmtDate(session.exitedAt)}`,15,232);

pdf.text(`Время нагрева: ${fmtMin(session.totalMin)}`,15,239);
}