# Supre WMS — Backend API (PHP 8.2+)

API RESTful en PHP puro con PDO y autenticación JWT.

## Prerequisitos

- PHP 8.2 o superior (con extensiones `pdo_mysql`, `mbstring`, `json`)
- MySQL 8.0 / MariaDB 10.6+
- [Composer](https://getcomposer.org/download/)
- Apache con `mod_rewrite` habilitado (o nginx configurado)

## Instalación

### 1. Instalar dependencias PHP
```bash
cd backend
composer install
```

### 2. Configurar variables de entorno
El archivo `.env` ya está creado con valores por defecto. Edítalo:
```env
DB_HOST=127.0.0.1
DB_DATABASE=supre_wms
DB_USERNAME=tu_usuario
DB_PASSWORD=tu_password

JWT_SECRET=cambia_esto_por_una_clave_larga_y_aleatoria

# Origen del frontend React (sin barra final)
CORS_ORIGIN=http://localhost:5173
```

### 3. Crear la base de datos
Ejecuta el script SQL en tu gestor (phpMyAdmin, MySQL Workbench, CLI):
```bash
mysql -u root -p < database/schema.sql
```

### 4. Configurar el servidor web

#### Apache (modo local con XAMPP/WAMP)
Apunta el `DocumentRoot` a la carpeta `backend/public/`.
El `.htaccess` ya está configurado para redirigir todo a `index.php`.

#### PHP Built-in Server (desarrollo rápido)
```bash
cd backend/public
php -S localhost:8000
```
La API quedará disponible en `http://localhost:8000/api/...`

## Endpoints disponibles

### Auth (Pública)
| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/api/auth/login` | Login → retorna JWT |

### Recursos (requieren `Authorization: Bearer <token>`)
| Recurso | Rutas |
|---------|-------|
| Users | GET/POST `/api/users`, PUT/DELETE `/api/users/{id}` |
| Categories | GET/POST `/api/categories`, PUT/DELETE `/api/categories/{id}` |
| Products | GET/POST `/api/products`, GET/PUT/DELETE `/api/products/{id}` |
| Stores | GET/POST `/api/stores`, PUT/DELETE `/api/stores/{id}` |
| Locations | GET/POST `/api/locations?storeId=X`, DELETE `/api/locations/{id}` |
| Stock | GET `/api/stock`, POST `/api/stock` (upsert) |
| PickingLots | GET/POST `/api/picking-lots`, GET/PUT/DELETE `/api/picking-lots/{id}`, PATCH `/api/picking-lots/{id}/conform` |
| Disincorporations | GET/POST `/api/disincorporations`, GET `/api/disincorporations/{id}`, PATCH `.../approve`, PATCH `.../reject` |
| Movements | GET `/api/movements` |

## Credenciales iniciales
- **Usuario:** `admin`  
- **Contraseña:** `password`  
> ⚠️ Cámbiala inmediatamente en producción ejecutando UPDATE en la tabla `users`.

## Estructura de archivos
```
backend/
├── database/schema.sql       ← Script inicial de BD
├── public/
│   ├── .htaccess              ← Reescritura Apache
│   └── index.php              ← Entry point + CORS + Router
└── src/
    ├── Config/Database.php    ← Singleton PDO
    ├── Helpers/Response.php   ← Helper JSON
    ├── Exceptions/            ← Excepciones del dominio
    ├── Middleware/
    │   └── AuthMiddleware.php ← Validación JWT
    ├── Models/                ← Acceso a datos con PDO
    └── Controllers/           ← Lógica HTTP
```
