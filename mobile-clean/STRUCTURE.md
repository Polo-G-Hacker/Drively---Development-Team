# Drive.ly Mobile App - File Structure Documentation

This document provides a comprehensive overview of the Drive.ly mobile app file structure, designed to make the codebase easy to understand and navigate.

## 📁 Root Directory Structure

```
mobile-clean/
├── app/                    # Expo Router file-based routing
├── assets/                 # Static assets (images, fonts, icons)
├── components/             # Reusable UI components
├── config/                 # Configuration files
├── constants/              # App constants
├── contexts/               # React Context providers
├── hooks/                  # Custom React hooks
├── services/               # External service integrations
│   ├── api/               # API client and endpoints
│   └── socket/            # Socket.IO client
├── types/                  # TypeScript type definitions
├── utils/                  # Utility functions
├── .expo/                  # Expo generated files
├── .git/                   # Git repository
├── .vscode/                # VS Code settings
├── app.json                # Expo app configuration
├── package.json            # Dependencies and scripts
├── tsconfig.json           # TypeScript configuration
└── README.md               # Project documentation
```

## 📂 Detailed Directory Breakdown

### `/app` - Expo Router Screens
**Purpose**: File-based routing for the application using Expo Router.

```
app/
├── (tabs)/                # Tab navigation group
│   ├── _layout.tsx        # Tab navigator configuration
│   ├── index.tsx          # Home screen (ride booking)
│   ├── communities.tsx    # Community routes screen
│   └── profile.tsx       # User profile screen
├── _layout.tsx            # Root layout with providers
├── index.tsx             # Splash screen (entry point)
├── login.tsx             # Login/Register screen
└── modal.tsx             # Modal screen
```

**Key Files**:
- `_layout.tsx` - Wraps app with AuthProvider and ThemeProvider
- `index.tsx` - Splash screen that redirects based on auth state
- `login.tsx` - Authentication screen for login and registration
- `(tabs)/index.tsx` - Main home screen with map and ride booking
- `(tabs)/communities.tsx` - Community routes management
- `(tabs)/profile.tsx` - User profile and settings

### `/config` - Configuration Files
**Purpose**: Centralized configuration for API, Socket, and app settings.

```
config/
├── api-config.ts         # API endpoints and base URL configuration
└── socket-config.ts      # Socket.IO configuration and event names
```

**Key Files**:
- `api-config.ts` - Contains `API_CONFIG` (base URL, timeout) and `API_ENDPOINTS` (all API routes)
- `socket-config.ts` - Contains `SOCKET_CONFIG` (connection settings) and `SOCKET_EVENTS` (event names)

**Usage Example**:
```typescript
import { API_CONFIG, API_ENDPOINTS } from '../config/api-config';
import { SOCKET_CONFIG, SOCKET_EVENTS } from '../config/socket-config';

// Use API endpoints
const response = await fetch(`${API_CONFIG.BASE_URL}${API_ENDPOINTS.AUTH.LOGIN}`);

// Use socket events
socket.on(SOCKET_EVENTS.RIDE_AVAILABLE, handleRideAvailable);
```

### `/contexts` - React Context Providers
**Purpose**: Global state management using React Context API.

```
contexts/
└── auth-context.tsx      # Authentication context and provider
```

**Key Files**:
- `auth-context.tsx` - Manages user authentication state, login, register, logout

**Usage Example**:
```typescript
import { useAuth } from '../contexts/auth-context';

const { user, token, login, logout } = useAuth();
```

### `/services` - External Service Integrations
**Purpose**: Communication with external services (API, Socket.IO).

```
services/
├── api/
│   └── api-client.ts    # HTTP client for API calls
└── socket/
    └── socket-client.ts # Socket.IO client for real-time communication
```

**Key Files**:
- `api/api-client.ts` - Contains `apiCall` helper and grouped API functions (authAPI, rideAPI, driverAPI, passengerAPI, paymentAPI)
- `socket/socket-client.ts` - Contains socket initialization, event listeners for passengers and drivers

**Usage Example**:
```typescript
import { authAPI, rideAPI } from '../services/api/api-client';
import { initializeSocket, listenForRideUpdates } from '../services/socket/socket-client';

// API calls
const result = await authAPI.login(phoneNumber, password);
const rides = await rideAPI.searchRides(params);

// Socket events
initializeSocket(token);
listenForRideUpdates({
  onRideAvailable: (data) => console.log(data),
  onRideAccepted: (data) => console.log(data),
});
```

### `/types` - TypeScript Type Definitions
**Purpose**: Centralized TypeScript type definitions for type safety.

```
types/
└── index.ts              # All type definitions
```

**Key Types**:
- `User` - User interface with role, rating, wallet
- `DriverProfile` - Driver-specific information
- `Ride` - Ride details and status
- `RideMatch` - Matched ride information
- `Location` - Geographic coordinates
- `Community` - Community route information
- `Transaction` - Payment transaction
- `ApiResponse<T>` - Generic API response wrapper
- `AuthResponse` - Authentication response

