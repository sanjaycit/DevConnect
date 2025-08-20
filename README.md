# DevConnect

A full-stack developer networking platform built with Node.js, Express, MongoDB, and React.

## Features

- **User Authentication**: Secure registration and login with JWT
- **Developer Profiles**: Showcase your skills, bio, and experience
- **Social Feed**: Share thoughts, questions, and updates with the community
- **Modern UI**: Beautiful, responsive design with TailwindCSS

## Project Structure

```
DevConnect/
├── backend/          # Node.js + Express + MongoDB API
│   ├── models/      # Mongoose models
│   ├── routes/      # API routes
│   ├── middleware/  # Authentication middleware
│   └── server.js    # Main server file
└── client/          # React frontend
    ├── src/
    │   ├── components/  # Reusable components
    │   ├── pages/       # Page components
    │   ├── context/     # Authentication context
    │   └── App.js       # Main app component
    └── package.json
```

## Quick Start

### Prerequisites

- Node.js (v14 or higher)
- MongoDB (local or cloud instance)
- npm or yarn

### Backend Setup

1. Navigate to the backend directory:
```bash
cd backend
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file with your configuration:
```
MONGODB_URI=mongodb://localhost:27017/devconnect
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
PORT=5000
```

4. Start the development server:
```bash
npm run dev
```

The backend will run on [http://localhost:5000](http://localhost:5000)

### Frontend Setup

1. Navigate to the client directory:
```bash
cd client
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm start
```

The frontend will run on [http://localhost:3000](http://localhost:3000)

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register a new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/me` - Get current user (protected)

### Posts
- `POST /api/posts/create` - Create a new post (protected)
- `GET /api/posts/feed` - Get all posts with user info
- `GET /api/posts/user/:userId` - Get posts by specific user

## Tech Stack

### Backend
- **Node.js** - JavaScript runtime
- **Express** - Web framework
- **MongoDB** - NoSQL database
- **Mongoose** - MongoDB ODM
- **JWT** - Authentication
- **bcryptjs** - Password hashing
- **CORS** - Cross-origin resource sharing

### Frontend
- **React** - UI library
- **React Router** - Client-side routing
- **TailwindCSS** - Utility-first CSS framework
- **Axios** - HTTP client
- **Context API** - State management

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is open source and available under the [MIT License](LICENSE).
