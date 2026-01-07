  #include <WiFi.h>
  #include <Firebase_ESP_Client.h>
  #include <WiFiManager.h>
  #include <ArduinoJson.h>
  #include <FS.h>
  #include <SPIFFS.h>
  #include "soc/soc.h"
  #include "soc/rtc_cntl_reg.h"

  #define SOIL_MOISTURE_PIN 32
  #define RELAY_PIN 27
  #define LED_PIN 2
  #define TRIGGER_PIN 0
  #define PUMP_ON HIGH
  #define PUMP_OFF LOW

  char firebase_host[100] = ""; 
  char firebase_auth[100] = "";
  char firebase_user[100] = "";
  char firebase_pass[100] = "";

  FirebaseData fbdo;
  FirebaseConfig fbConfig;
  FirebaseAuth fbAuth;
  FirebaseData streamData;

  unsigned long lastUpdateMillis = 0;
  const long updateInterval = 1000;
  bool shouldRunLogicInstantly = false;
  int soilMoisturePercentage = 0;
  int pumpStatus = 0;

  int systemMode = 1;

  int thresholdMin = 40;
  int thresholdMax = 70;

  int dripOnTime = 5;
  int dripOffTime = 10;
  unsigned long lastDripMillis = 0;
  bool isDripOn = false;
  bool pumpChanged = false;

  const int AIR_MAX_ADC = 3300;
  const int WATER_MIN_ADC = 1200;

  const char* config_file = "/config.json";
  bool shouldSaveConfig = false;

  void saveConfigCallback() {
    Serial.println("Phát hiện cấu hình mới, bật cờ lưu...");
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
      Serial.println("Lỗi: Không thể mount File System");
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
      Serial.println("Lỗi: Không thể mở file để ghi");
      return;
    }
    serializeJson(json, configFile);
    configFile.close();
    Serial.println("Đã lưu cấu hình thành công");
  }

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
    if (systemMode == 0) return;

    if (systemMode == 1) {
        if (soilMoisturePercentage < thresholdMin) {
          if (pumpStatus == 0) {
            controlPump(true);
            pumpChanged = true;
          }
        } 
        else if (soilMoisturePercentage > thresholdMax) {
          if (pumpStatus == 1) {
            controlPump(false);
            pumpChanged = true;
          }
        }
        return;
    }

    if (systemMode == 2) {
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
            isDripOn = !isDripOn;
            controlPump(isDripOn);
            pumpChanged = true;
            Serial.printf("Drip Mode: Chuyển sang %s\n", isDripOn ? "ON" : "OFF");
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
    Serial.printf("Stream nhận: %s -> %s\n", path.c_str(), data.payload().c_str());

    if (path == "/pumpStatus") {
      if (systemMode == 0) {
          int status = data.intData();
          controlPump(status == 1);
          pumpChanged = false;
      }
    }
    else if (path == "/mode" || path == "/autoMode") {
      int oldMode = systemMode;
      if (data.dataTypeEnum() == firebase_rtdb_data_type_boolean) {
          systemMode = data.boolData() ? 1 : 0;
      } else {
          systemMode = data.intData();
      }
      
      if (oldMode != systemMode) {
          controlPump(false);
          pumpChanged = true;
          isDripOn = false;
          lastDripMillis = millis();
      }
      shouldRunLogicInstantly = true;
    }
    else if (path == "/threshold/min") thresholdMin = data.intData();
    else if (path == "/threshold/max") thresholdMax = data.intData();
    else if (path == "/drip/on")  dripOnTime = data.intData();
    else if (path == "/drip/off") dripOffTime = data.intData();
  }

  void streamTimeoutCallback(bool timeout) {
    if (timeout) Serial.println("Stream timeout -> Đang kết nối lại...");
  }

  void setup() {
    WRITE_PERI_REG(RTC_CNTL_BROWN_OUT_REG, 0); // Disable Brownout Detector
    
    Serial.begin(115200);
    delay(1000); // Wait for Serial to stabilize
    Serial.println("\n\n--- SYSTEM REBOOT ---");
    Serial.println("Starting Smart Garden System...");

    pinMode(RELAY_PIN, OUTPUT);
    pinMode(LED_PIN, OUTPUT);
    pinMode(TRIGGER_PIN, INPUT_PULLUP);
    
    pinMode(RELAY_PIN, OUTPUT);
    digitalWrite(RELAY_PIN, PUMP_OFF);
    digitalWrite(LED_PIN, LOW);

    loadConfig();

    WiFiManager wm;
    wm.setSaveConfigCallback(saveConfigCallback);
  
  // Set longer timeout to help with connection reliability (180 seconds)
  wm.setConnectTimeout(180);
    
    WiFiManagerParameter custom_fb_host("host", "Firebase RTDB URL", firebase_host, 100);
    WiFiManagerParameter custom_fb_key("key", "Firebase API Key", firebase_auth, 100, "type=\"password\"");
    WiFiManagerParameter custom_fb_user("user", "Admin Email", firebase_user, 100);
    WiFiManagerParameter custom_fb_pass("pass", "Admin Password", firebase_pass, 100, "type=\"password\"");

    wm.addParameter(&custom_fb_host);
    wm.addParameter(&custom_fb_key);
    wm.addParameter(&custom_fb_user);
    wm.addParameter(&custom_fb_pass);

    if (digitalRead(TRIGGER_PIN) == LOW) {
      Serial.println("Đang Reset toàn bộ cấu hình...");
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

    digitalWrite(LED_PIN, LOW);
    Serial.println("Đã kết nối WiFi thành công!");

    strcpy(firebase_host, custom_fb_host.getValue());
    strcpy(firebase_auth, custom_fb_key.getValue());
    strcpy(firebase_user, custom_fb_user.getValue());
    strcpy(firebase_pass, custom_fb_pass.getValue());

    if (shouldSaveConfig) saveConfig();
    
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

  void loop() {
    if (digitalRead(TRIGGER_PIN) == LOW) {
      delay(3000);
      if (digitalRead(TRIGGER_PIN) == LOW) {
        WiFiManager wm;
        wm.resetSettings();
        SPIFFS.format();
        ESP.restart();
      }
    }

    if (Firebase.ready() && WiFi.status() == WL_CONNECTED) {
      unsigned long currentMillis = millis();
      
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

      static unsigned long lastHistoryMillis = 0;
      const unsigned long historyInterval = 60000;
      
      if (currentMillis - lastHistoryMillis >= historyInterval) {
          lastHistoryMillis = currentMillis;
          
          FirebaseJson json;
          json.set("val", soilMoisturePercentage);
          json.set("ts/.sv", "timestamp"); 

          Serial.print("Đang ghi lịch sử... ");
          if (Firebase.RTDB.pushJSON(&fbdo, "/history", &json)) {
              Serial.println("Ghi lịch sử thành công");
          } else {
              Serial.println(fbdo.errorReason());
          }
      }
    } else {
      if (WiFi.status() != WL_CONNECTED) {
          Serial.println("Mất kết nối WiFi! Đang thử kết nối lại...");
          delay(5000);
      }
    }
  }