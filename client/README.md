# DevConnect Frontend

A React + TailwindCSS frontend for the DevConnect application.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Make sure the backend server is running on port 5000

3. Start the development server:
```bash
npm start
```

The app will open at [http://localhost:3000](http://localhost:3000).

## Features

- **Authentication**: User registration and login with JWT
- **Feed**: View and create posts from all users
- **Profile**: View your profile and posts
- **Responsive Design**: Modern UI with TailwindCSS

## Pages

- `/login` - User login
- `/register` - User registration
- `/feed` - Main feed with posts (requires auth)
- `/profile` - User profile (requires auth)

## Components

- `Navbar` - Navigation with authentication state
- `PostCard` - Individual post display
- `NewPostForm` - Form to create new posts
- `Login/Register` - Authentication forms

## Tech Stack

- React 18
- React Router DOM
- TailwindCSS
- Axios for API calls
- Context API for state management
