# Drive.ly Mobile App

A modern ride-hailing mobile application built with Expo (React Native) and TypeScript. Drive.ly connects passengers with drivers across Africa, offering car and bike ride options, community-based routes, and real-time tracking.

## � Features

### For Passengers
- **Ride Booking**: Request rides with car or bike options
- **Real-time Tracking**: Track driver location in real-time
- **Community Routes**: Join regular commute routes for faster matching
- **Payment Integration**: Secure payments via Flutterwave
- **Ride History**: View past rides and ratings
- **Wallet System**: Add funds and manage balance

### For Drivers
- **Route Broadcasting**: Share your planned routes
- **Ride Requests**: Accept ride requests from passengers
- **Earnings Tracking**: Monitor daily earnings and ride count
- **Availability Toggle**: Go online/offline as needed
- **Profile Management**: Manage vehicle information

## 🛠️ Tech Stack

- **Expo SDK 54** - React Native framework
- **Expo Router** - File-based routing
- **React Native** - UI framework
- **TypeScript** - Type safety
- **React Navigation** - Navigation library
- **Socket.IO Client** - Real-time communication
- **Axios** - HTTP client
- **Expo Location** - Geolocation
- **React Native Maps** - Map integration
- **Async Storage** - Local storage
- **Expo Linear Gradient** - Gradient backgrounds

## 📦 Installation

1. **Navigate to the mobile-clean directory:**
   ```bash
   cd mobile-clean
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Start the development server:**
   ```bash
   npx expo start
   ```

4. **Run on device/simulator:**
   - Press `a` for Android emulator
   - Press `i` for iOS simulator
   - Scan QR code with Expo Go app for physical device

## 📁 Project Structure

The project follows a comprehensive, modular structure designed for scalability and maintainability.

```
mobile-clean/
├── app/                    # Expo Router file-based routing
│   ├── (tabs)/            # Tab navigation screens
│   │   ├── _layout.tsx   # Tab navigator
│   │   ├── index.tsx     # Home screen
│   │   ├── communities.tsx # Community routes
│   │   └── profile.tsx   # User profile
│   ├── _layout.tsx        # Root layout with providers
│   ├── index.tsx         # Splash screen
│   └── login.tsx         # Login/Register
├── config/                 # Configuration files
│   ├── api-config.ts     # API endpoints
│   └── socket-config.ts  # Socket.IO config
├── contexts/               # React Context providers
│   └── auth-context.tsx  # Authentication
├── services/               # External services
│   ├── api/              # API client
│   │   └── api-client.ts
│   └── socket/           # Socket client
│       └── socket-client.ts
├── types/                  # TypeScript types
│   └── index.ts
├── components/             # UI components
├── constants/              # App constants
├── hooks/                  # Custom hooks
└── utils/                  # Utility functions
```

For detailed structure documentation, see [STRUCTURE.md](./STRUCTURE.md).

## 🔧 Configuration

### API Configuration
Edit `config/api-config.ts` to change API endpoints:
```typescript
export const API_CONFIG = {
  BASE_URL: 'http://localhost:3000/api',
  TIMEOUT: 10000,
};
```

### Socket Configuration
Edit `config/socket-config.ts` to change Socket.IO settings:
```typescript
export const SOCKET_CONFIG = {
  URL: 'http://localhost:3001',
  TRANSPORTS: ['websocket'],
};
```

### App Configuration
Edit `app.json` to change app name, icon, and other settings:
```json
{
  "expo": {
    "name": "Drive.ly",
    "slug": "drively",
    "icon": "./assets/images/ic_launcher.png"
  }
}
```

## 📱 Screens

### Authentication
- **Splash Screen** (`app/index.tsx`) - Entry point with auth redirect
- **Login Screen** (`app/login.tsx`) - Login and registration

### Main App (Tabs)
- **Home** (`app/(tabs)/index.tsx`) - Ride booking with map
- **Communities** (`app/(tabs)/communities.tsx`) - Community routes
- **Profile** (`app/(tabs)/profile.tsx`) - User profile and settings

## 🔌 API Integration

The app communicates with the backend via the API client in `services/api/api-client.ts`:

```typescript
import { authAPI, rideAPI, driverAPI, passengerAPI, paymentAPI } from '../services/api/api-client';

// Example usage
const result = await authAPI.login(phoneNumber, password);
const rides = await rideAPI.searchRides(params);
```

## 📡 Real-time Communication

Socket.IO integration for real-time updates:

```typescript
import { initializeSocket, listenForRideUpdates } from '../services/socket/socket-client';

// Initialize socket
initializeSocket(token);

// Listen for events
listenForRideUpdates({
  onRideAvailable: (data) => console.log(data),
  onRideAccepted: (data) => console.log(data),
});
```

## 🧪 Development

### Code Style
- Use TypeScript for type safety
- Follow kebab-case for file names
- Use descriptive variable and function names
- Add comments for complex logic

### Adding New Screens
1. Create file in `app/` directory
2. Follow Expo Router naming conventions
3. Use existing screens as reference

### Adding New API Endpoints
1. Add endpoint to `config/api-config.ts`
2. Add API function to `services/api/api-client.ts`
3. Use in components

### Adding New Socket Events
1. Add event name to `config/socket-config.ts`
2. Add listener to `services/socket/socket-client.ts`
3. Use in components

## 🚢 Deployment

### Build for Android
```bash
eas build --platform android
```

### Build for iOS
```bash
eas build --platform ios
```

### Build for Web
```bash
npx expo start --web
```

## 📝 Environment Variables

The app uses hardcoded URLs in development:
- API_BASE_URL: `http://localhost:3000/api`
- SOCKET_URL: `http://localhost:3001`

For production, update these in:
- `config/api-config.ts`
- `config/socket-config.ts`

## 🐛 Troubleshooting

### Common Issues

**Metro bundler not starting:**
```bash
npx expo start --clear
```

**Dependencies not installing:**
```bash
rm -rf node_modules
npm install
```

**TypeScript errors:**
```bash
npm run lint
```

**Build fails:**
```bash
eas build --platform android --profile production
```

## 📚 Documentation

- [STRUCTURE.md](./STRUCTURE.md) - Detailed file structure documentation
- [Expo Documentation](https://docs.expo.dev/)
- [React Native Documentation](https://reactnative.dev/)
- [Expo Router Documentation](https://docs.expo.dev/router/)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License.

## 👥 Team

Drive.ly Development Team

## 📞 Support

For support, email support@drively.africa or join our Discord community.

---

**Built with ❤️ for Africa**

