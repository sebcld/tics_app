# Comparativa: BLE vs Bluetooth Classic (SPP)

## Limitaciones de BLE (La razón del cambio)

### MTU (Maximum Transmission Unit)
- **BLE**: 20 bytes por paquete (default ATT)
  - Después de headers: ~17 bytes útiles
  - Necesitaba fragmentación manual
  - Complejidad al reconstruir mensajes

- **Bluetooth Classic (SPP)**: Hasta 4096 bytes por paquete
  - ~4KB útiles por mensaje
  - Sin necesidad de fragmentación
  - Simplicidad en la comunicación

### Ejemplo práctico con nuestros datos

**Datos del sensor** (14 valores FSR + metadatos):
```json
{
  "ts": 1234567890,
  "alert": false,
  "status": "ok",
  "angle": 0.0,
  "zoneAlert": false,
  "zoneStatus": "neutral",
  "occupied": true,
  "values": [80, 85, 90, 85, 80, 75, 70, 80, 85, 90, 50, 50, 50, 50]
}
```

**Tamaño**: ~287 bytes

### Con BLE (❌ Problemático)
```
Paquete 1 (20 bytes):
{"ts": 1234567890, "a

Paquete 2 (20 bytes):
lert": false, "status

Paquete 3 (20 bytes):
": "ok", "angle": 0.0

... (total 15 paquetes)

Problema: 
- Puede llegar desordenado
- Latencia acumulada
- Requiere lógica de reconstrucción
- Mayor tasa de error
```

### Con Bluetooth Classic (✅ Óptimo)
```
Un solo paquete (287 bytes):
{...mensaje completo...}

Ventajas:
- Llega atomicamente
- Sin fragmentación
- Procesamiento inmediato
- Menor tasa de error
```

## Comparativa de características

| Característica | BLE | Bluetooth Classic |
|---|---|---|
| **MTU estándar** | 20 bytes | 4KB |
| **Complejidad** | Alta | Baja |
| **Consumo de energía** | ~40 µA | ~800 µA |
| **Rango** | 100-200m | 10-100m |
| **Emparejamiento** | Dinámico | Requiere emparejamiento |
| **Latencia** | Variable | Consistente |
| **Velocidad de datos** | 1 Mbps | 2.1 Mbps |
| **Fragmentación** | Automática | Transparente |
| **Costo CPU** | Bajo | Medio |

## Arquitectura de comunicación

### BLE (GATT - Generic Attribute Profile)
```
┌─────────────────────────────────┐
│    Aplicación Android (app)     │
└──────────────────┬──────────────┘
                   │
         ┌─────────▼──────────┐
         │  BLE Manager       │
         │  (react-native-ble-plx)
         └────────┬────────────┘
                  │
         ┌────────▼──────────┐
         │  GAP/GATT         │
         │  20 MTU           │
         └────────┬──────────┘
                  │
         ┌────────▼──────────┐
         │  Bluetooth Stack   │
         │  (Link Manager)    │
         └────────┬──────────┘
                  │
         ┌────────▼──────────┐
         │  ESP32 (Peripheral)
         │  Services/Chars    │
         └─────────────────────┘
```

### Bluetooth Classic (SPP - Serial Port Profile)
```
┌─────────────────────────────────┐
│    Aplicación Android (app)     │
└──────────────────┬──────────────┘
                   │
         ┌─────────▼──────────────┐
         │ Serial Port Profile    │
         │ (react-native-bluetooth-serial)
         └────────┬────────────────┘
                  │
         ┌────────▼──────────────┐
         │  RFCOMM Layer         │
         │  4KB MTU              │
         └────────┬────────────────┘
                  │
         ┌────────▼──────────────┐
         │  Bluetooth Stack       │
         │  (Link Manager)        │
         └────────┬────────────────┘
                  │
         ┌────────▼──────────────┐
         │  ESP32 (Master)        │
         │  Serial Stream         │
         └─────────────────────────┘
```

## Protocolo de transporte

### BLE (Orientado a eventos)
```
App          ESP32
 │            │
 ├──Write──→  │  (Command characteristic)
 │            │
 │  (Processing delay)
 │            │
 │ ←Notify──┤  (Notify characteristic)
 │            │
```

### Bluetooth Classic (Orientado a streams)
```
App          ESP32
 │            │
 ├─Write────→ │  (Stream de datos)
 │            │
 │ ←Read─────┤  (Stream de datos)
 │            │
```

## Decisión técnica

### ¿Por qué Bluetooth Classic para este proyecto?

**Requisitos del proyecto:**
1. ✅ Enviar múltiples valores de sensores (~14 valores)
2. ✅ Metadatos adicionales (timestamp, status, etc)
3. ✅ Actualizaciones frecuentes (~3 segundos)
4. ✅ Comunicación bidireccional (comandos + notificaciones)

**Análisis:**

| Requisito | BLE | Bluetooth Classic |
|---|---|---|
| Múltiples sensores | ❌ Fragmentación | ✅ Paquete único |
| Metadatos | ❌ Requiere características adicionales | ✅ Serial stream |
| Actualizaciones | ⚠️ Delay acumulativo | ✅ Latencia baja |
| Bidireccional | ✅ Sí | ✅ Sí |

**Conclusión:** Bluetooth Classic es más adecuado para este caso de uso.

## Consideraciones futuras

### Si necesitáramos BLE nuevamente:

1. **Aumentar MTU (Extended ATT)**
   - Android 10+: Soporta até 517 bytes
   - Requiere `gatt.setPreferredPhy()`

2. **Implementar fragmentación**
   - Dividir payload en múltiples características
   - Agregar secuenciación
   - Complejidad adicional

3. **Usar GATT Streaming**
   - Múltiples características pequeñas
   - Lógica de reconstrucción en cliente

## Rendimiento esperado

### Latencia (tiempo desde lectura hasta notificación)

**BLE (20 bytes):**
- Con fragmentación: ~30-50ms (estimado)
- Tasa de error: 2-5%

**Bluetooth Classic (4KB):**
- Sin fragmentación: ~5-10ms
- Tasa de error: <1%

### Consumo de batería

**ESP32:**
- BLE: ~100mA en comunicación
- Bluetooth Classic: ~150-200mA en comunicación

**Teléfono (Android):**
- BLE: ~30-50mA
- Bluetooth Classic: ~40-60mA

## Migración reversa

Si fuera necesario volver a BLE en el futuro:

1. Cambiar ESP32 back a `NimBLEDevice.h`
2. Implementar fragmentación en cliente
3. Cambiar React Native a `react-native-ble-plx`
4. Actualizar contexto y servicios
5. Agregar secuenciación de paquetes

## Referencias técnicas

- **Bluetooth SIG**: https://www.bluetooth.com/
- **ESP32 Bluetooth**: https://docs.espressif.com/projects/esp-idf/en/latest/esp32/api-guides/
- **GATT Spec**: https://www.bluetooth.com/specifications/gatt/
- **RFCOMM (SPP)**: https://www.bluetooth.com/specifications/classic/
- **Arduino-ESP32**: https://github.com/espressif/arduino-esp32

## Conclusión

La migración de BLE a Bluetooth Classic resuelve las limitaciones de MTU y proporciona:
- ✅ Mayor capacidad de datos
- ✅ Comunicación más simple y directa
- ✅ Menor latencia
- ✅ Mayor confiabilidad para este caso de uso
- ⚠️ Requiere emparejamiento previo (trade-off aceptable)
