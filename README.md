# Framehouse

Framehouse is a full-stack event photo workflow for studios, photographers, and clients. It gives teams a single place to manage events, upload raw images, curate galleries, and share a private client-facing gallery protected by a PIN.

This project is set up as a real application with:
- a React + Vite front end
- an Express + Prisma + MongoDB back end
- AWS S3-compatible storage with a local mock fallback
- Sharp-based image processing for thumbnails and gallery variants
- Docker Compose support for local development

---

## Overview

The app is designed for modern photo studios and event teams that need to:
- manage multiple events and team assignments
- upload and organize a large number of images
- present selected shots in a polished client gallery
- keep gallery access private using a PIN and cookie-based session
- allow clients to favorite and download approved images

The workflow is intentionally simple:
1. A studio admin creates an event and assigns team members.
2. Photographers upload images to the project.
3. The backend processes the files and stores optimized variants.
4. A gallery is created, curated, and published.
5. Clients open a public gallery, verify a PIN, and browse/download approved photos.

---

## Key features

### Studio/admin side
- create and manage events
- assign photographers to specific events
- view dashboard metrics and recent activity
- upload photo batches for an event
- curate selected images into a client gallery
- publish a gallery with PIN protection and download controls
- view analytics on published galleries

### Team member side
- sign in with a staff account
- view assigned events only
- upload images for event projects
- monitor image readiness and gallery status

### Client/public side
- access a gallery by unique slug
- enter a 6-digit PIN to unlock the gallery
- browse approved photos in a simple gallery experience
- favorite images during the session
- download images if the admin has enabled downloads

---

## Tech stack

### Frontend
- React 18
- Vite
- React Router
- TanStack React Query
- CSS custom styling
- Lucide icons

### Backend
- Node.js
- Express
- Prisma ORM
- MongoDB
- Zod validation
- JWT auth and gallery session handling
- Helmet, CORS, rate limiting

### Media and storage
- Sharp for image resizing and generation
- AWS S3 support via AWS SDK
- local mock storage fallback when AWS credentials are not configured

---

## Project structure

```text
.
├── client/                  # React client app
│   ├── src/
│   ├── package.json
│   ├── .env.example
│   └── vite.config.js
├── server/                 # Express + Prisma API
│   ├── src/
│   ├── prisma/
│   ├── tests/
│   ├── package.json
│   ├── .env.example
│   └── jest.config.js
├── docker/                 # Mongo init and container support
├── docker-compose.yml      # local full-stack setup
├── README.md
└── package.json            # repo root (if present in your checkout)
```

---

## Local development

### Option 1: Docker (recommended)

1. Copy environment files:

```bash
copy server\.env.example server\.env
copy client\.env.example client\.env
```

2. Start the app:

```bash
docker compose up --build
```

3. Seed demo data:

```bash
docker compose run --rm server npm run db:seed
```

4. Open:
- Frontend: http://localhost:5173
- Backend: http://localhost:5000/health

The Docker setup launches:
- MongoDB replica set on port 27017
- Express API on port 5000
- Vite dev server on port 5173

---

### Option 2: Manual local setup

#### 1) Install dependencies

```bash
cd server
npm install

cd ../client
npm install
```

#### 2) Set up MongoDB as a replica set

This project uses Prisma with MongoDB, and the app expects a replica set for transactions.

The simplest local setup is:

```bash
docker run -d --name mongo-replica -p 27017:27017 mongo:7.0 --replSet rs0
docker exec -it mongo-replica mongosh --eval "rs.initiate({_id:'rs0',members:[{_id:0,host:'localhost:27017'}]})"
```

#### 3) Configure environment variables

Server .env example:

```env
NODE_ENV=development
PORT=5000
CLIENT_URL=http://localhost:5173
SERVER_URL=http://localhost:5000
DATABASE_URL="mongodb://127.0.0.1:27017/event_photo_gallery?replicaSet=rs0&directConnection=true"
JWT_SECRET=change_this_to_a_long_secure_secret
JWT_EXPIRES_IN=7d
GALLERY_SESSION_SECRET=change_this_to_another_long_secure_secret
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_S3_BUCKET=
MAX_FILE_SIZE=52428800
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX=100
PIN_RATE_LIMIT_MAX=5
```

