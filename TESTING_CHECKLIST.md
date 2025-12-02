# Testing Checklist - Bluetooth Classic

## Pre-requisitos
- [ ] ESP32 con firmware compilado y cargado
- [ ] Android 11+ (API 30+) con Bluetooth 4.0+
- [ ] Node.js v18+
- [ ] APK instalada en dispositivo físico o emulador especial

## Fase 1: Setup Inicial

### ESP32
- [ ] Serial Monitor muestra: "✓ Bluetooth Classic initialized"
- [ ] Serial Monitor muestra: "✓ Device name: Backsafe_ESP32"
- [ ] Serial Monitor muestra: "✓ Waiting for connection..."
- [ ] No hay errores de compilación

### Android Bluetooth
- [ ] Bluetooth está encendido en el teléfono
- [ ] "Backsafe_ESP32" aparece en lista de dispositivos disponibles
- [ ] Dispositivo puede emparejarse sin errores
- [ ] PIN correcta: `1234`
- [ ] Dispositivo aparece en "Dispositivos emparejados"

### App Instalación
- [ ] App se instala sin errores
- [ ] App inicia sin crashes
- [ ] App solicita permisos de Bluetooth
- [ ] Pantalla inicial visible

## Fase 2: Conexión

### Conexión Inicial
- [ ] Presionar "Conectar"
- [ ] Status cambia a "Buscando Backsafe por Bluetooth Classic..."
- [ ] Within 5 segundos, status muestra "Conectado a Backsafe_ESP32"
- [ ] Serial Monitor del ESP32 muestra "*** CLIENT CONNECTED ***"
- [ ] No hay crashes

### Conectividad Persistente
- [ ] App se mantiene conectada por 1 minuto sin desconectar
- [ ] Puede desconectar y reconectar múltiples veces
- [ ] Mensaje de error apropiado si no encuentra dispositivo
- [ ] Timeout apropiado (~20 segundos) si no conecta

## Fase 3: Notificaciones

### Recepción de Datos
- [ ] App recibe notificaciones cada 3 segundos
- [ ] Datos mostrados: timestamp, status, alert, angle, values
- [ ] JSON válido en cada notificación
- [ ] Datos cambian correctamente (status: ok → alert)

### Parsing de Datos
- [ ] Status "ok" muestra correctamente
- [ ] Status "alert" muestra correctamente
- [ ] Angle se actualiza correctamente
- [ ] Alert flag se refleja en UI (color/icono)

### Formatos de Datos
- [ ] Payload con 14 valores FSR válidos
- [ ] Timestamp en milisegundos
- [ ] Valores en rango: 0-255
- [ ] Metadatos completos (occupied, zoneStatus, etc)

## Fase 4: Comandos

### Comando START
- [ ] Enviar "START" desde app
- [ ] Serial Monitor muestra "*** CLIENT CONNECTED ***"
- [ ] Notificaciones comienzan a llegar
- [ ] App recibe confirmación: {"cmdAck":"START","ok":true}

### Comando STOP
- [ ] Enviar "STOP" desde app
- [ ] Notificaciones dejan de llegar
- [ ] App recibe confirmación: {"cmdAck":"STOP","ok":true}
- [ ] Serial Monitor muestra: "Monitoring stopped"

### Comando CALIBRATE
- [ ] Enviar "CALIBRATE"
- [ ] App recibe: {"cmdAck":"CALIBRATE","ok":true}
- [ ] Serial Monitor confirma
- [ ] No hay errores

### Comando CALIBRATE_POSTURE
- [ ] Enviar "CALIBRATE_POSTURE"
- [ ] App recibe: {"cmdAck":"CALIBRATE_POSTURE","ok":true}
- [ ] Serial Monitor confirma
- [ ] No hay errores

## Fase 5: Estabilidad

### Reconexión
- [ ] Apagar Bluetooth del teléfono → app maneja error
- [ ] Encender Bluetooth del teléfono → app se reconecta
- [ ] Presionar botón RST del ESP32 → app se reconecta
- [ ] Desconectar USB del ESP32 → app maneja error

### Carga de Datos
- [ ] App recibe datos por 5 minutos sin freeze
- [ ] Memoria no se incrementa significativamente
- [ ] No hay lag en UI
- [ ] Logs no se vuelven excesivos

### Errores Esperados
- [ ] Sin dispositivo emparejado → error descriptivo
- [ ] Bluetooth deshabilitado → error descriptivo
- [ ] Permisos denegados → error descriptivo
- [ ] Desconexión inesperada → reconecta automáticamente

## Fase 6: Performance

### Latencia
- [ ] Tiempo desde lectura ESP32 a UI actualizada: < 1 segundo
- [ ] Comando enviado → confirmación: < 500ms
- [ ] Notificaciones consistentes cada 3 segundos (± 100ms)

### Consumo
- [ ] ESP32 temperatura normal (~45°C)
- [ ] Teléfono temperatura normal (~35°C)
- [ ] Batería drena a velocidad razonable

### Datos
- [ ] Payload size ~ 287 bytes sin truncamiento
- [ ] Sin pérdida de datos observada
- [ ] Formato JSON siempre válido

## Fase 7: Casos Extremos

### Multiples Desconexiones
- [ ] Conectar y desconectar 10 veces
- [ ] App maneja sin crashes
- [ ] Logs limpios (sin spam)

### Datos Corrupto Simulado
- [ ] JSON incompleto manejado
- [ ] Caracteres inválidos ignorados
- [ ] App no crashea

### Sin Datos
- [ ] Conectar pero sin notificaciones por 1 minuto
- [ ] App muestra error o timeout
- [ ] Usuario puede reconectar

## Fase 8: Documentación

- [ ] BLUETOOTH_CLASSIC_MIGRATION.md completa
- [ ] ESP32_SETUP_GUIDE.md completa
- [ ] BLE_VS_BLUETOOTH_CLASSIC.md completa
- [ ] README.md actualizado
- [ ] QUICK_START.md útil

## Resultados Esperados

### Cumplimiento
- ✅ **Fase 1**: Todo debe pasar (Setup)
- ✅ **Fase 2**: Todo debe pasar (Conexión)
- ✅ **Fase 3**: Todo debe pasar (Datos)
- ✅ **Fase 4**: Todo debe pasar (Comandos)
- ✅ **Fase 5**: Todo debe pasar (Estabilidad)
- ✅ **Fase 6**: Performance dentro de rangos
- ✅ **Fase 7**: App maneja gracefully
- ✅ **Fase 8**: Documentación completa

### Métricas
- **Tasa de conexión exitosa**: > 95%
- **Tasa de retención de datos**: 100%
- **Tiempo promedio de latencia**: 100-300ms
- **Uptime sostenido**: > 99% (5+ minutos)

## Notas de Testing

### Ambiente
- Teléfono: Android 12+
- Distancia: < 5 metros
- Interferencias: Mínimas
- Conexión WiFi: No requiere

### Herramientas de Debug
- Serial Monitor (ESP32): 115200 baud
- Expo Console (React Native): Console logs
- Logcat (Android): adb logcat

### Registro de Issues
```
Fecha:
Fase:
Descripción:
Pasos para reproducir:
Resultado esperado:
Resultado actual:
Severidad: (Critical/High/Medium/Low)
```

## Sign-off

- [ ] Tester: ________________
- [ ] Fecha: ________________
- [ ] Resultado: PASS / FAIL
- [ ] Notas: ________________________________________________________

---

**Testing completado**: `____/____/____`  
**Estado**: ✅ LISTO / ⚠️ REVIEW / ❌ NO LISTO
