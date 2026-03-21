# Meet Clone Backend

Backend service for a real-time video meeting application (Google Meet clone)

## Tech Stack

* Node.js
* Express.js
* MongoDB (Mongoose)
* JWT Authentication
* TypeScript

## Features

* User Registration & Login
* Password hashing (bcrypt)
* JWT Authentication & Protected Routes
* Create Meeting
* Join Meeting
* Participant Management

## API Endpoints

### Auth

* POST /api/auth/register
* POST /api/auth/login

### Meetings

* POST /api/meetings/create
* POST /api/meetings/join

## Setup

```bash
npm install
npm run dev
```

## Environment Variables

Create a `.env` file:

```env
PORT=5000
MONGO_URI=your_mongodb_connection
JWT_SECRET=your_secret
```
