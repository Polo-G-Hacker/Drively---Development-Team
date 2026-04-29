# Drive.ly - Move Smart Across Africa

A modern ride-hailing application built with Expo (React Native) for mobile and Node.js/Express for the backend. Drive.ly connects passengers with drivers across Africa, offering car and bike ride options, community-based routes, and real-time tracking.

## 🚀 Features

### For Passengers
- **Real-time Ride Booking**: Book rides with cars or bikes in real-time
- **Live Location Tracking**: Track your ride and driver's location on the map
- **Multiple Vehicle Options**: Choose between cars and bikes based on your needs
- **Community Routes**: Join community-based routes for shared rides
- **Secure Authentication**: JWT-based authentication for secure access
- **In-app Payments**: Integrated payment system for seamless transactions

### For Drivers
- **Ride Acceptance System**: Accept ride requests from passengers
- **Earnings Management**: Track your earnings and ride history
- **Location Sharing**: Share your real-time location with passengers
- **Flexible Availability**: Set your availability status

### Technical Features
- **Real-time Communication**: Socket.IO for real-time updates
- **Responsive Design**: Works on Android and iOS devices
- **Type Safety**: TypeScript for type-safe code
- **Centralized API**: Structured API client for backend communication
- **Location Services**: GPS integration for accurate location tracking

## 🛠️ Tech Stack

### Mobile App (Expo/React Native)
- **React Native** - Cross-platform mobile development
- **Expo** - Development platform and tooling
- **Expo Router** - File-based routing
- **TypeScript** - Type-safe JavaScript
- **React Native Maps** - Interactive maps
- **Expo Location** - GPS and location services
- **Socket.IO Client** - Real-time communication
- **Axios** - HTTP client for API requests
- **AsyncStorage** - Local data persistence

### Backend (Node.js/Express)
- **Node.js** - JavaScript runtime
- **Express** - Web framework
- **MongoDB** - NoSQL database
- **Mongoose** - MongoDB object modeling
- **Socket.IO** - Real-time bidirectional communication
- **JWT** - Authentication tokens
- **Express Validator** - Request validation

## 📁 Project Structure

```
DriveLy.V2/
├── backend/              # Node.js/Express API server
│   ├── src/
│   │   ├── config/      # Database configuration
│   │   ├── middleware/  # Custom middleware (auth)
│   │   ├── models/      # Mongoose models (User, Driver, Ride, Community)
│   │   ├── routes/      # API routes (auth, rides, drivers, passengers, payments)
│   │   ├── services/    # Business logic and Socket.IO services
│   │   └── server.js    # Entry point
│   ├── .env             # Environment variables
│   └── package.json
│
└── mobile-clean/        # Expo React Native mobile app
    ├── app/             # Expo Router file-based routing
    │   ├── (tabs)/     # Tab navigation screens
    │   │   ├── index.tsx      # Home screen with map
    │   │   ├── communities.tsx # Community routes
    │   │   ├── explore.tsx     # Explore screen
    │   │   └── profile.tsx     # User profile
    │   ├── index.tsx           # Splash screen
    │   ├── login.tsx           # Login/Registration
    │   └── _layout.tsx         # Root layout
    ├── assets/          # Images, icons, fonts
    ├── components/      # Reusable UI components
    ├── config/          # API and Socket configuration
    ├── contexts/        # React Context (Auth)
    ├── services/        # API and Socket clients
    ├── types/           # TypeScript type definitions
    └── package.json
```

## 🚀 Getting Started

### Prerequisites
- Node.js (v18 or higher)
- npm or yarn
- MongoDB (local or cloud instance)
- Expo Go app (for mobile testing)
- Git

### Backend Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/Polo-G-Hacker/Drively---Development-Team.git
   cd DriveLy.V2/backend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**
   Create a `.env` file in the `backend` directory:
   ```env
   PORT=3000
   SOCKET_PORT=3001
   MONGODB_URI=mongodb://localhost:27017/drively
   JWT_SECRET=your_jwt_secret_here
   CLIENT_URL=http://localhost:8081
   ```

4. **Start the backend server**
   ```bash
   npm start
   ```
   The server will run on `http://localhost:3000` and Socket.IO on `http://localhost:3001`

### Mobile App Setup

1. **Navigate to mobile-clean directory**
   ```bash
   cd ../mobile-clean
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure API URLs**
   Edit `config/api-config.ts` for your environment:
   ```typescript
   // For Android Emulator
   BASE_URL: 'http://10.0.2.2:3000/api'
   
   // For Physical Device (use your local IP)
   BASE_URL: 'http://YOUR_LOCAL_IP:3000/api'
   ```

4. **Start the Expo development server**
   ```bash
   npx expo start
   ```

5. **Run on your device**
   - **Android**: Scan the QR code with Expo Go app
   - **iOS**: Scan the QR code with Camera app
   - **Web**: Press `w` to open in browser

## 📱 Usage

### For Passengers
1. Open the app and register/login
2. Grant location permissions
3. Enter your destination
4. Select vehicle type (car or bike)
5. Tap "Request Ride"
6. Wait for driver acceptance
7. Track your ride in real-time

### For Drivers
1. Register as a driver
2. Set your availability status
3. Accept ride requests
4. Navigate to pickup location
5. Complete the ride

## 🔧 Configuration

### Backend Configuration
- **Database**: Configure MongoDB connection in `.env`
- **Ports**: Change API and Socket ports in `.env`
- **JWT Secret**: Set a secure JWT secret for authentication

### Mobile Configuration
- **API URL**: Update in `config/api-config.ts`
- **Socket URL**: Update in `config/socket-config.ts`
- **App Icon**: Update in `app.json`

## 🤝 Contributing

We welcome contributions! Here's how you can help:

1. **Fork the repository**
2. **Create a feature branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```
3. **Make your changes**
4. **Commit your changes**
   ```bash
   git commit -m "Add your feature"
   ```
5. **Push to the branch**
   ```bash
   git push origin feature/your-feature-name
   ```
6. **Open a Pull Request**

### Development Guidelines
- Follow the existing code style
- Write meaningful commit messages
- Add tests for new features
- Update documentation as needed

## 📄 License

This project is licensed under the MIT License.

## 👥 Team

- **Development Team**: Drive.ly Development Team
- **Project Lead**: Polo-G-Hacker

## 📞 Contact

For questions or support, please open an issue on GitHub or contact the development team.

## 🙏 Acknowledgments

- Expo team for the amazing development platform
- React Native community
- All contributors to this project

---

**Built by 🅿️olo G with heart for Africa**
