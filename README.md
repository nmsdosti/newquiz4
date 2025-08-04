# Quiz Master App

A real-time quiz platform where users can create quizzes, host live game sessions, and participants can join using game codes to compete against each other.

## Features

- User authentication with email verification using Supabase
- Quiz creation dashboard with multiple-choice questions, timers, and point systems
- Real-time game hosting functionality
- Mobile-responsive participant interface with colorful answer buttons
- Live leaderboard system

## Tech Stack

- React with TypeScript
- Vite for fast development and building
- Supabase for authentication and database
- Tailwind CSS for styling
- React Router for navigation
- Framer Motion for animations

## Getting Started

### Prerequisites

- Node.js (v16 or higher)
- npm or yarn

### Installation

1. Clone the repository
   ```bash
   git clone https://github.com/yourusername/quiz-master-app.git
   cd quiz-master-app
   ```

2. Install dependencies
   ```bash
   npm install
   # or
   yarn
   ```

3. Set up environment variables
   Create a `.env` file in the root directory with the following variables:
   ```
   VITE_SUPABASE_URL=your_supabase_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

4. Start the development server
   ```bash
   npm run dev
   # or
   yarn dev
   ```

## Deployment

To build the app for production:

```bash
npm run build
# or
yarn build
```

## License

This project is licensed under the MIT License - see the LICENSE file for details.
