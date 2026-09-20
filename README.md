# Framehouse

Framehouse is a full-stack event photo gallery platform for studios, teams, and clients. It helps you manage events, upload photos, curate client galleries, and publish private galleries with a PIN-protected access flow.

This repo contains:
- a Vite + React frontend
- an Express + Prisma + MongoDB backend
- image handling and gallery publishing workflows
- a client-facing public gallery experience with PIN verification
- local development without Docker

---

## Overview

The product is designed around a real photography workflow:
1. Admins create and manage events.
2. Team members upload photos for an event.
3. Photos are reviewed and selected for a gallery.
4. A private gallery is published with a unique slug and PIN.
5. Clients open the public gallery, verify the PIN, and browse approved images.

The app supports both internal studio usage and a polished client sharing flow.

---

## Features

### Studio/admin workflow
- create and manage events
- assign staff and team members to events
- upload and review event photos
- select highlights for a client gallery
- publish a gallery with a PIN
- allow or disable downloads
- manage gallery visibility and access

### Team member workflow
- sign in to the studio app
- see assigned events
- upload photos for event work
- review image readiness and event status

### Client/public workflow
- open a gallery via a unique slug
- enter a 6-digit PIN to unlock access
- browse gallery photos
- favorite images during the session
- download approved images when enabled

---

## Tech stack

### Frontend
- React
- Vite
- React Router
- TanStack React Query
- CSS modules and custom styling

### Backend
- Node.js
- Express
- Prisma ORM
- MongoDB
- JWT auth
- Zod validation
- rate limiting and CORS protections

### Media and storage
- Sharp for image processing
- AWS S3-compatible storage support
- local storage fallback when cloud storage is not configured

---

## Project structure

```text
.
├── client/                  # Vite React frontend
│   ├── src/
│   ├── package.json
│   ├── vite.config.js
│   └── vercel.json
├── server/                 # Express + Prisma API
│   ├── src/
│   ├── prisma/
│   ├── tests/
│   ├── package.json
│   └── jest.config.js
├── package.json            # repo-level build shim
├── vercel.json             # Vercel routing config
├── README.md
└── storage/                # local storage data or runtime files
```

---

## Local development setup

This project is configured to run without Docker.

### 1) Install dependencies

```bash
cd server
npm install

cd ../client
npm install
```

### 2) Start MongoDB

This project expects MongoDB to run locally with a replica set for Prisma transactions.

A standard local setup is:

```bash
docker run -d --name framehouse-mongo -p 27017:27017 mongo:7.0 --replSet rs0
docker exec -it framehouse-mongo mongosh --eval "rs.initiate({_id:'rs0',members:[{_id:0,host:'localhost:27017'}]})"
```

If you already have MongoDB running locally, use that instead as long as it supports the replica set requirement.

### 3) Configure environment variables

Create a .env file in the server folder.

```env
NODE_ENV=development
PORT=5000
CLIENT_URL=http://localhost:5173
SERVER_URL=http://localhost:5000
DATABASE_URL="mongodb://127.0.0.1:27017/event_photo_gallery?replicaSet=rs0&directConnection=true"
JWT_SECRET=change_this_to_a_long_secure_secret
JWT_EXPIRES_IN=7d
GALLERY_SESSION_SECRET=change_this_to_a_secure_secret
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_S3_BUCKET=
MAX_FILE_SIZE=52428800
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX=100
PIN_RATE_LIMIT_MAX=5
```

Create a .env file in the client folder if needed:

```env
VITE_SERVER_URL=http://localhost:5000
VITE_PUBLIC_SITE_URL=http://localhost:5173
```

> If AWS credentials are not provided, the app can still run using the fallback local storage behavior for development and testing.

### 4) Initialize Prisma and seed demo data

```bash
cd server
npx prisma generate
npx prisma db push
npm run db:seed
```

### 5) Run the app

Terminal 1:

```bash
cd server
npm run dev
```

Terminal 2:

```bash
cd client
npm run dev
```

The frontend should run on:
- http://localhost:5173

The backend should run on:
- http://localhost:5000

---

## Demo accounts

The app includes seeded demo data for testing.

### Admin account
- Email: admin@framehouse.com
- Password: Admin@123456

### Team member account
- Email: photographer@framehouse.com
- Password: Member@123456

### Demo public galleries
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

### Server

```bash
cd server
npm run dev
npm test
npm run db:push
npm run db:generate
npm run db:seed
```

### Client

```bash
cd client
npm run dev
npm run build
npm run test
npm run test:e2e
```

---

## Production deployment notes

The app is designed to be deployed as a two-part system:
- frontend: Vercel or similar static hosting
- backend: Render, Railway, Fly.io, or another Node service
- database: MongoDB Atlas or another managed MongoDB instance
- storage: AWS S3 or an S3-compatible bucket

Recommended environment values for production:
- JWT_SECRET
- GALLERY_SESSION_SECRET
- DATABASE_URL
- VITE_SERVER_URL
- VITE_PUBLIC_SITE_URL

The frontend should use the public site URL, not localhost, when generating client gallery links.

---

## Important architecture notes

- The frontend is a client-side app and uses the backend API for gallery data and auth.
- Public gallery routes are handled through the React app and are intended to work in production with SPA rewrites enabled.
- The backend serves gallery and auth endpoints, while the frontend renders the public gallery experience.
- The app is intentionally split so the studio dashboard and client gallery can be hosted and scaled independently.

---

## Troubleshooting

### MongoDB connection issues
- confirm MongoDB is online
- verify the replica set is configured correctly
- confirm the DATABASE_URL includes the required replica set connection settings

### Frontend cannot reach the API
- check VITE_SERVER_URL
- confirm the backend is running
- ensure CORS allows the frontend origin

### Public gallery is not loading
- verify the gallery slug exists in the database
- confirm the gallery is published
- check the PIN and gallery session logic
- verify the frontend is deployed with rewrite rules for SPA routing

### Local upload or storage issues
- confirm AWS credentials or storage settings are valid
- verify the server can write to the configured storage destination

---

## Summary

Framehouse is a practical event-photo gallery system that lets studios manage events, curate highlights, and share secure photo galleries with clients. It is built for real-world photography workflows, while keeping the setup simple enough for local development and production deployment.

This project does not rely on Docker for normal local usage, which keeps the setup lighter and easier to manage.

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