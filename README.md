# Rentwise – Web-Based Vehicle Rental Management System

## 📌 Project Overview

**Rentwise** is a web-based vehicle rental management system designed to make vehicle rental services easier, faster, and more organized.

The system allows customers to browse available vehicles, view rental information, and make bookings. Administrators can manage vehicles, manage users, and handle bookings through an administrative interface.

The project is developed as a **local web application** using a modern backend architecture with **Node.js, Express.js, TypeScript/JavaScript, and PostgreSQL**.

---

## 🎯 Objectives

The main objectives of Rentwise are:

* To provide an easy-to-use vehicle rental platform.
* To allow customers to view available vehicles.
* To allow customers to make vehicle bookings.
* To allow administrators to add and manage vehicles.
* To manage vehicle availability automatically.
* To provide secure user authentication.
* To organize vehicle and booking information using a relational database.
* To reduce manual work in vehicle rental management.

---

## ✨ Key Features

### 👤 Customer Features

* Customer registration and login
* Secure password storage
* Browse available vehicles
* View vehicle details
* View vehicle type and rental price
* View vehicles according to city
* Book a vehicle
* Cancel bookings
* View booking information
* Vehicle availability updates automatically after booking

### 🛠️ Admin Features

* Admin login
* Add new vehicles
* Update vehicle information
* Delete or disable vehicles
* Manage vehicle availability
* View vehicle information
* Create bookings on behalf of customers
* Manage customer information
* Manage booking-related information
* Administrative access control

### 🔐 Authentication & Security

* Password hashing using **bcrypt**
* Authentication using **JSON Web Token (JWT)**
* Role-based access control
* Protected administrative routes
* Environment variables for database configuration
* CORS configuration

---

## 🚗 Vehicle Management

Each vehicle contains important information such as:

* Vehicle name
* Vehicle type
* Registration number
* Daily rental price
* City
* Availability status
* Vehicle image

Supported vehicle categories include:

* Car
* Private Car
* SUV
* HiAce
* Motorcycle

Vehicle rental prices can vary depending on the city.

---

## 📅 Booking System

The booking system allows customers to reserve available vehicles.

When a vehicle is successfully booked:

```text
Vehicle Status
      ↓
Available
      ↓
Booking Created
      ↓
Booked
```

When a booking is cancelled or completed and there is no other active booking for that vehicle:

```text
Booked
   ↓
Booking Cancelled / Completed
   ↓
Available
```

This keeps the vehicle availability status synchronized with the booking system.

---

## 🗄️ Database

Rentwise uses **PostgreSQL** as its relational database management system.

The database contains information related to:

* Users
* Vehicles
* Bookings
* Administrators
* Super Administrators
* Audit information

The database is designed to maintain relationships between users, vehicles, and bookings.

---

## 🧰 Technologies Used

### Backend

```text
Node.js
Express.js
JavaScript / TypeScript
```

### Database

```text
PostgreSQL
```

### Authentication & Security

```text
bcrypt
JSON Web Token (JWT)
CORS
dotenv
```

### Development Tools

```text
npm
Nodemon
VS Code
pgAdmin
Git
GitHub
```

---

## 📁 Project Structure

```text
backend/
│
├── src/
│   ├── config/
│   │   └── db.js
│   │
│   ├── controllers/
│   │
│   ├── routes/
│   │
│   ├── middleware/
│   │
│   └── server.js
│
├── uploads/
│   └── vehicles/
│
├── .env
├── .gitignore
├── package.json
├── package-lock.json
└── README.md
```

> The exact folder structure may change as new features are added to the project.

---

## ⚙️ Installation & Setup

### 1. Clone the Repository

```bash
git clone YOUR_GITHUB_REPOSITORY_URL
```

### 2. Open the Project

```bash
cd backend
```

### 3. Install Dependencies

```bash
npm install
```

### 4. Configure Environment Variables

Create a `.env` file in the project root:

```env
DB_USER=postgres
DB_HOST=localhost
DB_NAME=defense
DB_PASSWORD=your_password
DB_PORT=5432
```

Replace `your_password` with the PostgreSQL password configured on your computer.

### 5. Create the Database

Create a PostgreSQL database named:

```text
defense
```

Then create the required tables using the project's SQL/database setup.

### 6. Start the Development Server

```bash
npm run dev
```

The backend server will run locally.

---

## 🔌 API Architecture

The backend follows a RESTful API architecture.

Example API endpoints:

```text
POST   /api/auth/register
POST   /api/auth/login

GET    /api/vehicles
POST   /api/vehicles
PUT    /api/vehicles/:id
DELETE /api/vehicles/:id

GET    /api/bookings
POST   /api/bookings
PUT    /api/bookings/:id
DELETE /api/bookings/:id
```

> Endpoint names may be updated as the project development continues.

---

## 🔄 System Workflow

```text
Customer
   │
   ▼
Registration / Login
   │
   ▼
Browse Vehicles
   │
   ▼
Select Vehicle
   │
   ▼
Create Booking
   │
   ▼
Vehicle Status → Booked
```

Administrative workflow:

```text
Admin Login
     │
     ▼
Admin Dashboard
     │
     ├── Manage Vehicles
     │
     ├── Manage Customers
     │
     └── Manage Bookings
```

---

## 🖼️ Vehicle Images

Vehicle images are uploaded through the administrative interface.

The backend can store uploaded vehicle images in:

```text
uploads/vehicles/
```

The database stores the corresponding image path instead of storing the complete image as binary data.

---

## 🔒 Environment & Git Security

Sensitive environment variables are not included in the GitHub repository.

The following files/folders should be ignored:

```gitignore
node_modules/
.env
*.log
uploads/
.vscode/
.idea/
```

A `.env.example` file can be provided so that other team members know which environment variables are required.

---

## 👥 Development Team

### Team 2

| Name               | Student ID    |
| ------------------ | ------------- |
| Md. Abdul Aual     | CSE2301028137 |
| Jannatul Hafsa Mim | CSE2301028122 |
| Moriom Akter       | CSE2301028138 |
| Asma Banu          | CSE2301028166 |

---

## 🎓 Project Type

**Academic / University Defense Project**

**Project Title:**
**Design and Implementation of a Web-Based Vehicle Rental Management System**

**Project Name:**
**Rentwise**

---

## 🚀 Future Improvements

Possible future improvements include:

* Online payment integration
* Advanced booking history
* Customer reviews and ratings
* Vehicle search and filtering
* Improved admin dashboard
* Email/SMS booking notifications
* Detailed reports and analytics
* Advanced audit logging
* Multiple-city expansion
* Vehicle maintenance tracking

---

## 📄 License

This project is developed for academic and educational purposes.
