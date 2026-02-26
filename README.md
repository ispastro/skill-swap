# SkillSwap

> A production-ready skill exchange marketplace API built with clean architecture principles

[![Live Demo](https://img.shields.io/badge/demo-live-success)](https://skill-swap-lh2l.onrender.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green)](https://nodejs.org/)
[![License](https://img.shields.io/badge/license-ISC-blue.svg)](LICENSE)

## Overview

SkillSwap is an enterprise-grade backend API that powers a skill-exchange marketplace. Users can list skills they teach, request skills they want to learn, find matches using AI-assisted algorithms, negotiate barters, chat in real-time, and leave verified reviews.

**Live API**: https://skill-swap-lh2l.onrender.com/

## Architecture

### Clean Architecture Principles

```
┌─────────────────────────────────────────────────────────┐
│                    Presentation Layer                    │
│              (Routes, Controllers, Middleware)           │
├─────────────────────────────────────────────────────────┤
│                    Application Layer                     │
│              (Business Logic, Use Cases)                 │
├─────────────────────────────────────────────────────────┤
│                    Domain Layer                          │
│              (Entities, Validators, Types)               │
├─────────────────────────────────────────────────────────┤
│                  Infrastructure Layer                    │
│        (Database, Cache, External Services, I/O)         │
└─────────────────────────────────────────────────────────┘
```

### System Architecture

```
┌──────────────┐      ┌──────────────┐      ┌──────────────┐
│   Client     │─────▶│  Node.js API │─────▶│  PostgreSQL  │
│ Application  │      │   (Express)  │      │   (Supabase) │
└──────────────┘      └──────┬───────┘      └──────────────┘
                             │
                    ┌────────┼────────┐
                    │        │        │
              ┌─────▼───┐ ┌──▼────┐ ┌▼────────────┐
              │  Redis  │ │Socket │ │   Python    │
              │(Upstash)│ │  .IO  │ │ML Matching  │
              └─────────┘ └───────┘ └─────────────┘
```

## Core Features

### Authentication & Authorization
- JWT-based authentication with secure token management
- Google OAuth 2.0 integration via Passport.js
- Role-based access control (RBAC)
- Password hashing with bcrypt

### Intelligent Skill Matching
- **Hybrid Matching Engine**: 
  - 50% Skill overlap score
  - 30% Mutual benefit analysis
  - 10% Semantic similarity (ML-powered)
  - 5% Fuzzy text matching
  - 5% Experience level boost
- External Python FastAPI service for ML computations
- Redis caching for optimized performance

### Real-Time Communication
- WebSocket-based chat via Socket.IO
- User presence tracking
- Typing indicators
- Message persistence with PostgreSQL

### Barter & Exchange System
- Proposal creation and negotiation
- Status tracking (PENDING, ACCEPTED, REJECTED, COMPLETED)
- Skill verification workflow
- Review and rating system

### File Management
- Supabase storage integration
- Metadata tracking in PostgreSQL
- Secure upload/download with access control

### Performance & Scalability
- Multi-tier caching strategy (Redis)
- Rate limiting per endpoint
- Database connection pooling
- Horizontal scaling ready

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Runtime** | Node.js 18+ (ES Modules) |
| **Language** | TypeScript 5.9 |
| **Framework** | Express 5 |
| **Database** | PostgreSQL (Supabase) |
| **ORM** | Prisma 6.12 |
| **Cache** | Redis (Upstash) |
| **Real-time** | Socket.IO 4.8 |
| **Storage** | Supabase Storage |
| **Auth** | Passport.js + JWT |
| **ML Service** | Python FastAPI |
| **Testing** | Jest + Supertest |
| **Deployment** | Render |

## Project Structure

```
skillSwap/
├── src/
│   ├── config/              # Configuration files
│   │   ├── db.ts           # Database connection
│   │   ├── passport.ts     # OAuth strategies
│   │   └── redisClient.ts  # Redis client setup
│   ├── controllers/         # Request handlers (Presentation Layer)
│   │   ├── authController.ts
│   │   ├── profileController.ts
│   │   ├── matchController.ts
│   │   ├── chatController.ts
│   │   ├── fileController.ts
│   │   ├── reviewController.ts
│   │   └── notificationController.ts
│   ├── routes/              # API route definitions
│   │   ├── authRoutes.ts
│   │   ├── profileRoutes.ts
│   │   ├── matchRoutes.ts
│   │   ├── chatRoutes.ts
│   │   ├── fileRoutes.ts
│   │   └── reviewRoutes.ts
│   ├── middleware/          # Express middleware
│   │   ├── auth.ts         # JWT verification
│   │   ├── rateLimiter.ts  # Rate limiting
│   │   └── errorHandler.ts # Global error handling
│   ├── validators/          # Input validation (Domain Layer)
│   │   ├── authValidator.ts
│   │   └── profileValidator.ts
│   ├── services/            # Business logic (Application Layer)
│   │   ├── pythonMatchService.ts
│   │   ├── embeddingService.ts
│   │   └── notificationService.ts
│   ├── utils/               # Helper functions
│   │   └── skillSuggestion.ts
│   ├── sockets/             # WebSocket handlers
│   │   └── socketHandler.ts
│   └── server.ts            # Application entry point
├── prisma/
│   ├── schema.prisma        # Database schema
│   ├── migrations/          # Database migrations
│   └── seed.js              # Database seeding
├── test/                    # Test suites
│   ├── unit/
│   ├── integration/
│   └── e2e/
├── scripts/                 # Utility scripts
├── .env                     # Environment variables
├── tsconfig.json            # TypeScript configuration
└── package.json             # Dependencies
```

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- PostgreSQL database (or Supabase account)
- Redis instance (or Upstash account)
- Supabase project (for file storage)
- Google OAuth credentials (optional)

### Installation

1. **Clone the repository**
```bash
git clone https://github.com/ispastro/skill-swap.git
cd skill-swap
```

2. **Install dependencies**
```bash
npm install
```

3. **Configure environment variables**

Create a `.env` file in the project root:

```env
# Database
DATABASE_URL=postgresql://user:password@host:5432/skillswap?sslmode=require
DIRECT_URL=postgresql://user:password@host:5432/skillswap?sslmode=require

# Server
PORT=8000
JWT_SECRET=your_secure_jwt_secret_here

# Redis Cache
UPSTASH_REDIS_REST_URL=https://your-redis-url.upstash.io
UPSTASH_REDIS_REST_TOKEN=your_redis_token

# Supabase Storage
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Google OAuth (Optional)
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_CALLBACK_URL=http://localhost:8000/auth/google/callback
SESSION_SECRET=your_session_secret

# Python Matching Service
PYTHON_MATCH_SERVICE_URL=https://your-python-service.onrender.com
USE_PYTHON_MATCHING=true
```

4. **Run database migrations**
```bash
npx prisma migrate deploy
npx prisma generate
```

5. **Seed the database (optional)**
```bash
node prisma/seed.js
```

6. **Start the development server**
```bash
npm run dev
```

The API will be available at `http://localhost:8000`

### Production Build

```bash
npm run build
npm start
```

## API Documentation

### Base URL
- **Production**: `https://skill-swap-lh2l.onrender.com`
- **Local**: `http://localhost:8000`

### Health Check
```http
GET /
Response: "SkillSwap API is running 🚀"
```

### Authentication Endpoints

#### Register
```http
POST /api/auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "SecurePass123!",
  "name": "John Doe"
}
```

#### Login
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "SecurePass123!"
}

Response: {
  "token": "jwt_token_here",
  "user": { ... }
}
```

#### Google OAuth
```http
GET /auth/google
GET /auth/google/callback
```

### Protected Endpoints (Require JWT)

All protected endpoints require the `Authorization` header:
```http
Authorization: Bearer <your_jwt_token>
```

#### Profile Management
```http
GET    /api/profile              # Get current user profile
PUT    /api/profile/:userId      # Update profile
```

#### Skill Matching
```http
GET    /api/match/matches        # Find matching users
POST   /api/match/verify-skill   # Request skill verification
```

#### Chat System
```http
POST   /api/chats                # Create new chat
GET    /api/chats/:userId        # List user's chats
GET    /api/chats/:chatId/messages  # Get chat messages
POST   /api/chats/:chatId/messages  # Send message
```

#### File Management
```http
POST   /api/files/upload         # Upload file metadata
GET    /api/files                # List user files
GET    /api/files/:id/download   # Download file
DELETE /api/files/:id            # Delete file
```

#### Reviews
```http
POST   /api/reviews              # Create review
GET    /api/reviews/:userId      # Get user reviews
```

#### Notifications
```http
GET    /api/notifications        # Get user notifications
POST   /api/notifications/send   # Send notification
PUT    /api/notifications/:id/read  # Mark as read
```

## Testing

### Run All Tests
```bash
npm test
```

### Test Coverage
- **Unit Tests**: Controllers, services, utilities
- **Integration Tests**: API endpoints, database operations
- **E2E Tests**: Complete user journeys

### Load Testing
```bash
npm install -g artillery
artillery run test/load-test.yml
```

## Rate Limits

| Endpoint | Limit |
|----------|-------|
| General API | 100 requests / 15 min |
| Authentication | 50 requests / 15 min |
| Chat Messages | 50 messages / min |
| Reviews | 10 reviews / day |

## Caching Strategy

| Resource | TTL | Strategy |
|----------|-----|----------|
| User Matches | 30 min | Cache-aside |
| Pair Scores | 1 hour | Write-through |
| Chat Messages | 5 min | Cache-aside |
| User Presence | 5 min | Write-through |

## Database Schema

### Core Entities
- **User**: Authentication, profile, skills
- **Skill**: Skill taxonomy and metadata
- **SkillExchange**: Barter transactions
- **BarterProposal**: Negotiation workflow
- **Chat**: Conversation threads
- **Message**: Chat messages
- **Review**: User ratings and feedback
- **Notification**: System notifications
- **File**: File metadata

### Relationships
```
User ──< SkillExchange >── User
User ──< BarterProposal >── User
User ──< Chat >── User
Chat ──< Message
User ──< Review >── User
User ──< Notification
User ──< File
```

## Deployment

### Render Deployment

1. **Create Web Service** on Render
2. **Connect GitHub repository**
3. **Configure Build Settings**:
   - Build Command: `npm install && npx prisma generate && npx prisma migrate deploy`
   - Start Command: `npm start`
4. **Add Environment Variables** (see `.env` example)
5. **Deploy**

### Environment Variables Checklist
- [ ] DATABASE_URL
- [ ] DIRECT_URL
- [ ] JWT_SECRET
- [ ] UPSTASH_REDIS_REST_URL
- [ ] UPSTASH_REDIS_REST_TOKEN
- [ ] SUPABASE_URL
- [ ] SUPABASE_SERVICE_ROLE_KEY
- [ ] PYTHON_MATCH_SERVICE_URL
- [ ] GOOGLE_CLIENT_ID (optional)
- [ ] GOOGLE_CLIENT_SECRET (optional)
- [ ] GOOGLE_CALLBACK_URL (optional)

## Performance Metrics

- **Response Time**: ~391ms average
- **Throughput**: 5 req/sec sustained
- **Concurrent Users**: 90+ tested
- **Success Rate**: 100% under load
- **Database Connections**: Pooled (max 10)

## Security Features

- JWT token authentication with expiration
- Password hashing with bcrypt (10 rounds)
- SQL injection prevention via Prisma ORM
- XSS protection with Helmet.js
- CORS configuration
- Rate limiting per endpoint
- Input validation and sanitization
- Environment variable encryption

## Monitoring & Logging

- Winston logger for structured logging
- Error tracking and stack traces
- Request/response logging
- Performance metrics
- Database query logging

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feat/your-feature`
3. Commit changes: `git commit -m 'Add feature'`
4. Push to branch: `git push origin feat/your-feature`
5. Open a Pull Request

### Code Style
- Follow TypeScript best practices
- Use ES modules syntax
- Write tests for new features
- Document complex logic
- Run `npm test` before committing

## Roadmap

- [ ] GraphQL API layer
- [ ] Advanced analytics dashboard
- [ ] Mobile app integration
- [ ] Video call integration
- [ ] Payment gateway integration
- [ ] Multi-language support
- [ ] Advanced ML recommendations
- [ ] Blockchain skill verification

## License

This project is licensed under the ISC License.

## Support

- **Documentation**: [GitHub Wiki](https://github.com/ispastro/skill-swap/wiki)
- **Issues**: [GitHub Issues](https://github.com/ispastro/skill-swap/issues)
- **Email**: support@skillswap.com

## Acknowledgments

- Built with modern TypeScript and Node.js
- Powered by Prisma ORM and PostgreSQL
- Real-time features via Socket.IO
- ML matching with Python FastAPI
- Deployed on Render

---

**Made with ❤️ by the SkillSwap Team**