Client .env example:

```env
VITE_SERVER_URL=http://localhost:5000
```

> If AWS credentials are left blank, the server falls back to built-in mock local storage and still runs for development and testing.

#### 4) Initialize Prisma and seed data

```bash
cd server
npx prisma generate
npx prisma db push
npm run db:seed
```

#### 5) Run the app

```bash
# Terminal 1
cd server
npm run dev

# Terminal 2
cd client
npm run dev
```

---

## Demo accounts and sample galleries

The seeded demo data includes a main admin account and team member accounts.

### Admin
- Email: admin@framehouse.com
- Password: Admin@123456

### Team member
- Email: photographer@framehouse.com
- Password: Member@123456

### Public demo galleries
- Arjun & Priya Royal Wedding
  - slug: /gallery/arjun-priya-wedding-2026
  - PIN: 482917
- Neon Waves Music Festival
  - slug: /gallery/neon-waves-music-festival-2026
  - PIN: 983421
- Metropolis Fashion Gala
  - slug: /gallery/metropolis-fashion-gala-2026
  - PIN: 654321

---

## Available scripts

### Backend

```bash
cd server
npm run dev
npm test
npm run db:push
npm run db:generate
npm run db:seed
```

### Frontend

```bash
cd client
npm run dev
npm run build
npm run test
npm run test:e2e
```

---

## API behavior

The backend exposes routes for:
- auth: login, register, logout, current user
- events: create and manage studio events
- photos: upload-url generation, processing status, metadata
- galleries: create, publish, update, pin management
- public galleries: view gallery information, verify PIN, fetch images
- analytics: gallery and activity stats

The app is designed so that uploads happen directly to storage when possible, reducing server load and speeding up large photo batches.

---

## Production notes

For production, set the environment values to real secrets and deploy the backend and frontend separately. In practice:
- backend: MongoDB Atlas + Render/Railway/Fly.io-style service
- frontend: Vercel or similar static hosting
- object storage: AWS S3 or S3-compatible bucket
- set secure values for `JWT_SECRET`, `GALLERY_SESSION_SECRET`, and database credentials

The app already contains hardened defaults for CORS, cookie handling, rate limiting, and public gallery session management.

---

## Troubleshooting

### MongoDB connection errors
- ensure MongoDB is running with a replica set
- confirm `DATABASE_URL` includes `replicaSet=rs0` in local development

### Frontend cannot reach API
- verify `VITE_SERVER_URL` matches your backend origin
- check that backend CORS allows your frontend origin

### Gallery PIN not working
- confirm the gallery exists and is published
- verify the database has been seeded
- confirm the `pinHash` is created during gallery creation

### Local uploads not processing
- check that the server has valid S3 credentials or that the mock storage fallback is enabled
- confirm the app is pointing to the correct environment variables

---

## License

This project is currently intended for internal studio or demo use. Add an explicit license file if you plan to distribute it publicly.

---

## Summary

Framehouse is a practical event-photo gallery platform built around the real workflow photographers and studios use: organize events, upload media, curate the best images, and share them with clients through a secure, polished gallery experience.

If you want, the next step can be to add:
- a deployment section for Render + Vercel
- a more detailed API route list
- screenshots or architecture diagrams
- optional CI/CD setup instructions
- `POST /api/events` — Create a new event shoot *(Admin only)*.
- `GET /api/events/:id` — Get single event details with upload statistics.
- `PUT /api/events/:id` — Update event details *(Admin only)*.
- `DELETE /api/events/:id` — Delete event and related photos *(Admin only)*.
- `GET /api/events/team-members` — Search all studio photographers for assignment.
- `GET /api/events/:id/members` — List photographers assigned to an event.
- `POST /api/events/:id/members` — Assign a photographer to an event *(Admin only)*.
- `DELETE /api/events/:id/members/:userId` — Remove photographer assignment *(Admin only)*.

