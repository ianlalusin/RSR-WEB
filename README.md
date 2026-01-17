# RSR Web Application

RSR Web is a comprehensive, responsive, and PWA-ready web application designed for barangay and coordinator management, activity tracking, and financial oversight. Built with a modern tech stack, it prioritizes performance, security, and a seamless user experience.

## Tech Stack

- **Framework**: [Next.js](https://nextjs.org/) (App Router)
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **UI Components**: [shadcn/ui](https://ui.shadcn.com/)
- **Backend**: [Firebase](https://firebase.google.com/) (Authentication & Firestore)
- **AI**: [Google Gemini](https://ai.google.dev/) via Genkit

## Key Features

- **Firebase Authentication**: Secure user login with email/password and Google Sign-In.
- **Role-Based Access Control (RBAC)**: Granular permission system with roles like `admin`, `oic`, `district_head`, etc., controlling access to every feature and action.
- **Scoped Data Access**: Data is strictly scoped to a user's assigned district or barangay, ensuring data privacy and integrity.
- **Real-time Analytics Dashboard**: A high-performance dashboard displaying key metrics from pre-computed analytics documents, avoiding costly database scans.
- **Barangay & Coordinator Management**: Full CRUD capabilities for managing barangays and coordinators, with detailed views and activity logs.
- **AI-Powered Profile Generation**: Utilizes a GenAI model to create realistic, representative resident profiles for barangays based on demographic data.
- **Offline First**: Leverages Firestore's offline persistence to ensure the app is functional even with intermittent network connectivity. Data is served from a local cache first, then synchronized with the server.

## Getting Started

### Prerequisites

- Node.js (v18 or later)
- npm, yarn, or pnpm
- A Firebase project

### 1. Clone the repository

```bash
git clone <repository-url>
cd rsr-web-app
```

### 2. Install dependencies

```bash
npm install
```

### 3. Set up Firebase

1.  Go to your [Firebase project console](https://console.firebase.google.com/).
2.  Navigate to **Project settings** > **General**.
3.  Under "Your apps", select the "Web" platform (`</>`).
4.  Copy the `firebaseConfig` object.
5.  Create a `.env.local` file in the root of the project and add your Firebase configuration:

    ```env
    NEXT_PUBLIC_FIREBASE_API_KEY=your-api-key
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-auth-domain
    NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-storage-bucket
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your-messaging-sender-id
    NEXT_PUBLIC_FIREBASE_APP_ID=your-app-id
    ```

### 4. Run the development server

```bash
npm run dev
```

The application will be available at `http://localhost:3000`.

### 5. First-time Admin User Setup

1.  Sign up for a new account using the login page.
2.  Go to your Firebase Console > Firestore Database.
3.  Find your user document in the `users` collection (the document ID will be your Firebase UID).
4.  Manually edit the document:
    - Set the `isActive` field to `true`.
    - Add `'admin'` to the `roles` array.

You can now log in as an administrator with full privileges.

## Firestore Data Structure & Indexes

The application is designed for performance by minimizing database queries. Dashboards and summary views rely on pre-computed aggregate documents.

### Key Collections

- `users/{uid}`
- `barangays/{brgyId}`
- `coordinators/{coordId}`
- `analytics/global`
- `analytics/byDistrict/{districtId}`
- `analytics/byBrgy/{brgyId}`

### Recommended Firestore Indexes

To ensure query performance, create the following composite indexes in Firestore:

- **`assistanceRecords`**:
  - `(brgyId, sector, eventDate DESC)`
- **`coordinatorReports`**:
  - `(coordinatorId, createdAt DESC)`
- **`congActivityLogs`**:
  - `(brgyId, eventDate DESC)`
- **`expenses`**:
  - `(departmentId, status, expenseDate DESC)`

## Analytics Strategy

Analytics documents (e.g., `analytics/global`) are intended to be updated via Firebase Cloud Functions that trigger on writes to primary data collections (`assistanceRecords`, `expenses`, etc.). This keeps dashboards fast and read-costs low. You will need to implement these functions in your Firebase project.
