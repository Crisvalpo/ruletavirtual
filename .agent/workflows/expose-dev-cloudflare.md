---
description: Cómo exponer la aplicación de desarrollo usando Cloudflare Tunnel en ruleta.lukeapp.me
---

# Exponer la aplicación de desarrollo con Cloudflare Tunnel

Este workflow describe cómo exponer el servidor de desarrollo local (`localhost:3000`) a internet usando Cloudflare Tunnel, permitiendo acceder desde cualquier dispositivo (móvil, tablet, etc.) mediante el dominio `ruleta.lukeapp.me`.

## 📋 Prerequisitos

- Cloudflared ya instalado y autenticado
- Túnel existente: `6a1bae3c-a80b-4c25-b442-121c13001b21`
- Archivo de configuración en `C:\Users\lukea\.cloudflared\config.yml`
- DNS configurado en Cloudflare Dashboard

## 🚀 Pasos para exponer la aplicación

### 1. Verificar que el servidor de desarrollo está corriendo

```bash
npm run dev
```

El servidor debe estar corriendo en `http://localhost:3000`

### 2. Iniciar el túnel de Cloudflare

// turbo
```bash
cloudflared tunnel run
```

Este comando:
- Lee la configuración de `C:\Users\lukea\.cloudflared\config.yml`
- Conecta el túnel `6a1bae3c-a80b-4c25-b442-121c13001b21`
- Expone `localhost:3000` a través de `ruleta.lukeapp.me`

### 3. Verificar conexión

Una vez ejecutado el comando, deberías ver mensajes como:
```
INF Starting tunnel tunnelID=6a1bae3c-a80b-4c25-b442-121c13001b21
INF Generated Connector ID: [id]
```

### 4. Acceder desde cualquier dispositivo

Abre en tu navegador o dispositivo móvil:
```
https://ruleta.lukeapp.me
```

## ⚙️ Configuración actual

### Archivo de configuración (`C:\Users\lukea\.cloudflared\config.yml`)

```yaml
tunnel: 6a1bae3c-a80b-4c25-b442-121c13001b21
credentials-file: C:\Users\lukea\.cloudflared\6a1bae3c-a80b-4c25-b442-121c13001b21.json

ingress:
  - hostname: ruleta.lukeapp.me
    service: http://localhost:3000
  - service: http_status:404
```

### DNS configurado en Cloudflare

**Registro CNAME en el dominio `lukeapp.me`:**
- **Type**: CNAME
- **Name**: ruleta
- **Target**: `6a1bae3c-a80b-4c25-b442-121c13001b21.cfargotunnel.com`
- **Proxy status**: ✅ Proxied (naranja)

## 🛑 Detener el túnel

Para detener el túnel, simplemente presiona `Ctrl+C` en la terminal donde ejecutaste `cloudflared tunnel run`.

## 🔧 Solución de problemas

### El túnel no se conecta
- Verifica que tienes conexión a internet
- Confirma que el DNS está configurado correctamente en Cloudflare Dashboard
- Revisa los logs del túnel para errores específicos

### Error "context deadline exceeded"
- Puede ser un problema temporal de conectividad con la API de Cloudflare
- Espera unos minutos y vuelve a intentar
- Verifica tu conexión a internet

### La aplicación no carga en el dominio
- Asegúrate de que `npm run dev` está corriendo
- Verifica que el puerto es `3000` (o actualiza la configuración si cambió)
- Revisa los logs del túnel y del servidor Next.js

## 📝 Notas importantes

- Este túnel es para **desarrollo solamente**, no para producción
- El túnel debe estar corriendo mientras quieras acceder desde dispositivos externos
- Todos los cambios en el código se reflejan en tiempo real (Hot Reload funciona)
- No es necesario reconstruir o reconfigurar el túnel cada vez, solo ejecutar `cloudflared tunnel run`
