# Publicar Word Hunters

## Opcion recomendada: Render

1. Sube esta carpeta a un repositorio de GitHub.
2. En Render, crea un nuevo `Web Service`.
3. Conecta el repositorio.
4. Usa estos valores:
   - Build command: `npm install`
   - Start command: `npm start`
   - Health check path: `/health`
5. Cuando Render termine, te dara una URL fija como:
   `https://word-hunters.onrender.com`

Esa URL sera la que debes compartir con los jugadores.

## Importante

El enlace de `localtunnel` o `ngrok` es temporal. Para no reiniciar enlaces, usa la URL del hosting.

El ranking historico se guarda en un archivo local del servidor. En hosting gratis puede reiniciarse si la plataforma borra el disco temporal. Para ranking permanente en produccion conviene conectar una base de datos.
