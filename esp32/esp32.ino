#include <WiFi.h>
#include <Firebase_ESP_Client.h>
#include <WiFiManager.h> // https://github.com/tzapu/WiFiManager
#include <ArduinoJson.h> // https://github.com/bblanchon/ArduinoJson
#include <FS.h>
#include <SPIFFS.h>

// 1. CẤU HÌNH PHẦN CỨNG
#define SOIL_MOISTURE_PIN 32
#define RELAY_PIN 27
#define LED_PIN 2            // Đèn LED tích hợp (thường là GPIO 2)
#define TRIGGER_PIN 0        // Nút Boot (GPIO 0) để reset cấu hình
#define PUMP_ON LOW
#define PUMP_OFF HIGH

// 2. BIẾN TOÀN CỤC & CONFIG
// Giá trị mặc định (sẽ bị ghi đè bởi giá trị trong flash)
char firebase_host[100] = ""; 
char firebase_auth[100] = ""; // Đây là API Key
char firebase_user[100] = "";
char firebase_pass[100] = "";

// Firebase Objects
FirebaseData fbdo;
FirebaseConfig fbConfig;
FirebaseAuth fbAuth;
FirebaseData streamData;

// Logic Variables
unsigned long lastUpdateMillis = 0;
const long updateInterval = 1000;
bool shouldRunLogicInstantly = false;
int soilMoisturePercentage = 0;
int pumpStatus = 0;

// --- 3-MODE SYSTEM GLOBALS ---
int systemMode = 1; // 0: Manual, 1: Auto Sensor, 2: Auto Drip
// Mặc định an toàn là Auto Sensor

int thresholdMin = 40;
int thresholdMax = 70;

// Drip Mode Params
int dripOnTime = 5;  // Giây
int dripOffTime = 10; // Giây
unsigned long lastDripMillis = 0;
bool isDripOn = false;
bool pumpChanged = false; // Flag to sync status to Firebase

// Calibration
const int AIR_MAX_ADC = 4095;
const int WATER_MIN_ADC = 0;

// File config name
const char* config_file = "/config.json";
bool shouldSaveConfig = false;

// 3. HÀM HỖ TRỢ (FILESYSTEM)
void saveConfigCallback() {
  Serial.println("Should save config");
  shouldSaveConfig = true;
}

void loadConfig() {
  if (SPIFFS.begin(true)) {
    if (SPIFFS.exists(config_file)) {
      File configFile = SPIFFS.open(config_file, "r");
      if (configFile) {
        size_t size = configFile.size();
        std::unique_ptr<char[]> buf(new char[size]);
        configFile.readBytes(buf.get(), size);
        
        DynamicJsonDocument json(1024);
        auto error = deserializeJson(json, buf.get());
        if (!error) {
          strcpy(firebase_host, json["firebase_host"]);
          strcpy(firebase_auth, json["firebase_auth"]);
          strcpy(firebase_user, json["firebase_user"]);
          strcpy(firebase_pass, json["firebase_pass"]);
        }
      }
    }
  } else {
    Serial.println("Failed to mount FS");
  }
}

void saveConfig() {
  DynamicJsonDocument json(1024);
  json["firebase_host"] = firebase_host;
  json["firebase_auth"] = firebase_auth;
  json["firebase_user"] = firebase_user;
  json["firebase_pass"] = firebase_pass;

  File configFile = SPIFFS.open(config_file, "w");
  if (!configFile) {
    Serial.println("Failed to open config file for writing");
    return;
  }
  serializeJson(json, configFile);
  configFile.close();
  Serial.println("Config saved");
}

// 4. LOGIC TƯỚI CÂY & CONTROL
int convertToPercentage(int rawValue) {
  int percentage = map(rawValue, WATER_MIN_ADC, AIR_MAX_ADC, 100, 0);
  if (percentage > 100) return 100;
  if (percentage < 0) return 0;
  return percentage;
}

void controlPump(bool state) {
  if (state) {
    digitalWrite(RELAY_PIN, PUMP_ON);
    pumpStatus = 1;
  } else {
    digitalWrite(RELAY_PIN, PUMP_OFF);
    pumpStatus = 0;
  }
}