**Usage Example**:
```typescript
import type { User, Ride, Location } from '../types';

const user: User = { id: '1', name: 'John', phoneNumber: '+237...', role: 'passenger' };
const location: Location = { latitude: 3.848, longitude: 11.502 };
```

### `/components` - Reusable UI Components
**Purpose**: Reusable React Native components.

```
components/
├── ui/                   # UI component library
│   └── icon-symbol.tsx  # Icon component
├── external-link.tsx    # External link component
├── haptic-tab.tsx       # Haptic feedback tab component
├── hello-wave.tsx       # Animated wave component
├── parallax-scroll-view.tsx  # Parallax scroll view
├── themed-text.tsx      # Themed text component
└── themed-view.tsx      # Themed view component
```

### `/constants` - App Constants
**Purpose**: Application-wide constants.

```
constants/
└── theme.ts             # Color themes and styling constants
```

### `/hooks` - Custom React Hooks
**Purpose**: Custom React hooks for reusable logic.

```
hooks/
├── use-color-scheme.ts  # Color scheme hook
└── [other hooks]
```

### `/utils` - Utility Functions
**Purpose**: Helper functions and utilities.

```
utils/
└── [utility files]
```

## 🔄 Data Flow

### Authentication Flow
1. User opens app → `app/index.tsx` (Splash Screen)
2. Splash checks auth state via `contexts/auth-context.tsx`
3. If authenticated → Navigate to `app/(tabs)/index.tsx`
4. If not authenticated → Navigate to `app/login.tsx`
5. Login/Register → Calls `authAPI` from `services/api/api-client.ts`
6. Success → Update context and navigate to tabs

### API Communication Flow
1. Component calls API function (e.g., `rideAPI.searchRides`)
2. API function uses `apiCall` helper from `services/api/api-client.ts`
3. `apiCall` uses endpoints from `config/api-config.ts`
4. Request sent to backend with auth token
5. Response returned to component

### Socket Communication Flow
1. Component calls `initializeSocket(token)` from `services/socket/socket-client.ts`
2. Socket connects using config from `config/socket-config.ts`
3. Component registers event listeners (e.g., `listenForRideUpdates`)
4. Server emits events using constants from `SOCKET_EVENTS`
5. Component callbacks are triggered

## 🎯 File Naming Conventions

- **Screens**: `kebab-case.tsx` (e.g., `auth-context.tsx`, `api-client.ts`)
- **Components**: `kebab-case.tsx` (e.g., `haptic-tab.tsx`)
- **Config**: `kebab-case.ts` (e.g., `api-config.ts`)
- **Types**: `index.ts` (centralized in one file)
- **Hooks**: `kebab-case.ts` (e.g., `use-color-scheme.ts`)

## 🔍 Finding Code

### Need to change API endpoints?
→ Edit `config/api-config.ts`

### Need to change Socket events?
→ Edit `config/socket-config.ts`

### Need to add a new API call?
→ Add to `services/api/api-client.ts`

### Need to add a new Socket listener?
→ Add to `services/socket/socket-client.ts`

### Need to modify authentication logic?
→ Edit `contexts/auth-context.tsx`

### Need to add a new type?
→ Add to `types/index.ts`

### Need to add a new screen?
→ Create in `app/` directory following Expo Router conventions

### Need to add a new tab?
→ Create in `app/(tabs)/` directory and update `app/(tabs)/_layout.tsx`

## 📝 Best Practices

1. **Import paths**: Use relative imports for files within the project
   ```typescript
   import { useAuth } from '../contexts/auth-context';
   import { API_CONFIG } from '../config/api-config';
   ```

2. **Type safety**: Always import types from `types/index.ts`
   ```typescript
   import type { User, Ride } from '../types';
   ```

3. **Configuration**: Never hardcode URLs or endpoints, use config files
   ```typescript
   // ❌ Bad
   const url = 'http://localhost:3000/api/auth/login';
   
   // ✅ Good
   const url = `${API_CONFIG.BASE_URL}${API_ENDPOINTS.AUTH.LOGIN}`;
   ```

4. **Context**: Use context for global state (auth, theme, etc.)
   ```typescript
   const { user, login } = useAuth();
   ```

5. **Services**: Keep business logic in service files, not in components
   ```typescript
   // ❌ Bad - API call in component
   const response = await fetch('http://localhost:3000/api/rides/search');
   
   // ✅ Good - Use service
   const response = await rideAPI.searchRides(params);
   ```

## 🚀 Quick Reference

| What you need | Where to find it |
|---------------|-----------------|
| Change API base URL | `config/api-config.ts` |
| Add new API endpoint | `config/api-config.ts` + `services/api/api-client.ts` |
| Add new Socket event | `config/socket-config.ts` + `services/socket/socket-client.ts` |
| Modify auth logic | `contexts/auth-context.tsx` |
| Add new type | `types/index.ts` |
| Add new screen | `app/` directory |
| Add new tab | `app/(tabs)/` directory |
| Change app icon | `app.json` |
| Change app name | `app.json` |

---

This structure is designed to be modular, scalable, and easy to navigate. Each folder has a clear purpose, making it simple to locate and modify code when needed.
