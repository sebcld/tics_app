# Backsafe TICS - Guia rapida (Bluetooth Classic + Mock Web)

La app recibe datos de sensores del ESP32 por **Bluetooth Classic (SPP)** y puede, en paralelo, escuchar un **WebSocket mock** para alertas/escenarios. El ESP32 se empareja como `Backsafe_ESP32` (PIN 1234).

## Requisitos
- Node.js 18+
- EAS CLI (`npm install -g eas-cli`)
- Android Studio (emulador/ADB)
- Cuenta Expo gratuita

## Variables de entorno
Clona `.env.example` a `.env` y ajusta:
- `EXPO_PUBLIC_USE_MOCK_WS=true` y `EXPO_PUBLIC_MOCK_WS_URL=ws://IP:4000` para habilitar alertas del mock web.
- `EXPO_PUBLIC_PREFER_MOCK_FIRST=true` (opcional) para conectar primero al mock; si es `false` se prioriza ESP32.
- No necesitas UUIDs BLE: la app usa Bluetooth Classic y detecta el dispositivo emparejado.

## Flujo recomendado: ESP32 + Mock
1. Empareja el ESP32 en Android: Ajustes → Bluetooth → `Backsafe_ESP32` (PIN 1234).
2. (Opcional) Mock web: `npm run mock-server` y usa la IP LAN en `.env`.
3. Arranca el bundler: `npm start` o `npm run android:dev` para abrir en emulador.
4. En la app, toca **Conectar Backsafe**. Veras “Conectado: ESP32 + mock” si ambos canales estan activos.

## Ejecutar la app
### Dev Client (EAS Build)
1. `eas build -p android --profile development`
2. Instala el APK (emulador o dispositivo).
3. `npx expo start --dev-client` y abre la app (tecla `a` para emulador).

### Desarrollo local (sin EAS)
1. `npx expo prebuild --platform android` (genera `/android` nativo).
2. Abre `android/` en Android Studio, selecciona emulador/dispositivo y ejecuta.
3. En paralelo: `npx expo start --dev-client`.

## Comandos utiles
- `npm start` — bundler.
- `npm run android` — abre en emulador/dispositivo conectado.
- `npm run mock-server` — servidor WebSocket de pruebas.
- `npm run android:dev` — bundler + dev client para Android.
