# SUPRE WMS - Sistema de Gestión de Almacenes Pro

Sistema integral de gestión de inventarios y logística diseñado para optimizar las operaciones de almacén con una arquitectura moderna y escalable.

## 🚀 Características Principales

*   **📦 Gestión de Inventario:** Control total de entradas, salidas y existencias en tiempo real.
*   **🛒 Módulo de Categorías y Productos:** Clasificación detallada y gestión de catálogo.
*   **📍 Control de Ubicaciones:** Organización logística por cuartos, estantes y cubículos.
*   **📑 Recepción y Picking:** Gestión de lotes de entrada con generación de etiquetas por bulto.
*   **📏 Smart Clear UX:** Interfaz optimizada para entrada de datos numérica rápida.
*   **🔳 Generación de QRs:** Descarga individual de códigos QR por producto para trazabilidad.
*   **🔐 Autenticación JWT:** Seguridad robusta para el acceso de usuarios.

## 🛠️ Tecnologías Utilizadas

### Frontend
*   **React + Vite:** Para una interfaz de usuario rápida y reactiva.
*   **Tailwind CSS:** Diseño moderno y responsive.
*   **Lucide React:** Set de iconos premium.
*   **Typescript:** Tipado estricto para mayor robustez.

### Backend
*   **Slim Framework (PHP):** Micro-framework ágil para la API REST.
*   **PDO:** Interactuación segura con la base de datos.
*   **Composer:** Gestión de dependencias PHP.

## 📦 Instalación y Configuración

### Requisitos Previos
*   Node.js (v18+)
*   PHP (v8.2+)
*   Composer
*   Servidor MySQL/MariaDB

### Pasos de Instalación

1.  **Clonar el repositorio:**
    ```bash
    git clone https://github.com/Jenderz/wms-supre.git
    cd wms-supre
    ```

2.  **Configurar el Frontend:**
    ```bash
    npm install
    # Crear archivo .env basado en .env.example y configurar VITE_API_URL
    npm run dev
    ```

3.  **Configurar el Backend:**
    ```bash
    cd backend
    composer install
    # Configurar las variables de entorno para DB_HOST, DB_NAME, DB_USER, DB_PASS
    ```

## 📄 Licencia

Este proyecto es de uso privado para la gestión logística de **SUPRE**.

---
*Desarrollado con ❤️ por el equipo de Ingeniería.*
