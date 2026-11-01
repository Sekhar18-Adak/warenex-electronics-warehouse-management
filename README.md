# WareNex – Electronics Warehouse Management System

WareNex is an internal warehouse and operations management platform for electronics retail and stock handling. It covers employee authentication, role-based dashboards, product and inventory tracking, supplier and purchase workflows, sales history, task assignment, reports, announcements, and customer management.

This project is built with Node.js, Express, EJS, MySQL, and Bootstrap.

## Features

### Admin
- Dashboard overview and navigation
- Employee management
- Inventory management
- Task management
- Supplier management
- Reports and announcements
- Role-based access control

### Manager
- Dashboard overview
- Product and inventory monitoring
- Purchase workflows
- Task tracking
- Announcements and reporting

### Sales
- Sales dashboard
- Sales history entry and updates
- Customer creation and updates
- Product and customer lookups
- Sales announcements and profile management

### Employee
- Employee dashboard
- Assigned task handling
- Inventory viewing
- Profile access

### Shared system features
- Secure login with JWT-style session cookies
- MySQL-backed persistence
- Bootstrap-based responsive UI
- Image upload support for profile pictures
- Announcement and task tracking workflows

## Tech Stack

- Node.js
- Express.js
- EJS templates
- MySQL 8 / MariaDB compatible database
- Bootstrap 5
- bcrypt, dotenv, jwt, multer, mysql2

## Project Structure

```text
.
├── app.js
├── server.js
├── package.json
├── README.md
├── .gitignore
├── public/
│   ├── css/
│   ├── image/
│   ├── js/
│   └── uploads/
├── src/
│   ├── config/
│   ├── constants/
│   ├── controllers/
│   ├── middlewares/
│   ├── repositories/
│   ├── routes/
│   ├── services/
│   ├── utils/
│   ├── validators/
│   └── app logic modules
├── views/
│   ├── auth/
│   ├── dashboard/
│   ├── inventory/
│   ├── manager/
│   ├── products/
│   ├── purchase/
│   ├── sales/
│   ├── supplier/
│   ├── partials/
│   └── landing.ejs
├── database/
│   ├── migration/
│   ├── schema/
│   └── seeders/
├── scripts/
│   └── createDatabase.js
├── tests/
├── logs/
├── uploads/
│   ├── profiles/
│   ├── reports/
│   └── generated files
└── node_modules/
```

## Prerequisites

Before running the project, make sure the following are installed:

- Node.js 18+ or newer
- npm
- MySQL server
- A MySQL client such as MySQL Workbench, phpMyAdmin, or the MySQL shell

## Installation

1. Clone the repository:

```bash
git clone <your-repository-url>
cd store-manager
```

2. Install dependencies:

```bash
npm install
```

3. Create a `.env` file in the project root and add the required environment settings:

```env
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=warenex
JWT_TOKEN=your_super_secret_key
PORT=5000
HOST=localhost
NODE_ENV=development
```

4. Create the database if needed:

```bash
node scripts/createDatabase.js
```

5. Import the SQL schema and migration files into MySQL. The project includes files under:

- `database/schema/`
- `database/migration/`

You can import them using MySQL CLI or any MySQL client.

Example:

```bash
mysql -u root -p
CREATE DATABASE warenex;
USE warenex;
source database/schema/authentication_schema.sql;
```

Then import the migration files as needed for the warehouse tables and business data.

6. Start the project:

### Development mode

```bash
npm run dev
```

### Production mode

```bash
npm start
```

The application will run at:

```text
http://localhost:5000
```

## Default Login Behavior

The app supports different roles through the user table and authentication flow:

- Admin login uses the admin login page
- Manager, Sales, and Employee users use the employee login page
- Role-based middleware controls route access for each section

You must create or seed valid users in the `users` table with a role and status that match the app logic.

Typical roles supported:

- `Admin`
- `Manager`
- `Sales`
- `Employee`

Typical status values:

- `Active`
- `Inactive`

## Environment and Security Notes

- The `.env` file contains sensitive database and JWT values.
- Never commit credentials or secrets to GitHub.
- Use strong values for `JWT_TOKEN` and database passwords in production.

## Database Notes

The application uses MySQL and expects the related tables to exist before runtime. Core schema files live in the `database/` folder and the application is designed around role-based warehouse data operations.

## Scripts and Utilities

- `scripts/createDatabase.js` creates the configured MySQL database if it does not already exist.
- `tests/` contains controller and behavior checks for key sales logic.
- `logs/` stores server or application logs.
- `uploads/` stores uploaded profile and report files.

## Contribution

Pull requests and improvements are welcome. Please keep the project consistent with the current folder structure and role-based architecture when making changes.

## License

This project is currently intended for internal business use and is not published under a public software license unless specified separately by the owner.
