# Rentwise — Backend

## Design and Implementation of a Web-Based Vehicle Rental Management System

This repository contains the backend server of **Rentwise**, a web-based vehicle rental management system developed as a university defense project.

The backend provides RESTful APIs for authentication, customer management, vehicle management, booking management, maintenance scheduling, administrator management, and vehicle availability synchronization.

The backend is built using **Node.js, Express, TypeScript, and PostgreSQL**.

---

# Project Overview

Rentwise is designed to simplify vehicle rental operations by connecting customers and administrators through a centralized web-based system.

The backend is responsible for:

* User authentication
* Customer management
* Administrator management
* Role-based authorization
* Vehicle management
* Vehicle availability
* Maintenance scheduling
* Booking creation
* Booking cancellation
* Booking completion
* Booking history
* Automatic booking completion
* Vehicle status synchronization

---

# Technology Stack

| Technology | Purpose                    |
| ---------- | -------------------------- |
| Node.js    | Runtime environment        |
| Express.js | Backend framework          |
| TypeScript | Type-safe development      |
| PostgreSQL | Relational database        |
| pg         | PostgreSQL driver          |
| JWT        | Authentication             |
| bcrypt     | Password hashing           |
| dotenv     | Environment configuration  |
| cors       | Cross-origin communication |
| tsx        | Development execution      |

---

# System Architecture

```text
                ┌─────────────────────┐
                │   React Frontend    │
                │ React + TypeScript  │
                └──────────┬──────────┘
                           │
                           │ REST API
                           ▼
                ┌─────────────────────┐
                │   Express Backend   │
                │  Node + TypeScript  │
                └──────────┬──────────┘
                           │
             ┌─────────────┴─────────────┐
             │                           │
             ▼                           ▼
     ┌───────────────┐           ┌───────────────┐
     │ Authentication│           │ Business Logic│
     │ JWT + bcrypt  │           │ Booking etc.  │
     └───────────────┘           └───────┬───────┘
                                         │
                                         ▼
                                ┌─────────────────┐
                                │   PostgreSQL    │
                                │    Database     │
                                └─────────────────┘
```

---

# Core Modules

## Authentication

Rentwise uses:

* JWT authentication
* bcrypt password hashing
* Protected API routes
* Role-based authorization

Authentication tokens are sent using:

```text
Authorization: Bearer <token>
```

---

# User Roles

The backend supports:

### Customer

Customers can:

* Create an account
* Log in
* Search available vehicles
* Create bookings
* View their booking history
* Cancel their own eligible bookings

### Admin

Administrators can:

* Manage vehicles
* Schedule maintenance
* View customers
* View bookings
* Manage booking status
* Perform administrative operations

### Super Admin

Super administrators have higher-level administrative privileges.

They can manage administrators and perform privileged administrative operations.

The system supports administrator disabling rather than permanently deleting an administrator.

---

# Database

The project uses **PostgreSQL**.

The main database used during development is:

```text
defense
```

The system includes core tables for:

```text
Admin
Customer
Vehicle
Booking
```

The database also uses enum-based fields for controlled values such as:

* Admin roles
* Admin status
* Vehicle type
* Vehicle city
* Vehicle availability status
* Booking status

---

# Vehicle Model

A vehicle contains information such as:

```text
id
vehicle_name
type
registration_number
ac_type
total_seats
fuel_type
suitcase_capacity
daily_rent_price
city
availability_status
image
created_at
```

---

# Supported Vehicle Types

```text
car
SUV
HiAce
```

---

# Supported Cities

```text
Dhaka
Rangpur
Chattogram
```

---

# Vehicle Availability

A vehicle can have availability states such as:

```text
available
booked
maintenance
```

The backend controls vehicle availability based on current bookings and maintenance schedules.

---

# Booking System

Customers can create bookings by providing:

```text
vehicle_id
city
pickup_point
start_date
end_date
```

The authenticated customer is associated with the booking automatically.

Administrators can also create bookings on behalf of customers using customer information.

---

# Booking Validation

Before creating a booking, the backend validates:

* Authentication
* Required fields
* Vehicle ID
* Date format
* Date range
* City
* Customer information
* Vehicle existence
* Vehicle maintenance status
* Existing booking conflicts

Dates must use:

```text
YYYY-MM-DD
```

The end date cannot be earlier than the start date.

---

# Booking Overlap Prevention

The backend prevents two active bookings from overlapping for the same vehicle.

The overlap condition is:

```text
existing start_date <= new end_date
AND
existing end_date >= new start_date
```

Therefore, a vehicle cannot be booked by multiple customers for overlapping rental periods.

---

# Rental Calculation

