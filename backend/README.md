# Drive.ly Backend API Server

A robust Node.js/Express backend server for the Drive.ly ride-hailing platform. This server provides RESTful APIs and real-time Socket.IO communication for passengers and drivers across Africa.

## 🚀 Features

### Core Functionality
- **Authentication System** - User registration, login, and JWT-based authentication
- **Ride Management** - Create, accept, update, and track rides in real-time
- **Driver Operations** - Driver profile management, availability toggle, and earnings tracking
- **Passenger Operations** - Profile management, location updates, and community routes
- **Payment Integration** - Secure payment processing via Flutterwave
- **Real-time Communication** - Socket.IO for live ride updates and driver matching
- **Route Matching** - Intelligent algorithm to match passengers with drivers based on routes
- **Community Routes** - Shared commute routes for faster matching
- **Google Maps Integration** - Distance and duration calculations
- **Push Notifications** - Firebase Cloud Messaging for ride notifications

## 🛠️ Tech Stack

- **Node.js** - JavaScript runtime
- **Express.js** - Web framework
- **Socket.IO** - Real-time bidirectional communication
- **PostgreSQL** - Relational database
- **JWT** - Authentication tokens
- **Bcrypt** - Password hashing
- **Flutterwave** - Payment processing
- **Firebase Admin** - Push notifications
- **Google Maps API** - Geospatial calculations
- **Axios** - HTTP client
- **Dotenv** - Environment variables
- **CORS** - Cross-origin resource sharing
- **Express Validator** - Request validation

## 📦 Installation

1. **Navigate to the backend directory:**
   ```bash
   cd backend
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure environment variables:**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Start PostgreSQL:**
   - Ensure PostgreSQL is running locally and that the credentials in `.env` are valid
   - The backend creates the configured database and required tables automatically on startup

5. **Start the development server:**
   ```bash
   npm run dev
   ```

6. **Start the production server:**
   ```bash
   npm start
   ```

## 📁 Project Structure

```
backend/
├── src/
│   ├── config/
│   │   └── database.js          # PostgreSQL connection and schema bootstrap
│   ├── middleware/
│   │   └── auth.js              # JWT authentication middleware
│   ├── models/
│   │   ├── User.js              # User model (passenger/driver)
│   │   ├── Driver.js            # Driver profile model
│   │   ├── Ride.js              # Ride model
│   │   └── Community.js         # Community route model
│   ├── routes/
│   │   ├── auth.js              # Authentication routes
│   │   ├── rides.js             # Ride management routes
│   │   ├── drivers.js           # Driver operations routes
│   │   ├── passengers.js        # Passenger operations routes
│   │   └── payments.js         # Payment processing routes
│   ├── services/
│   │   ├── socketService.js     # Socket.IO real-time communication
│   │   └── routeMatchingService.js # Passenger-driver matching algorithm
│   └── server.js                # Main server entry point
├── .env                         # Environment variables
├── package.json                 # Dependencies and scripts
└── README.md                    # This file
```

## 🔧 Configuration

### Environment Variables (.env)

```env
# Server Configuration
PORT=3000
SOCKET_PORT=3001
CLIENT_URL=http://localhost:19006

# Database
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=
DB_NAME=drively
DB_PORT=3306

# JWT
JWT_SECRET=your_jwt_secret_here
JWT_EXPIRE=7d

# Google Maps
GOOGLE_MAPS_API_KEY=your_google_maps_api_key

# Flutterwave
FLUTTERWAVE_PUBLIC_KEY=your_flutterwave_public_key
FLUTTERWAVE_SECRET_KEY=your_flutterwave_secret_key
FLUTTERWAVE_ENCRYPTION_KEY=your_flutterwave_encryption_key

# Commission
COMMISSION_RATE=0.15

