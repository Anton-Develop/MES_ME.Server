// src/components/Furnace/TemperatureChart.jsx
import React, { useRef, useLayoutEffect } from 'react';
import Highcharts from 'highcharts';
import HighchartsReact from 'highcharts-react-official';
import Boost from 'highcharts/modules/boost';

// 1. Пытаемся вызвать как функцию (для Webpack 4/5)
if (typeof Boost === 'function') {
    Boost(Highcharts);
} 
// 2. Пытаемся через .default (если Webpack обернул импорт)
else if (Boost && Boost.default && typeof Boost.default === 'function') {
    Boost.default(Highcharts);
}
// 3. В новых версиях Highcharts v12+ модуль может инициализироваться сам при импорте,
// поэтому отсутствие вызова выше не всегда критично.

const TemperatureChart = ({ times, series, title, height = 400 }) => {
  const chartRef = useRef(null);

  const options = {
    chart: {
      type: 'line',
      zoomType: 'x',
      height,
      panning: true,
      panKey: 'shift',
      animation: false,
      boost: {
        enabled: true,
        useGPUTranslations: true,
        seriesThreshold: 1,
      },
    },
    title: { text: title },
    xAxis: {
      type: 'datetime',
      title: { text: 'Время' },
      labels: {
        format: '{value:%H:%M:%S}',
        rotation: -45,
      },
    },
    yAxis: {
      title: { text: 'Температура, °C' },
    },
    tooltip: {
      shared: true,
      crosshairs: true,
      valueSuffix: ' °C',
    },
    series: series.map(s => ({
      name: s.name,
      data: s.data,
      lineWidth: 1.5,
      marker: { enabled: false },
      // Важно для Boost: порог включения ускорения для каждой серии
      boostThreshold: 1, 
      turboThreshold: 0, // Отключаем проверку формата данных для скорости
    })),
  };

  return (
    <HighchartsReact
      highcharts={Highcharts}
      options={options}
      ref={chartRef}
    />
  );
};

export default TemperatureChart;