Rent is calculated using inclusive rental days.

For example:

```text
Start Date = 20 December
End Date   = 22 December

Rental Days = 3
```

The total rental price is:

```text
Total Rent = Daily Rent × Rental Days
```

---

# Booking Status

The system supports booking statuses including:

```text
Booked
Completed
Cancelled
```

---

# Vehicle and Booking Synchronization

One of the important backend features is automatic synchronization between bookings and vehicle availability.

When a booking is successfully created, the backend checks whether the booking is currently active.

If the booking covers the current date:

```text
Vehicle → booked
```

If the booking is for a future date, the vehicle does not become currently booked simply because a future reservation exists.

After cancellation or completion:

```text
Vehicle → available
```

unless another active booking or maintenance condition requires otherwise.

---

# Maintenance System

Administrators can schedule vehicle maintenance.

Maintenance is managed using:

* Registration number
* Start date/time
* End date/time

A vehicle under maintenance cannot be booked.

Maintenance has priority over normal booking availability.

The backend preserves:

```text
maintenance
```

instead of changing the vehicle back to `available` while the vehicle is still under maintenance.

---

# Automatic Booking Completion

The backend checks expired bookings using Bangladesh local date/time.

When an active booking's end date has passed:

```text
Booked → Completed
```

The corresponding vehicle availability is then synchronized.

---

# Bangladesh Timezone

The booking logic uses Bangladesh local time:

```text
Asia/Dhaka
```

This is important for:

* Current booking status
* Booking completion
* Vehicle availability
* Date-based booking logic

---

# Customer Booking History

Customers can retrieve their booking history through:

```http
GET /api/booking/my-bookings
```

The endpoint returns information including:

* Booking ID
* Vehicle name
* Registration number
* Vehicle type
* City
* Pickup point
* Start date
* End date
* Daily rent
* Total rent
* Booking status
* Booking type
* Created date

---

# Booking Cancellation

A customer can cancel their own active booking using:

```http
PATCH /api/booking/:id/cancel
```

Administrators can also cancel eligible bookings according to their privileges.

After cancellation:

```text
Booking → Cancelled
```

and the vehicle availability is synchronized again.

---

# Booking Completion

Administrators can complete a booking using:

```http
PATCH /api/booking/:id/complete
```

After completion, the backend updates the vehicle's current availability according to the remaining booking and maintenance conditions.

---

# Main API Endpoints

## Booking

### Create Booking

```http
POST /api/booking
```

Authentication:

```text
Required
```

---

### Customer Booking History

```http
GET /api/booking/my-bookings
```

Authentication:

```text
Required
```

---

### All Bookings

```http
GET /api/booking/
```

Authentication:

```text
Required
```

Authorization:

```text
Admin / Super Admin
```

---

### Customer Bookings by Phone

```http
GET /api/booking/customer/:phone
```

Authentication:

```text
Required
```

Authorization:

```text
Admin / Super Admin
```

---

### Cancel Booking

```http
PATCH /api/booking/:id/cancel
```

Authentication:

```text
Required
```

---

### Complete Booking

```http
PATCH /api/booking/:id/complete
```

Authentication:

```text
Required
```

---

# Vehicle API

The backend provides vehicle APIs for:

* Adding vehicles
* Searching vehicles
* Searching available vehicles
* Vehicle information management
* Maintenance scheduling
* Vehicle availability management

Important endpoints include:

```http
POST /api/vehicle
```

```http
GET /api/vehicle/search
```

```http
GET /api/vehicle/available
```

```http
PATCH /api/vehicle/maintenance
```

---

# Vehicle Availability Search

The frontend can request available vehicles using:

```http
GET /api/vehicle/available
```

Supported query parameters include:

```text
start_date
end_date
type
city
```

Example:

```text
/api/vehicle/available?start_date=2026-09-27&end_date=2026-09-30&type=SUV&city=Dhaka
```

The backend checks the selected rental period and returns vehicles that can be booked for that period.

---

# Vehicle Search for Maintenance

Administrators can search for a vehicle using:

```http
GET /api/vehicle/search
```

Parameters include:

```text
registration_number
date
start_time
end_time
```

This allows administrators to identify a specific vehicle before scheduling maintenance.

---

# Project Structure

```text
backend/
│
├── src/
│   ├── config/
│   │   └── db.ts
│   │
│   ├── controllers/
│   │   ├── bookingController.ts
│   │   ├── vehicleController.ts
│   │   └── ...
│   │
│   ├── middleware/
│   │   ├── authMiddleware.ts
│   │   ├── requireAdmin.ts
│   │   └── roleMiddleware.ts
│   │
│   ├── routes/
│   │   ├── bookingRoutes.ts
│   │   ├── vehicleRoutes.ts
│   │   └── ...
│   │
│   └── server.ts
│
├── .env
├── package.json
├── tsconfig.json
└── README.md
```

