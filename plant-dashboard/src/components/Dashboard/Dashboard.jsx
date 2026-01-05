import React, { useEffect, useState, useMemo, useCallback } from "react";
import { database } from "../../firebase";
import { ref, onValue, set, query, limitToLast } from "firebase/database";
import "./Dashboard.css";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
} from "chart.js";
import Header from "../Header/Header";
import SystemControls from "../SystemControls/SystemControls";
import MoistureChart from "../MoistureChart/MoistureChart";
import UserManagement from "../Admin/UserManagement";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

function Dashboard({ onLogout, userRole }) {
  const [view, setView] = useState("monitor");
  
  const [soilMoisture, setSoilMoisture] = useState(0);
  const [pumpStatus, setPumpStatus] = useState(0);
  const [minThreshold, setMinThreshold] = useState(40);
  const [maxThreshold, setMaxThreshold] = useState(70);
  
  const [systemMode, setSystemMode] = useState(0);
  const [dripOnTime, setDripOnTime] = useState(5);
  const [dripOffTime, setDripOffTime] = useState(10);
  
  const [history, setHistory] = useState([]);
  
  const [lastUpdate, setLastUpdate] = useState(Date.now());
  const [isOffline, setIsOffline] = useState(false);
  const [alertMsg, setAlertMsg] = useState("");

  // Check offline status
  useEffect(() => {
    const interval = setInterval(() => {
      const offline = Date.now() - lastUpdate > 65000;
      setIsOffline(offline);
    }, 5000);
    return () => clearInterval(interval);
  }, [lastUpdate]);

  // Realtime subscriptions
  useEffect(() => {
    if (view !== "monitor") return;

    const soilRef = ref(database, "system/soilMoisture");
    const pumpRef = ref(database, "system/pumpStatus");
    const minRef = ref(database, "system/threshold/min");
    const maxRef = ref(database, "system/threshold/max");
    const modeRef = ref(database, "system/mode");
    const dripOnRef = ref(database, "system/drip/on");
    const dripOffRef = ref(database, "system/drip/off");

    const soilUnsubscribe = onValue(soilRef, (snapshot) => {
      setSoilMoisture(snapshot.val() ?? 0);
      setLastUpdate(Date.now());
      setIsOffline(false);
    });

    const pumpUnsubscribe = onValue(pumpRef, (snapshot) => 
      setPumpStatus(snapshot.val() ?? 0)
    );
    
    const minUnsubscribe = onValue(minRef, (snapshot) => 
      setMinThreshold(snapshot.val() ?? 40)
    );
    
    const maxUnsubscribe = onValue(maxRef, (snapshot) => 
      setMaxThreshold(snapshot.val() ?? 70)
    );
    
    const modeUnsubscribe = onValue(modeRef, (snapshot) => 
      setSystemMode(snapshot.val() ?? 0)
    );
    
    const dripOnUnsubscribe = onValue(dripOnRef, (snapshot) => 
      setDripOnTime(snapshot.val() ?? 5)
    );
    
    const dripOffUnsubscribe = onValue(dripOffRef, (snapshot) => 
      setDripOffTime(snapshot.val() ?? 10)
    );

    // History subscription with FIXED timestamp handling
    const historyRef = query(ref(database, "history"), limitToLast(20));
    const historyUnsubscribe = onValue(historyRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        
        // FIXED: Handle both new (number) and old (".sv") timestamps
        const historyArray = Object.entries(data).map(([key, item]) => {
          let timestamp;
          
          // FIXED: Robust timestamp parsing (Handle number, string number, and push key)
          const tsNum = Number(item.ts);

          // Case 1: Valid numeric timestamp (or string number like "176...")
          if (!isNaN(tsNum)) {
            timestamp = new Date(tsNum);
          }
          // Case 2: Invalid timestamp (".sv" or missing) - Extract from push key
          else {
            // Firebase push keys encode timestamp in first 8 chars (base36)
            const timestampFromKey = parseInt(key.substring(1, 9), 36);
            timestamp = new Date(timestampFromKey);
          }
          
          return {
            time: timestamp.toLocaleTimeString('vi-VN', {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit'
            }),
            value: item.val ?? 0
          };
        });
        
        setHistory(historyArray);
      } else {
        setHistory([]);
      }
    });

    return () => {
      soilUnsubscribe();
      pumpUnsubscribe();
      minUnsubscribe();
      maxUnsubscribe();
      modeUnsubscribe();
      dripOnUnsubscribe();
      dripOffUnsubscribe();
      historyUnsubscribe();
    };
  }, [view]);

  // Alert logic with both dry and wet warnings
  useEffect(() => {
    if (isOffline) {
       setAlertMsg("⚠️ MẤT KẾT NỐI: Thiết bị không phản hồi!");
       return;
    }

    if (soilMoisture < minThreshold - 5) {
      setAlertMsg(`⚠️ Cảnh báo: Đất Quá Khô (${soilMoisture}%)`);
    } else if (soilMoisture > maxThreshold + 10) {
      setAlertMsg(`⚠️ Cảnh báo: Đất Quá Ướt (${soilMoisture}%)`);
    } else {
      setAlertMsg("");
    }
  }, [soilMoisture, minThreshold, maxThreshold, isOffline]);

  const updateValue = useCallback((path, value) => {
    set(ref(database, path), value).catch(err => {
      console.error("Error updating Firebase:", err);
      alert("Lỗi cập nhật dữ liệu!");
    });
  }, []);

  // Memoize chart data to prevent unnecessary re-renders
  const chartData = useMemo(() => ({
    labels: history.map(h => h.time),
    datasets: [
      {
        label: "Độ ẩm (%)",
        data: history.map(h => h.value),
        borderColor: "rgb(34, 197, 94)",
        backgroundColor: "rgba(34, 197, 94, 0.1)",
        tension: 0.4,
        fill: true
      }
    ]
  }), [history]);

  if (view === "users") {
    return (
      <UserManagement onBack={() => setView("monitor")} />
    );
  }

  return (
    <div className="app">
      <Header 
        onLogout={onLogout} 
        userRole={userRole}
        onManageUsers={() => setView("users")}
      />
      
      {alertMsg && (
        <div className={`alert-banner ${isOffline ? "alert-offline" : "alert-warning"}`}>
           {alertMsg}
        </div>
      )}

      <SystemControls
        soilMoisture={soilMoisture}
        pumpStatus={pumpStatus}
        systemMode={systemMode}
        minThreshold={minThreshold}
        maxThreshold={maxThreshold}
        dripOnTime={dripOnTime}
        dripOffTime={dripOffTime}
        setMinThreshold={setMinThreshold}
        setMaxThreshold={setMaxThreshold}
        setSystemMode={setSystemMode}
        setDripOnTime={setDripOnTime}
        setDripOffTime={setDripOffTime}
        updateValue={updateValue}
        userRole={userRole} 
      />
      <MoistureChart chartData={chartData} />
    </div>
  );
}

export default Dashboard;