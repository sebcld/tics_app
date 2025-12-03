# Guía: Mock Server con Android

Esta guía explica cómo usar el mock-server para enviar notificaciones a la aplicación Android.

## Problema Resuelto

- ✅ Las notificaciones del mock-server ahora llegan correctamente a la aplicación Android
- ✅ La aplicación puede recibir datos tanto del mock-server como del ESP32
- ✅ Mejor manejo de errores y reconexión automática
- ✅ Logging mejorado para debugging

## Configuración

### 1. Iniciar el Mock Server

```bash
npm run mock-server
```

El servidor mostrará información importante:
```
========================================
[mock-server] Backsafe Mock Server
========================================
Web UI: http://localhost:4000
Web UI (network): http://192.168.1.100:4000
WebSocket (local): ws://localhost:4000
WebSocket (Android): ws://192.168.1.100:4000
========================================

Para conectar desde Android:
1. Asegúrate de que tu dispositivo Android esté en la misma red WiFi
2. Usa esta URL en la app: ws://192.168.1.100:4000
3. O configura EXPO_PUBLIC_MOCK_WS_URL=ws://192.168.1.100:4000
```

**Importante**: Anota la IP que aparece en "WebSocket (Android)" - la necesitarás para configurar la app.

### 2. Configurar la Aplicación Android

Tienes dos opciones:

#### Opción A: Usar Variable de Entorno (Recomendado)

Crea un archivo `.env` en la raíz del proyecto (o modifica el existente):

```env
EXPO_PUBLIC_USE_MOCK_WS=true
EXPO_PUBLIC_MOCK_WS_URL=ws://192.168.1.100:4000
```

**Reemplaza `192.168.1.100` con la IP que muestra el servidor.**

Luego reinicia el servidor de desarrollo:
```bash
npm run android:dev
```

#### Opción B: Modificar el Código Temporalmente

Si prefieres no usar variables de entorno, puedes modificar temporalmente `src/context/BacksafeContext.tsx`:

```typescript
const mockUrl = 'ws://192.168.1.100:4000'; // Usa la IP de tu máquina
const useMock = true; // Forzar modo mock
```

### 3. Verificar Conexión

1. Abre la aplicación Android
2. Presiona el botón de conexión
3. Deberías ver: "Conectado a mock (ws://192.168.1.100:4000)"
4. Si hay error, verifica:
   - Que el dispositivo Android esté en la misma red WiFi
   - Que uses la IP correcta (no `localhost`)
   - Que el firewall no bloquee el puerto 4000

## Uso del Mock Server

### Interfaz Web

1. Abre `http://localhost:4000` en tu navegador
2. Verás una interfaz con botones para diferentes escenarios
3. Cada botón envía un payload de prueba a la aplicación Android

### Escenarios Disponibles

- **Silla vacía (ok)**: Sin alertas, silla vacía
- **Centrado (ok)**: Postura correcta
- **Inclinado hacia atrás**: Mala postura
- **Inclinado hacia adelante**: Mala postura
- **Inclinado derecha/izquierda**: Mala postura
- **Sentado en el borde**: Mala postura
- **Postura ligera variación**: Postura aceptable

### Enviar Notificaciones

1. Asegúrate de que la aplicación Android esté conectada
2. Haz clic en cualquier botón de escenario
3. La aplicación Android debería recibir la notificación inmediatamente
4. Verás los datos actualizarse en la app (sensores, postura, alertas)

## Alternar entre Mock Server y ESP32

La aplicación detecta automáticamente qué modo usar:

- **Modo Mock**: Si `EXPO_PUBLIC_USE_MOCK_WS=true` o si `EXPO_PUBLIC_MOCK_WS_URL` comienza con `ws://`
- **Modo ESP32**: Si no se cumplen las condiciones anteriores

Para cambiar de modo:
1. Modifica las variables de entorno
2. Reinicia la aplicación

## Solución de Problemas

### Las notificaciones no llegan a Android

1. **Verifica la IP**: Asegúrate de usar la IP de tu máquina, no `localhost`
   - En Windows: `ipconfig` (busca IPv4)
   - En Mac/Linux: `ifconfig` o `ip addr`

2. **Verifica la red**: Ambos dispositivos deben estar en la misma red WiFi

3. **Verifica el firewall**: El puerto 4000 debe estar abierto
   - Windows: Agregar excepción en Firewall de Windows
   - Mac/Linux: Verificar reglas de iptables/ufw

4. **Verifica los logs**: Revisa los logs de la aplicación Android para ver errores de conexión

5. **Reinicia el servidor**: A veces ayuda reiniciar el mock-server

### Error: "Connection timeout"

- Verifica que el servidor esté corriendo
- Verifica que uses la IP correcta
- Verifica que el puerto 4000 esté accesible

### Error: "WebSocket connection error"

- Verifica que ambos dispositivos estén en la misma red
- Verifica que el firewall no bloquee el puerto
- Intenta usar la IP directamente en lugar de localhost

## Mejoras Implementadas

1. **Manejo de errores mejorado**: Mensajes de error más descriptivos
2. **Reconexión automática**: Intenta reconectar automáticamente si se pierde la conexión
3. **Logging detallado**: Más información para debugging
4. **Soporte para comandos**: Los comandos (CALIBRATE, START, STOP) funcionan en modo mock
5. **Información de conexión**: El servidor muestra claramente la IP para Android

## Notas Técnicas

- El WebSocket usa el protocolo nativo de React Native
- El servidor escucha en `0.0.0.0` para aceptar conexiones de la red local
- La compresión WebSocket está deshabilitada para mejor compatibilidad
- El servidor muestra el número de clientes conectados