---

# Environment Variables

Create a `.env` file inside the backend directory.

Example:

```env
PORT=5000

DB_USER=postgres
DB_HOST=localhost
DB_NAME=defense
DB_PORT=5432

JWT_SECRET=your_secret_key
```

Do not commit the actual `.env` file to GitHub.

---

# Database Setup

## 1. Install PostgreSQL

Install PostgreSQL on the development machine.

---

## 2. Create Database

Create a database named:

```text
defense
```

---

## 3. Configure `.env`

Set the PostgreSQL credentials:

```env
DB_USER=postgres
DB_HOST=localhost
DB_NAME=defense
DB_PORT=5432
```

Use the correct PostgreSQL username and password for the local machine.

---

# Installation

Navigate to the backend directory:

```bash
cd backend
```

Install dependencies:

```bash
npm install
```

---

# Development Server

Run the backend in development mode:

```bash
npm run dev
```

The backend server runs on:

```text
http://localhost:5000
```

---

# Production Build

Compile TypeScript:

```bash
npm run build
```

The compiled JavaScript files are generated in the configured build directory.

Start the production server:

```bash
npm start
```

---

# Security

The backend implements several security mechanisms.

### Password Hashing

Customer and administrator passwords are protected using:

```text
bcrypt
```

Passwords are not stored as plain text.

### JWT Authentication

Authenticated requests use:

```text
Authorization: Bearer <token>
```

### Role-Based Authorization

Administrative routes are protected using middleware that checks the authenticated user's role.

---

# Error Handling

The backend validates requests before performing database operations.

Common HTTP responses include:

```text
200 OK
201 Created
400 Bad Request
401 Unauthorized
403 Forbidden
404 Not Found
409 Conflict
500 Internal Server Error
```

For example:

* Invalid input → `400`
* Missing authentication → `401`
* Insufficient permissions → `403`
* Vehicle not found → `404`
* Booking conflict → `409`
* Maintenance conflict → `409`

---

# CORS

CORS is configured so that the React frontend can communicate with the Express backend during local development.

Frontend:

```text
http://localhost:5173
```

Backend:

```text
http://localhost:5000
```

---

# Running the Complete Project

The Rentwise project requires both frontend and backend servers.

## Terminal 1 — Backend

```bash
cd backend
npm install
npm run dev
```

Backend:

```text
http://localhost:5000
```

---

## Terminal 2 — Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend:

```text
http://localhost:5173
```

---

# Complete System Flow

```text
Customer
   │
   ▼
Search Vehicle
   │
   ▼
Select Rental Dates
   │
   ▼
View Available Vehicles
   │
   ▼
Select Vehicle
   │
   ▼
Login / Create Account
   │
   ▼
Booking
   │
   ▼
Backend Validation
   │
   ├── Vehicle Availability
   ├── Maintenance Check
   ├── Date Conflict Check
   └── Customer Validation
   │
   ▼
PostgreSQL
   │
   ▼
Booking Created
   │
   ▼
Vehicle Status Synchronized
```

---

# Key Business Rules

The backend follows the following important business rules:

1. A vehicle cannot have overlapping active bookings.
2. A vehicle under maintenance cannot be booked.
3. Future bookings do not automatically make the vehicle currently `booked`.
4. A currently active booking can make the vehicle `booked`.
5. Cancelled bookings do not remain active.
6. Completed bookings are no longer active.
7. Vehicle availability is synchronized after booking changes.
8. Rental days are calculated inclusively.
9. Bangladesh local time is used for current booking status and automatic completion.
10. Administrative operations require appropriate authorization.
11. Customer booking history is accessible only to the authenticated customer.
12. Vehicle registration numbers uniquely identify vehicles.

---

# Team

### Team 2

**Project:** Rentwise

**Title:** Design and Implementation of a Web-Based Vehicle Rental Management System

| Name               | Student ID    |
| ------------------ | ------------- |
| Md. Abdul Aual     | CSE2301028137 |
| Jannatul Hafsa Mim | CSE2301028122 |
| Moriom Akter       | CSE2301028138 |
| Asma Banu          | CSE2301028166 |

---

# Academic Project

Rentwise was developed as a university defense project to demonstrate the practical implementation of:

* Web application development
* REST API development
* Database management
* Authentication and authorization
* Role-based access control
* Vehicle rental management
* Booking management
* Business rule implementation
* Frontend-backend integration

---

## License

This project was developed for academic and educational purposes as part of a university defense project.
