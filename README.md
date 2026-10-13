# ShutterLink — Photography Marketplace

A runnable full-stack college project for discovering freelance photographers, viewing portfolios, checking availability, booking shoots, and simulating payment.

## Stack
- Frontend: React + Vite + plain CSS
- Backend: Node.js + Express REST API
- Database: MySQL 8+
- Authentication: bcrypt password hashing + JWT
- Payments: clearly labelled **demo-only** payment flow (no real money is charged)

## Features
- Register / sign in / sign out
- Search photographers by keyword, category, city, max price, minimum rating, and availability date
- Photographer cards with rating, location, hourly/package price, and portfolio previews
- Photographer profile/portfolio details
- Create booking requests and view bookings
- Demo payment action for pending bookings
- Photographer role can create/update their profile and portfolio items
- Responsive layout and sample seed data

## Requirements
- Node.js 18+ (20+ recommended)
- MySQL 8+
- npm

## 1. Create the database
Open MySQL Workbench or the MySQL CLI and run the file `database/schema.sql`.

Example CLI:
```bash
mysql -u root -p < database/schema.sql
```
The schema creates a database called `shutterlink`.

## 2. Configure backend
Copy `server/.env.example` to `server/.env`, then edit the MySQL credentials and JWT secret:
```env
PORT=5000
CLIENT_ORIGIN=http://localhost:5173
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=shutterlink
JWT_SECRET=replace_this_with_a_long_random_secret
```

## 3. Add sample data
After creating `server/.env`, run the seed script once:
```bash
npm run seed --prefix server
```
This creates demo client and photographer accounts plus portfolio examples. Re-running the seed script resets the demo tables, so do not run it if you need to preserve your own test data.

## 4. Install and run
From the project root:
```bash
npm install
npm run install:all
npm run dev
```
Open http://localhost:5173. The API runs on http://localhost:5000.

Alternatively, install independently:
```bash
cd server && npm install && npm run dev
# in a second terminal
cd client && npm install && npm run dev
```

## Demo accounts
The seed script adds these accounts (password for all demo accounts is `Demo123!`):
- Client: `client@shutterlink.test`
- Photographer: `maya@shutterlink.test`
- Photographer: `arjun@shutterlink.test`

If the seed accounts don't work, check that you ran `database/schema.sql` successfully and that your server's database credentials are correct. You can register a new account from the UI.

## API overview
- `GET /api/health`
- `GET /api/photographers?search=&category=&city=&maxPrice=&minRating=&date=`
- `GET /api/photographers/:id`
- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me` (auth)
- `POST /api/bookings` (auth)
- `GET /api/bookings/mine` (auth)
- `POST /api/bookings/:id/demo-payment` (auth)
- `PUT /api/photographers/me` (photographer auth)
- `POST /api/photographers/me/portfolio` (photographer auth)

## Demo payment disclaimer
This project does not integrate a payment gateway and does not process actual payments. The button only marks a booking as paid in the local demo database. Never collect real card data in this demo.

## Troubleshooting
- `ECONNREFUSED` / MySQL connection errors: make sure MySQL is running and `.env` credentials match.
- `Unknown database 'shutterlink'`: run `database/schema.sql`.
- Port in use: change `PORT` in `server/.env`, or stop the other process.
- Frontend cannot reach API: ensure backend is running at port 5000. Set `VITE_API_URL` if you changed the backend URL.

## Deploy later
- Deploy the React `client` build to a static host such as Vercel or Netlify.
- Deploy the Express `server` to a Node host.
- Use a managed MySQL database.
- Set environment variables on the host (`DB_*`, `JWT_SECRET`, `CLIENT_ORIGIN`, and `VITE_API_URL` at frontend build time).
- Configure CORS for the deployed frontend domain, use HTTPS, rotate secrets, and do not use the demo seed credentials in production.