### Photo Ingestion & Processing
- `GET /api/events/:id/photos` — Fetch photos for an event with short-lived presigned thumbnail URLs.
- `POST /api/events/:id/photos/upload-url` — Request presigned S3 PUT URL for direct upload.
- `POST /api/events/:id/photos/complete` — Notify server of upload completion; triggers Sharp processing.
- `POST /api/events/:id/photos/bulk-select` — Bulk select / deselect photos for gallery inclusion.
- `DELETE /api/photos/:id` — Soft-delete photo and remove variants from storage.

### Galleries & Publishing
- `POST /api/events/:id/galleries` — Create a new draft gallery with a 6-digit PIN *(Admin only)*.
- `POST /api/galleries/:id/photos` — Add selected photos to a gallery *(Admin only)*.
- `POST /api/galleries/:id/publish` — Publish gallery to make it accessible to clients *(Admin only)*.
- `POST /api/galleries/:id/pin` — Rotate gallery PIN and revoke existing sessions *(Admin only)*.
- `GET /api/galleries/:id/analytics` — View visitor metrics, total views, and download counts.

### Public Client Portal (Guest Access)
- `GET /api/public/gallery/:slug` — Retrieve public gallery metadata (title, date, cover, PIN status).
- `POST /api/public/gallery/:slug/verify-pin` — Verify 6-digit PIN and receive signed session cookie.
- `GET /api/public/gallery/:slug/photos` — Retrieve list of photos with signed preview URLs *(Session required)*.
- `POST /api/public/gallery/:slug/photos/:photoId/download` — Obtain presigned high-res download URL.
- `POST /api/public/gallery/:slug/photos/:photoId/favorite` — Toggle photo favorite status.
- `GET /api/public/gallery/:slug/favorites` — List all favorited photos for the current session.

---

## 🔑 Default Demo Credentials

When you run `npm run db:seed` in the `server` directory, the following test accounts and gallery are created:

| Role | Email | Password | Access Scope |
|---|---|---|---|
| **Studio Admin** | `admin@example.com` | `Admin@123456` | Full workspace control, event creation, team assignments, publishing. |
| **Team Photographer 1** | `photographer@example.com` | `Member@123456` | Upload and view access for assigned events. |
| **Team Photographer 2** | `rahul@example.com` | `Member@123456` | Upload and view access for assigned events. |

### Sample Demo Client Gallery
- **Public URL**: `http://localhost:5173/gallery/arjun-priya-wedding-2026`
- **Access PIN**: `482917`

---

## 🚢 Production Deployment Guide

A recommended production architecture uses **MongoDB Atlas** for the database, **AWS S3** for media storage, **Render** or **Railway** for the Node API, and **Vercel** or **Netlify** for the Vite React frontend.

### 1. MongoDB Atlas Setup

1. Create a cluster on [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) (M0 Free or dedicated). Atlas automatically configures replica sets required by Prisma.
2. In **Database Access**, create a user (e.g. `framehouse_user`) with `readWriteAnyDatabase` privileges.
3. In **Network Access**, add `0.0.0.0/0` (or the static outgoing IP of your backend host).
4. Copy the connection string:
   ```
   mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/event_photo_gallery?retryWrites=true&w=majority
   ```

---

### 2. AWS S3 Bucket & IAM Configuration

1. **Create S3 Bucket**:
   - Bucket name: e.g. `framehouse-media-production`
   - Region: `us-east-1` (or your preferred region)
   - **Keep "Block all public access" ENABLED**. All photo access is controlled through presigned URLs.

2. **Configure CORS on S3 Bucket**:
   In S3 Console > Bucket > **Permissions** > **Cross-origin resource sharing (CORS)**, paste:
   ```json
   [
     {
       "AllowedHeaders": ["*"],
       "AllowedMethods": ["GET", "PUT", "POST", "HEAD"],
       "AllowedOrigins": ["https://your-frontend.vercel.app", "https://yourdomain.com"],
       "ExposeHeaders": ["ETag"]
     }
   ]
   ```