void wateringLogic() {
  // Logic 1: MANUAL MODE (0)
  if (systemMode == 0) return;

  // Logic 2: AUTO SENSOR MODE (1)
  if (systemMode == 1) {
      if (soilMoisturePercentage < thresholdMin) {
        if (pumpStatus == 0) {
          controlPump(true);
          pumpChanged = true;
        }
      } else if (soilMoisturePercentage > thresholdMax) {
        if (pumpStatus == 1) {
          controlPump(false);
          pumpChanged = true;
        }
      }
      return;
  }

  // Logic 3: AUTO DRIP MODE (2)
  if (systemMode == 2) {
      // SAFETY CHECK: Anti-flood (> Max Threshold)
      // Sử dụng thresholdMax làm ngưỡng an toàn thay vì cố định 90%
      if (soilMoisturePercentage > thresholdMax) {
          if (pumpStatus == 1) {
              controlPump(false);
              pumpChanged = true;
          }
          return;
      }




      unsigned long currentMillis = millis();
      unsigned long interval = isDripOn ? (dripOnTime * 1000) : (dripOffTime * 1000);

      if (currentMillis - lastDripMillis >= interval) {
          lastDripMillis = currentMillis;
          isDripOn = !isDripOn; // Toggle
          controlPump(isDripOn);
          pumpChanged = true;
          Serial.printf("Drip: %s\n", isDripOn ? "ON" : "OFF");
      }
  }
}

void updateSoilMoistureToFirebase() {
  if (Firebase.ready() && WiFi.status() == WL_CONNECTED) {
    Firebase.RTDB.setIntAsync(&fbdo, "/system/soilMoisture", soilMoisturePercentage);
    if (pumpChanged) {
        Firebase.RTDB.setIntAsync(&fbdo, "/system/pumpStatus", pumpStatus);
        pumpChanged = false;
    }
  }
}

void streamCallback(FirebaseStream data) {
  String path = data.dataPath();
  Serial.printf("Stream: %s -> %s\n", path.c_str(), data.payload().c_str());

  // 1. Pump Status (Only in Manual Mode)
  if (path == "/pumpStatus") {
    if (systemMode == 0) {
        int status = data.intData();
        controlPump(status == 1);
        pumpChanged = false; // Prevent logic overwrite
    }
  }
  // 2. System Mode
  else if (path == "/mode" || path == "/autoMode") {
    int oldMode = systemMode;
    // Map bool autoMode (false=0, true=1) or int mode
    if (data.dataTypeEnum() == firebase_rtdb_data_type_boolean) {
         systemMode = data.boolData() ? 1 : 0;
    } else {
         systemMode = data.intData();
    }
    
    // Safety switch off if mode changed
    if (oldMode != systemMode) {
        controlPump(false);
        pumpChanged = true;
        isDripOn = false;
        lastDripMillis = millis();
    }
    shouldRunLogicInstantly = true;
  }
  // 3. Thresholds
  else if (path == "/threshold/min") thresholdMin = data.intData();
  else if (path == "/threshold/max") thresholdMax = data.intData();
  // 4. Drip Params
  else if (path == "/drip/on")  dripOnTime = data.intData();
  else if (path == "/drip/off") dripOffTime = data.intData();
}

void streamTimeoutCallback(bool timeout) {
  if (timeout) Serial.println("Stream timeout, resuming...");
}

