# K8s Smart Bot Frontend

A modern, production-ready React application for the Kubernetes Smart Bot interface.

## Features

- 🎨 **Kubernetes-themed Design** - Custom color scheme and animations inspired by K8s
- 🔐 **Authentication System** - Secure login with role-based access control
- 👥 **Admin Dashboard** - Full user management and system monitoring
- 👤 **User Dashboard** - Personalized interface with chat coming soon
- 📱 **Responsive Design** - Works seamlessly on desktop and mobile
- ⚡ **Modern Tech Stack** - React 18, Tailwind CSS, Lucide icons

## Tech Stack

- **Frontend**: React 18 with Hooks
- **Styling**: Tailwind CSS with custom K8s theme
- **Routing**: React Router v6
- **Icons**: Lucide React
- **API**: Axios for backend communication
- **Build**: Create React App

## Getting Started

### Prerequisites
- Node.js 14+ 
- npm or yarn

### Installation

```bash
cd main-app
npm install
```

### Development

```bash
npm start
```

The app will be available at `http://localhost:3000`

### Production Build

```bash
npm run build
```

## Project Structure

```
src/
├── components/          # Reusable UI components
├── pages/             # Page components
│   ├── LandingPage.js
│   ├── LoginPage.js
│   ├── AdminDashboard.js
│   └── UserDashboard.js
├── services/          # API services
│   ├── authService.js
│   └── apiService.js
├── utils/             # Utility functions
├── assets/            # Static assets
├── App.js             # Main app component
├── index.js           # Entry point
└── index.css          # Global styles
```

## Features Overview

### Landing Page
- Modern hero section with animated K8s logo
- Feature showcase with hover effects
- Call-to-action to login

### Authentication
- Secure login form with validation
- Password visibility toggle
- Default credentials display
- Error handling and loading states

### Admin Dashboard
- **System Overview**: Health monitoring of all components
- **User Management**: CRUD operations, ban/unban functionality
- **Activity Logs**: Real-time system logs with filtering
- **Settings**: Configuration panel (placeholder)

### User Dashboard
- Personalized greeting based on time of day
- Feature preview grid
- Chat interface (under construction)
- Coming soon features showcase

## Kubernetes Theme

The application features a custom Kubernetes-inspired design:

- **Colors**: K8s blue (#326CE5), cyan, dark backgrounds
- **Animations**: Floating logo, pulse effects, smooth transitions
- **Components**: Glass morphism effects, gradient backgrounds
- **Icons**: Lucide React with consistent styling

## API Integration

The frontend connects to your Flask backend at `http://localhost:5000` by default. You can configure this using the `REACT_APP_API_URL` environment variable.

### Environment Variables

```bash
REACT_APP_API_URL=http://localhost:5000
```

## Security Features

- JWT-based authentication
- Role-based access control
- Secure API communication
- Input validation and sanitization
- XSS protection

## Responsive Design

- Mobile-first approach
- Flexible grid layouts
- Touch-friendly interactions
- Optimized for all screen sizes

## Future Enhancements

- [ ] Real-time chat interface
- [ ] WebSocket integration
- [ ] Advanced admin controls
- [ ] User preferences
- [ ] Multi-language support
- [ ] Dark/light theme toggle
- [ ] Advanced analytics dashboard