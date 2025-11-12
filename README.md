# 📦 roble_api_database

Paquete para React Native que facilita la comunicación con la plataforma Roble API.
https://roble.openlab.uninorte.edu.co/

Este paquete provee una capa ligera para autenticación y operaciones CRUD sobre las bases de datos expuestas por Roble, manteniendo una interfaz simple y adecuada para aplicaciones móviles y de escritorio con Flutter.

https://github.com/Arias3/roble_api_database

## 🚀 Instalación

Agrega la dependencia en tu proyecto Flutter:

```bash
npm install react-native-roble-api-database-rn
```

Importa el paquete donde lo necesites:

```
import { createRobleClient, RobleApiException } from 'react-native-roble-api-database-rn';

```

---

## 🧭 Quick start

Ejemplo mínimo de uso (async/await):

```dart
const db = useMemo(
    () =>
      createRobleClient({
        baseURL: 'https://roble-api.openlab.uninorte.edu.co',
        codeUrl: 'robleapidatabase_e13b5d56c6',
        authHeaders: { 'x-app': 'roble-mobile' },
        dataHeaders: { 'x-app': 'roble-mobile' },
      }),
    []
  );

// Registrar usuario
const createUser = async () => {
    try {
      setLoading(true);
      const email = `test_user_${Date.now()}@mail.com`;
      appendLog(`Creando usuario: ${email}`);

      const res = await db.register('Usuario Prueba', email, 'Password123!');
      setLastEmail(email);
      appendLog(`Usuario creado: ${res.email ?? email}`);
    } catch (e: any) {
      appendLog(`Error creando usuario: ${e?.message}`);
    } finally {
      setLoading(false);
    }
  };

// Iniciar sesión
fconst loginUser = async () => {
    if (!lastEmail) {
      appendLog('Primero crea un usuario antes de iniciar sesión.');
      return;
    }

    try {
      setLoading(true);
      appendLog(`Iniciando sesión con ${lastEmail}...`);
      const res = await db.login(lastEmail, 'Password123!');
      setAccessToken(res.accessToken);
      appendLog(`Sesión iniciada. Token: ${res.accessToken.substring(0, 25)}...`);
    } catch (e: any) {
      appendLog(`Error al iniciar sesión: ${e?.message}`);
    } finally {
      setLoading(false);
    }
  };

// Cerrar sesión
const logoutUser = async () => {
    if (!accessToken) {
      appendLog('No hay sesión activa para cerrar.');
      return;
    }

    try {
      setLoading(true);
      appendLog('Cerrando sesión...');
      await db.logout();   // sin argumentos
      setAccessToken(null);
      appendLog('Sesión cerrada correctamente.');
    } catch (e: any) {
      appendLog(`Error cerrando sesión: ${e?.message}`);
    } finally {
      setLoading(false);
    }
  };

// CRUD //
const testCrud = async () => {
    if (!accessToken) {
      appendLog('Debes iniciar sesión antes de probar CRUD.');
      return;
    }

    try {
      setLoading(true);
      appendLog('Creando registro...');
      const created = await db.create('usuarios_test', {
        nombre: 'Juan',
        rol: 'admin',
      });
      appendLog(`Registro creado: ${JSON.stringify(created)}`);

      appendLog('Leyendo registros...');
      const data = await db.read('usuarios_test');
      appendLog(`Se obtuvieron ${data.length} registros.`);

      appendLog('Actualizando registro...');
      const updated = await db.update('usuarios_test', created._id, {
        rol: 'editor',
      });
      appendLog(`Registro actualizado: ${JSON.stringify(updated)}`);

      appendLog('Eliminando registro...');
      const deleted = await db.delete('usuarios_test', created._id);
      appendLog(`Registro eliminado: ${JSON.stringify(deleted)}`);

      appendLog('CRUD completo.');
    } catch (e: any) {
      appendLog(`Error en CRUD: ${e?.message}`);
    } finally {
      setLoading(false);
    }
  };

---
## 🛠️ Contribuciones

Las contribuciones son bienvenidas. Si encuentras un bug o quieres proponer una mejora:


## Resumen

`roble_api_database` es un cliente ligero para Flutter que simplifica las peticiones HTTPS hacia la plataforma Roble. No abstrae la lógica de negocio del backend: su objetivo es facilitar el consumo de endpoints estandarizados (auth + CRUD) con manejo consistente de errores y facilidad para testing.

¡Las contribuciones y mejoras son muy bienvenidas! 🚀