// 5. SETUP
void setup() {
  Serial.begin(115200);
  pinMode(RELAY_PIN, OUTPUT);
  pinMode(LED_PIN, OUTPUT);
  pinMode(TRIGGER_PIN, INPUT_PULLUP);
  
  digitalWrite(RELAY_PIN, PUMP_OFF);
  digitalWrite(LED_PIN, LOW);

  // 1. Load config
  loadConfig();

  // 2. Setup WiFiManager
  WiFiManager wm;
  wm.setSaveConfigCallback(saveConfigCallback);
  
  WiFiManagerParameter custom_fb_host("host", "Firebase RTDB URL", firebase_host, 100);
  WiFiManagerParameter custom_fb_key("key", "Firebase API Key", firebase_auth, 100);
  WiFiManagerParameter custom_fb_user("user", "Admin Email", firebase_user, 100);
  WiFiManagerParameter custom_fb_pass("pass", "Admin Password", firebase_pass, 100);

  wm.addParameter(&custom_fb_host);
  wm.addParameter(&custom_fb_key);
  wm.addParameter(&custom_fb_user);
  wm.addParameter(&custom_fb_pass);

  if (digitalRead(TRIGGER_PIN) == LOW) {
    Serial.println("Resetting Config...");
    wm.resetSettings();
    SPIFFS.format();
    delay(2000);
    ESP.restart();
  }

  bool forceConfig = (strlen(firebase_host) < 5 || strlen(firebase_auth) < 5);
  digitalWrite(LED_PIN, HIGH);
  
  if (forceConfig) {
     if (!wm.startConfigPortal("SmartGarden-Setup")) {
        ESP.restart();
     }
  } else {
     if (!wm.autoConnect("SmartGarden-Setup")) {
        ESP.restart();
     }
  }

  digitalWrite(LED_PIN, LOW); // Connected
  Serial.println("WiFi Connected!");

  strcpy(firebase_host, custom_fb_host.getValue());
  strcpy(firebase_auth, custom_fb_key.getValue());
  strcpy(firebase_user, custom_fb_user.getValue());
  strcpy(firebase_pass, custom_fb_pass.getValue());

  if (shouldSaveConfig) saveConfig();
  
  // 3. Setup Firebase
  fbConfig.host = firebase_host;
  fbConfig.api_key = firebase_auth;
  fbAuth.user.email = firebase_user;
  fbAuth.user.password = firebase_pass;

  fbdo.setBSSLBufferSize(1024, 1024);
  streamData.setBSSLBufferSize(1024, 1024);
  
  Firebase.begin(&fbConfig, &fbAuth);
  Firebase.reconnectWiFi(true);
  
  int retry = 0;
  while (!Firebase.ready() && retry < 20) {
    delay(500);
    retry++;
  }

  if (Firebase.ready()) {
    if (!Firebase.RTDB.beginStream(&streamData, "/system")) {
       Serial.println(streamData.errorReason());
    }
    Firebase.RTDB.setStreamCallback(&streamData, streamCallback, streamTimeoutCallback);
    
    // Sync initial state
    if (Firebase.RTDB.getBool(&fbdo, "/system/autoMode")) {
       systemMode = fbdo.to<bool>() ? 1 : 0;
    }
    if (Firebase.RTDB.getInt(&fbdo, "/system/mode")) {
       systemMode = fbdo.to<int>();
    }
    if (Firebase.RTDB.getInt(&fbdo, "/system/threshold/min")) thresholdMin = fbdo.to<int>();
    if (Firebase.RTDB.getInt(&fbdo, "/system/threshold/max")) thresholdMax = fbdo.to<int>();
    if (Firebase.RTDB.getInt(&fbdo, "/system/drip/on")) dripOnTime = fbdo.to<int>();
    if (Firebase.RTDB.getInt(&fbdo, "/system/drip/off")) dripOffTime = fbdo.to<int>();
  }
}

// 6. LOOP
void loop() {
  // Logic nút Reset cứng (nếu muốn reset lúc đang chạy)
  if (digitalRead(TRIGGER_PIN) == LOW) {
    delay(3000); // Giữ 3 giây
    if (digitalRead(TRIGGER_PIN) == LOW) {
       WiFiManager wm;
       wm.resetSettings();
       SPIFFS.format();
       ESP.restart();
    }
  }

  if (Firebase.ready() && WiFi.status() == WL_CONNECTED) {
    unsigned long currentMillis = millis();
    
    // LOGIC 1: Cập nhật điều khiển & Realtime (mỗi 1 giây)
    if (currentMillis - lastUpdateMillis >= updateInterval || shouldRunLogicInstantly) {
       if (!shouldRunLogicInstantly) {
          lastUpdateMillis = currentMillis;
          int rawValue = analogRead(SOIL_MOISTURE_PIN);
          soilMoisturePercentage = convertToPercentage(rawValue);
       }
       shouldRunLogicInstantly = false;
       
       wateringLogic();
       updateSoilMoistureToFirebase();
    }

    // LOGIC 2: Ghi lịch sử (Mỗi 60 giây) -> Để vẽ biểu đồ lâu dài
    static unsigned long lastHistoryMillis = 0;
    const unsigned long historyInterval = 60000; // 60s (Production)
    
    if (currentMillis - lastHistoryMillis >= historyInterval) {
        lastHistoryMillis = currentMillis;
        
        // Tạo JSON object để push
        FirebaseJson json;
        json.set("val", soilMoisturePercentage);
        // Lưu timestamp của Server (Firebase)
        json.set("ts/.sv", "timestamp"); 

        Serial.print("Pushing history... ");
        if (Firebase.RTDB.pushJSON(&fbdo, "/history", &json)) {
            Serial.println("OK");
        } else {
            Serial.println(fbdo.errorReason());
        }
    }
  } else {
    // Xử lý mất kết nối
    if (WiFi.status() != WL_CONNECTED) {
        Serial.println("Mất kết nối WiFi! Đang thử kết nối lại...");
        delay(5000);
    }
  }
}