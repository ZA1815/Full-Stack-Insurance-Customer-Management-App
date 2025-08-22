# Full-Stack-Insurance-Customer-Management-App

An app that allows for the creation of accounts, persistent login after refreshes, search by customer name and policy number, ability to add new customers, update existing customers, and clear side panel of all existing customers with relevant data.

## Features
- Secure authentication with bcrypt password hashing
- Full CRUD operations for customer management
- Real-time search functionality
- Responsive design for mobile and desktop
- Session-based authentication

## Tech Stack
- **Backend**: Node.js, Express.js
- **Database**: Microsoft SQL Server
- **Frontend**: JavaScript, CSS
- **Security**: bcrypt, express-session

## Installation
1. Clone the repository
2. Run `npm install` in project directory
3. Configure environment variables (see .env.example)
4. Run `npm run dev` in project directory
5. Navigate to url listed in command prompt

## Default Login
Username: admin
Password: admin123

## API Endpoints
- `POST /api/login` - User authentication
- `GET /api/customers` - Retrieve customers (with optional search)
- `POST /api/customers` - Create new customer
- `PUT /api/customers/:id` - Update customer
- `DELETE /api/customers/:id` - Delete customer