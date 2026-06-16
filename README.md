# ⚡ Ironic Pool — Tienda Online con Node.js, Express y Mercado Pago

Aplicación web completa desarrollada con **Node.js**, **Express**, **Socket.IO** y **Mercado Pago**, que permite la venta de productos, gestión de usuarios, carrito de compras, chat en tiempo real y sorteos.

## Características

* 🛍️ Catálogo de productos con búsqueda y filtros por categoría
* 🛒 Carrito de compras persistido en sesión
* 👤 Registro e inicio de sesión de usuarios
* 🔒 Contraseñas protegidas con bcrypt
* 💬 Chat en tiempo real con Socket.IO
* 💳 Integración con Mercado Pago Checkout Pro
* 📧 Formulario de contacto mediante correo electrónico
* 🎉 Sistema de sorteos con asignación automática de números
* 🚚 Cálculo de costos de envío por departamento
* 📦 Gestión de pedidos
* 👑 Panel administrativo (usuarios)
* 📱 Diseño responsive para móviles y escritorio

---

## Tecnologías utilizadas

### Backend

* Node.js
* Express.js
* Express Session
* Socket.IO
* bcryptjs
* dotenv
* Mercado Pago SDK
* Resend

### Frontend

* HTML5
* CSS3
* JavaScript Vanilla

---

## Instalación

### 1. Clonar repositorio

```bash
git clone <repositorio>
cd techstore
```

### 2. Instalar dependencias

```bash
npm install
```

### 3. Crear archivo .env

```env
PORT=3000

SESSION_SECRET=tu_clave_secreta_larga

MP_ACCESS_TOKEN=TU_ACCESS_TOKEN_DE_MERCADOPAGO

EMAIL_USER=tu_correo@gmail.com
EMAIL_PASS=tu_app_password_gmail
```

### 4. Ejecutar servidor

Producción:

```bash
npm start
```

Desarrollo:

```bash
npm run dev
```

Abrir:

```text
http://localhost:3000
```

---

## Estructura del proyecto

```text
techstore/
│
├── server/
│   ├── server.js
│   └── data/
│       └── db.json
│
├── public/
│   ├── index.html
│   ├── styles.css
│   └── images/
│
├── data/
│   └── products/
│       └── products.json
│
├── .env
├── .gitignore
├── package.json
└── README.md
```

---

## Variables de entorno

| Variable        | Descripción                                  |
| --------------- | -------------------------------------------- |
| PORT            | Puerto del servidor                          |
| SESSION_SECRET  | Clave de sesiones Express                    |
| MP_ACCESS_TOKEN | Token de Mercado Pago                        |
| EMAIL_USER      | Correo Gmail utilizado para enviar consultas |
| EMAIL_PASS      | App Password de Gmail                        |

---

## API REST

### Productos

| Método | Ruta              |
| ------ | ----------------- |
| GET    | /api/products     |
| GET    | /api/products/:id |
| POST   | /api/products     |

Permite listar, filtrar y crear productos.

---

### Carrito

| Método | Ruta                 |
| ------ | -------------------- |
| GET    | /api/cart            |
| POST   | /api/cart            |
| PUT    | /api/cart/:productId |
| DELETE | /api/cart/:productId |
| DELETE | /api/cart            |

Carrito asociado a la sesión actual.

---

### Autenticación

| Método | Ruta               |
| ------ | ------------------ |
| POST   | /api/auth/register |
| POST   | /api/auth/login    |
| POST   | /api/auth/logout   |
| GET    | /api/auth/me       |

Sistema de usuarios con contraseñas hasheadas mediante bcrypt.

---

### Pedidos y pagos

| Método | Ruta                |
| ------ | ------------------- |
| POST   | /api/create-payment |

Crea una preferencia de pago en Mercado Pago y redirige al Checkout Pro.

---

### Envíos

| Método | Ruta                |
| ------ | ------------------- |
| GET    | /api/shipping/:zone |

Calcula costo de envío según departamento.

Zonas disponibles:

* Florida
* Montevideo
* Canelones
* Maldonado
* Interior del País

---

### Sorteos

| Método | Ruta        |
| ------ | ----------- |
| POST   | /api/raffle |

Permite registrar participantes y asignar automáticamente un número de sorteo.

---

### Contacto

| Método | Ruta         |
| ------ | ------------ |
| POST   | /api/contact |

Envía consultas mediante correo electrónico usando Resend.

---

### Administración

| Método | Ruta             |
| ------ | ---------------- |
| GET    | /api/admin/users |

Obtiene usuarios registrados.

Requiere cuenta administradora.

---

### Debug

| Método | Ruta               |
| ------ | ------------------ |
| GET    | /api/debug/session |

Visualiza datos de la sesión actual.

---

## Chat en tiempo real

Implementado con Socket.IO.

Características:

* Usuarios conectados en línea
* Historial reciente de mensajes
* Mensajes privados para usuarios autenticados
* Notificaciones de conexión y desconexión

---

## Base de datos

Actualmente utiliza archivos JSON.

### Usuarios

```json
{
  "id": 123,
  "name": "Juan",
  "email": "juan@email.com",
  "password": "hash_bcrypt"
}
```

### Pedidos

```json
{
  "id": 123,
  "userId": 456,
  "status": "pending"
}
```

### Sorteos

```json
{
  "ticket": 1,
  "name": "Juan",
  "email": "juan@email.com"
}
```

---

## Seguridad

* Contraseñas cifradas con bcrypt
* Variables sensibles almacenadas en .env
* Sesiones mediante Express Session
* Protección de rutas privadas mediante middleware

---

## Autor

Desarrollado por IronicPool / TechStore 🇺🇾

Todos los derechos reservados.
