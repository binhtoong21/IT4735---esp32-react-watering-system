import React, { useMemo } from "react";
import { Line } from "react-chartjs-2";
import "./MoistureChart.css";

function MoistureChart({ chartData }) {
  // Memoize chart options to prevent re-creation
  const options = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index',
      intersect: false,
    },
    plugins: {
      legend: {
        display: true,
        position: 'top',
      },
      title: {
        display: false,
      },
      tooltip: {
        callbacks: {
          label: function(context) {
            return `Độ ẩm: ${context.parsed.y}%`;
          }
        }
      }
    },
    scales: {
      x: {
        display: true,
        title: {
          display: true,
          text: 'Thời gian'
        },
        ticks: {
          maxRotation: 45,
          minRotation: 45
        }
      },
      y: {
        display: true,
        title: {
          display: true,
          text: 'Độ ẩm đất (%)'
        },
        min: 0,
        max: 100,
        ticks: {
          stepSize: 10,
          callback: function(value) {
            return value + '%';
          }
        },
        grid: {
          color: 'rgba(0, 0, 0, 0.1)',
        }
      }
    }
  }), []);

  return (
    <section className="chart-card">
      <div className="chart-card__header">
        <h2>Đồ thị độ ẩm</h2>
        <p>20 lần đo gần nhất (mỗi 60 giây)</p>
      </div>
      <div className="chart-card__body">
        {chartData.labels.length > 0 ? (
          <Line data={chartData} options={options} />
        ) : (
          <div className="chart-empty">
            <p>Đang chờ dữ liệu từ thiết bị...</p>
            <small>Dữ liệu sẽ được cập nhật sau 60 giây</small>
          </div>
        )}
      </div>
    </section>
  );
}

export default MoistureChart;