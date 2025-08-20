# DevConnect Backend

A Node.js + Express + MongoDB backend for the DevConnect application.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create a `.env` file in the root directory with:
```
MONGODB_URI=mongodb://localhost:27017/devconnect
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
PORT=5000
```

3. Make sure MongoDB is running locally or update the MONGODB_URI

4. Run the development server:
```bash
npm run dev
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register a new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/me` - Get current user (protected)

### Posts
- `POST /api/posts/create` - Create a new post (protected)
- `GET /api/posts/feed` - Get all posts with user info
- `GET /api/posts/user/:userId` - Get posts by specific user

## Models

### User
- name (required)
- email (required, unique)
- password (required, min 6 chars)
- bio (optional)
- skills (array of strings)

### Post
- userId (reference to User)
- content (required)
- timestamp (auto-generated)
