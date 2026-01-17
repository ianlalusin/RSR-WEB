# **App Name**: RSR Web

## Core Features:

- Firebase Authentication: Enable user authentication using Firebase Auth with email/password and Google sign-in options.
- Role-Based Access Control (RBAC): Implement RBAC with roles (admin, oic, auditor, etc.) and permission keys stored in Firestore user documents to control access to features and data. Enforce that both roles and permissions must be valid in order for an action to proceed. Deletion will only be possible if a user is assigned the admin role.
- Scoped Data Access: Limit data access based on user scope (districtIds, coordinatorBrgyIds) defined in their user document. Enforce scope restrictions on all data reads and writes, to ensure that users only see, and can only edit, what they are supposed to. Any time a tool uses reasoning to make a decision about a particular record, its scope shall be included in the tool.
- Dashboard Analytics: Display key metrics (total barangays, coordinators, records, budgets vs expenses) fetched ONLY from precomputed analytics documents in Firestore, never by scanning collections.
- Barangay Management: Enable CRUD operations for barangays, including listing with search/filters, detailed views, and captain profile management.
- Coordinator Management: Enable CRUD operations for coordinators, including listing with search/filters, detail views, and reporting log management. District heads will be able to review coordinator reports.
- Generate barangay profiles: Using a LLM tool, generate realistic, statistically accurate, representative profiles for the residents of each barangay

## Style Guidelines:

- Primary color: Light blue (#ADD8E6), providing a sense of calm and reliability.
- Background color: White (#FFFFFF), creating a clean and minimalist aesthetic.
- Accent color: Dark blue (#00008B), used for interactive elements and important information to provide contrast and highlight key actions. Action buttons are colored red.
- Body and headline font: 'Inter' sans-serif for a modern, clean and readable look.
- Mobile-first responsive design with bottom navigation on mobile and sidebar on desktop.
- Minimalist, flat icons for navigation and data representation.
- Subtle transitions and loading animations to enhance user experience.