# Firebase (for push notifications)
FIREBASE_PROJECT_ID=your_firebase_project_id
FIREBASE_PRIVATE_KEY=your_firebase_private_key
FIREBASE_CLIENT_EMAIL=your_firebase_client_email
```

## 🔌 API Endpoints

### Authentication (`/api/auth`)

- `POST /api/auth/register` - Register a new user
  - Body: `{ phoneNumber, password, name, role }`
  
- `POST /api/auth/login` - Login user
  - Body: `{ phoneNumber, password }`
  - Returns: `{ token, user }`

- `GET /api/auth/me` - Get current user profile
  - Headers: `Authorization: Bearer <token>`

- `POST /api/auth/logout` - Logout user
  - Headers: `Authorization: Bearer <token>`

### Rides (`/api/rides`)

- `POST /api/rides/request` - Request a new ride
  - Body: `{ pickupLocation, dropoffLocation, vehicleType }`
  - Headers: `Authorization: Bearer <token>`

- `GET /api/rides/search` - Search for available rides
  - Query: `origin, destination, vehicleType`

- `POST /api/rides/accept` - Accept a ride (driver)
  - Body: `{ rideId, driverId }`
  - Headers: `Authorization: Bearer <token>`

- `GET /api/rides/:id` - Get ride details
  - Headers: `Authorization: Bearer <token>`

- `PATCH /api/rides/:id/status` - Update ride status
  - Body: `{ status }`
  - Headers: `Authorization: Bearer <token>`

- `GET /api/rides/history/user` - Get user's ride history
  - Headers: `Authorization: Bearer <token>`

### Drivers (`/api/drivers`)

- `POST /api/drivers/profile` - Create driver profile
  - Body: `{ vehicleModel, vehiclePlateNumber, vehicleColor }`
  - Headers: `Authorization: Bearer <token>`

- `GET /api/drivers/profile` - Get driver profile
  - Headers: `Authorization: Bearer <token>`

- `PATCH /api/drivers/availability` - Update driver availability
  - Body: `{ isAvailable, currentRoute }`
  - Headers: `Authorization: Bearer <token>`

- `GET /api/drivers/earnings` - Get driver earnings
  - Headers: `Authorization: Bearer <token>`

- `GET /api/drivers/nearby` - Get nearby drivers
  - Query: `latitude, longitude, radius`
  - Headers: `Authorization: Bearer <token>`

### Passengers (`/api/passengers`)

- `GET /api/passengers/profile` - Get passenger profile
  - Headers: `Authorization: Bearer <token>`

- `PATCH /api/passengers/location` - Update passenger location
  - Body: `{ latitude, longitude }`
  - Headers: `Authorization: Bearer <token>`

- `GET /api/passengers/communities` - Get available communities
  - Headers: `Authorization: Bearer <token>`

- `POST /api/passengers/communities/join` - Join a community
  - Body: `{ communityId }`
  - Headers: `Authorization: Bearer <token>`

- `POST /api/passengers/communities/leave` - Leave a community
  - Body: `{ communityId }`
  - Headers: `Authorization: Bearer <token>`

### Payments (`/api/payments`)

- `POST /api/payments/process` - Process payment for a ride
  - Body: `{ rideId, amount, method, cardDetails }`
  - Headers: `Authorization: Bearer <token>`

- `GET /api/payments/history` - Get payment history
  - Headers: `Authorization: Bearer <token>`

- `POST /api/payments/wallet/add` - Add funds to wallet
  - Body: `{ amount, paymentDetails }`
  - Headers: `Authorization: Bearer <token>`

## 📡 Socket.IO Events

### Client → Server

- `authenticate` - Authenticate socket connection with JWT token

- `driver:broadcast_route` - Driver broadcasts their current route
  - Data: `{ driverId, origin, destination, waypoints }`

### Server → Client (Passenger)

- `ride_available` - Notify passenger of available driver match
  - Data: `{ rideId, driverInfo, estimatedArrival }`

- `ride_accepted` - Notify passenger that ride has been accepted
  - Data: `{ rideId, driverLocation }`

- `ride_status_updated` - Notify passenger of ride status change
  - Data: `{ rideId, status }`

- `driver_location_update` - Real-time driver location updates
  - Data: `{ rideId, location }`

- `no_matches_found` - Notify passenger when no drivers found
  - Data: `{ rideId, message }`

### Server → Client (Driver)

- `route_matched` - Notify driver of matching passenger
  - Data: `{ rideId, passengerInfo, pickupLocation, dropoffLocation }`

- `ride_request` - Notify driver of new ride request
  - Data: `{ rideId, passengerInfo, pickupLocation, dropoffLocation, fare }`

### Connection Events

- `connect` - Client connected
- `disconnect` - Client disconnected
- `authenticated` - Socket authenticated successfully
- `error` - Socket error

## 🗄️ Database Models

### User
- `phoneNumber` - Unique phone number
- `password` - Hashed password
- `name` - User's name
- `role` - 'passenger' or 'driver'
- `rating` - Average rating
- `createdAt` - Registration date

### Driver
- `userId` - Reference to User
- `vehicleModel` - Vehicle model
- `vehiclePlateNumber` - License plate
- `vehicleColor` - Vehicle color
- `isAvailable` - Online/offline status
- `currentRoute` - Current broadcasted route
- `earnings` - Total earnings
- `rating` - Average rating

### Ride
- `passengerId` - Reference to User (passenger)
- `driverId` - Reference to User (driver)
- `pickupLocation` - Pickup coordinates
- `dropoffLocation` - Dropoff coordinates
- `fare` - Ride fare
- `status` - 'requested', 'accepted', 'in_progress', 'completed', 'cancelled'
- `vehicleType` - 'car' or 'bike'
- `createdAt` - Request time
- `updatedAt` - Last update time

### Community
- `name` - Community name
- `description` - Community description
- `origin` - Origin location
- `destination` - Destination location
- `memberCount` - Number of members
- `members` - Array of passenger IDs

## 🧪 Testing

Run tests with Jest:
```bash
npm test
```

## 🚢 Deployment

### Using PM2 (Production)

```bash
# Install PM2 globally
npm install -g pm2