3. **Create IAM User & Security Policy**:
   In AWS IAM, create a user `framehouse-app-user` with programmatic access and attach this inline policy:
   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Effect": "Allow",
         "Action": [
           "s3:PutObject",
           "s3:GetObject",
           "s3:DeleteObject",
           "s3:HeadObject"
         ],
         "Resource": "arn:aws:s3:::framehouse-media-production/*"
       }
     ]
   }
   ```
   Generate and save the **Access Key ID** and **Secret Access Key**.

---

### 3. Backend Deployment (Render / Railway)

1. Connect your repository to Render or Railway as a **Web Service**.
2. Set configuration parameters:
   - **Root Directory**: `server`
   - **Environment**: `Node`
   - **Build Command**: `npm install && npx prisma generate`
   - **Start Command**: `npm start`
3. Add Environment Variables:
   - `NODE_ENV`: `production`
   - `CLIENT_URL`: `https://your-frontend.vercel.app`
   - `SERVER_URL`: `https://your-backend.onrender.com`
   - `DATABASE_URL`: `mongodb+srv://...`
   - `JWT_SECRET`: *(Generate a secure 64-char string)*
   - `GALLERY_SESSION_SECRET`: *(Generate a secure 64-char string)*
   - `AWS_REGION`: `us-east-1`
   - `AWS_ACCESS_KEY_ID`: `AKIA...`
   - `AWS_SECRET_ACCESS_KEY`: `...`
   - `AWS_S3_BUCKET`: `framehouse-media-production`
4. Deploy the service and verify `GET /health` returns `200 OK`.

---

### 4. Frontend Deployment (Vercel / Netlify)

1. Connect the repository to Vercel.
2. Set build settings:
   - **Root Directory**: `client`
   - **Framework Preset**: `Vite`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
3. Set Environment Variable:
   - `VITE_SERVER_URL`: `https://your-backend.onrender.com`
4. Deploy. Verify that cookies are properly set during login and PIN verification (requires HTTPS in production for `secure: true` cookies).

---

## ⚠️ Known Limitations & Roadmap

Like any real-world production engineering system, there are architectural trade-offs in the current version:

### Known Limitations
1. **Synchronous Image Processing on API Thread**: When a photo upload completes, the Express server processes thumbnail/medium/gallery variants in-process using Sharp. For batches of 200+ photos uploaded at once, this can spike CPU on small container instances (e.g. Render free tier).
2. **Batch Downloads Memory Bound**: Downloading all high-resolution photos creates an on-the-fly zip archive stream. If an event has 50GB of raw images, downloading the entire batch in a single request can stress server memory.
3. **No Direct Video Transcoding**: The current pipeline handles raster and raw photograph formats (`image/jpeg`, `image/png`, `image/webp`). Video footage (`.mp4`, `.mov`) is not processed into streaming segments (HLS/DASH).
4. **Single-Region S3 Storage**: Signed URLs point directly to the origin S3 bucket. Without an Amazon CloudFront CDN distribution in front of S3, global clients further from the bucket region may experience higher latency when loading thumbnails.

### Future Roadmap
- [ ] **Background Processing Queue**: Offload Sharp variant generation to BullMQ workers powered by Redis or AWS Lambda S3 triggers.
- [ ] **CloudFront CDN Integration**: Distribute public and signed image requests through Amazon CloudFront edge locations.
- [ ] **Client Face Recognition**: AI-assisted face tagging to allow guests to find all photos containing their face automatically.
- [ ] **Asynchronous ZIP Generation**: Offload full gallery album ZIP builds to an S3-to-S3 background job with presigned download links emailed upon completion.
- [ ] **Watermark Customizer**: Interactive in-browser canvas tool for studio leads to upload transparent PNG logos and position watermarks.

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).