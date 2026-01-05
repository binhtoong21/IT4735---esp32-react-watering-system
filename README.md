# IoT Smart Plant Watering System 🌿

An intelligent, automated plant watering system built with **ESP32**, **Firebase**, and **ReactJS**. This system allows for real-time soil moisture monitoring, remote control via a web dashboard, and configurable automatic watering modes.

![Project Banner](https://img.shields.io/badge/Status-Active-success)
![License](https://img.shields.io/badge/License-MIT-blue)

## ✨ Key Features

- **Real-time Monitoring:** View current soil moisture levels and pump status instantly.
- **Remote Control:** Manually turn the water pump on/off from anywhere via the web dashboard.
- **3 Operation Modes:**
  1.  **Manual Mode:** Direct control via User/Admin.
  2.  **Auto Mode (Sensor):** Automatically waters when moisture drops below a configurable threshold.
  3.  **Auto Mode (Drip):** Cyclic watering (Timer-based) with a safety moisture cutoff.
- **Admin Dashboard:** Manage users (lock/unlock accounts) and configure system thresholds.
- **Data History:** Visual chart of moisture levels over time using Chart.js.

## 🛠 Tech Stack

### Hardware
- **Microcontroller:** ESP32 (WROOM-32)
- **Sensors:** Capacitive Soil Moisture Sensor v1.2
- **Actuators:** Relay Module (Active Low/High) + Mini Submersible Pump
- **Power:** 5V Power Supply

### Firmware
- **Platform:** Arduino IDE
- **Libraries:**
  - `WiFi.h`, `WiFiManager.h` (Configuration)
  - `Firebase_ESP_Client.h` (Realtime Database)

### Frontend (Web Dashboard)
- **Framework:** ReactJS (Vite)
- **Database:** Firebase Realtime Database
- **Authentication:** Firebase Auth
- **Styling:** CSS3 (Modern, Responsive)
- **Charts:** Chart.js, react-chartjs-2

## 📂 Project Structure

```bash
├── esp32/                  # Firmware code for ESP32
│   └── esp32.ino          # Main Arduino sketch
├── plant-dashboard/        # ReactJS Web Application
│   ├── src/               # Source code
│   ├── public/            # Static assets
│   └── package.json       # Dependencies
└── DB.json                 # Database Schema Snapshot
```

## 🚀 Getting Started

### 1. Hardware Setup
Connect the Soil Moisture Sensor to pin `34` (Analog) and the Relay to pin `26` (Digital) on the ESP32. Ensure common ground.

### 2. Firmware (ESP32)
1.  Open `esp32/esp32.ino` in Arduino IDE.
2.  Install required libraries (`Firebase ESP Client`, `WiFiManager`).
3.  Upload to ESP32.
4.  On first run, connect to the `AutoConnectAP` WiFi to configure your home WiFi credentials.

### 3. Web Dashboard
1.  Navigate to the `plant-dashboard` folder:
    ```bash
    cd plant-dashboard
    ```
2.  Install dependencies:
    ```bash
    npm install
    ```
3.  Set up Firebase:
    - Create a `.env` file based on your Firebase credentials.
    - Enable Authentication (Email/Password) and Realtime Database.
4.  Run locally:
    ```bash
    npm run dev
    ```

## 📜 License

This project is open-source and available under the [MIT License](LICENSE).