# Start the server
pm2 start src/server.js --name "drively-backend"

# Monitor logs
pm2 logs drively-backend

# Restart server
pm2 restart drively-backend

# Stop server
pm2 stop drively-backend
```

### Using Docker (Optional)

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY . .
EXPOSE 3000 3001
CMD ["node", "src/server.js"]
```

```bash
# Build image
docker build -t drively-backend .

# Run container
docker run -p 3000:3000 -p 3001:3001 --env-file .env drively-backend
```

## 🔒 Security

- Passwords are hashed using bcrypt
- JWT tokens for authentication
- CORS enabled for cross-origin requests
- Input validation using express-validator
- Environment variables for sensitive data
- Rate limiting (recommended for production)

## 🐛 Troubleshooting

### PostgreSQL Connection Failed
```bash
# Check if PostgreSQL is running
sudo systemctl status postgresql   # Linux
brew services list postgresql      # macOS

# Start PostgreSQL
sudo systemctl start postgresql    # Linux
brew services start postgresql     # macOS
```

### Port Already in Use
```bash
# Find process using port 3000
lsof -i :3000  # macOS/Linux
netstat -ano | findstr :3000  # Windows

# Kill process
kill -9 <PID>  # macOS/Linux
taskkill /PID <PID> /F  # Windows
```

### Socket.IO Connection Issues
- Check CLIENT_URL in .env matches mobile app URL
- Ensure CORS is properly configured
- Verify Socket.IO port (default 3001) is not blocked

### Dependency Issues
```bash
# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm install
```

## 📚 API Documentation

For detailed API documentation, consider using tools like:
- Swagger/OpenAPI
- Postman Collection
- Insomnia

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License.

## 👥 Team

Drive.ly Backend Development Team

## 📞 Support

For support, email adrienkemdem@gmail.com or join our Discord community.

---

**Built with ❤️ for Africa**
