# DCSA Tabulation System

A real-time, web-based pageant and contest tabulation system built with Node.js, Express, SQLite, and Socket.IO. Designed for live events over a local network (LAN) or internet, it supports multi-contest management, weighted judge-voted and admin-scored segments, live podium rankings, real-time monitoring, single-session enforcement, automated PDF/Excel reporting, and full zip backups.

---

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Prerequisites](#prerequisites)
- [Installation & Initial Setup](#installation--initial-setup)
- [Running the Application](#running-the-application)
- [User Roles & Complete Usage Guide](#user-roles--complete-usage-guide)
  - [1. Superadmin: Initial Setup & Users](#1-superadmin-initial-setup--users)
  - [2. Admin: Pre-Event Configuration](#2-admin-pre-event-configuration)
  - [3. Judge: Scoring Workflow](#3-judge-scoring-workflow)
  - [4. Admin: Live Event Control & Monitoring](#4-admin-live-event-control--monitoring)
  - [5. Post-Event: Awards, Reports & Backups](#5-post-event-awards-reports--backups)
- [How Scoring & Tabulation Works](#how-scoring--tabulation-works)
- [Project Structure](#project-structure)
- [Configuration & Security Notes](#configuration--security-notes)

---

## Features

### Real-Time Event Operations
- **Live Tabulation Leaderboard & Podium:** Automatically recalculates scores and broadcasts updates via WebSockets to an animated Top-3 podium and Top-10 leaderboard (`results.html`), with rank-change trend indicators and branch filtering.
- **Real-Time Judging Progress Grid:** Admins can track which judges have locked scores for each candidate in a segment and unlock individual candidate scorecards if a judge needs to make a correction.
- **System Monitoring Dashboard:** Tracks live connected users, server local IP address (for judges connecting over LAN), server uptime, total scores submitted, latest score activity feed, and currently open candidates. Includes a **Force Refresh All Clients** control.
- **Single-Session Security:** Enforces one active session per account—logging in from another device automatically invalidates the previous token and forces logout on the older socket connection.

### Flexible Contest & Scoring Management
- **Multi-Contest Support:** Manage multiple contests simultaneously (e.g., *Mr. & Ms.*, *King & Queen*), each with its own candidates and cover photo.
- **Judge-Voted & Admin-Scored Segments:** Combine criterion-based judge segments with direct admin-scored segments (e.g., *Popularity*, *Charity*).
- **Granular Open/Close Controls:** Open or close entire segments or individual candidates for judging at any point during the show, plus custom candidate display ordering.
- **Automated Image Optimization:** Contest and candidate images uploaded via the admin panel are automatically resized (max 800×800) and converted to `.webp` using `sharp`.

### Judge-Friendly Interface
- **Carousel (Spotlight) & Card Grid Modes:** Judges can score one candidate at a time in Carousel mode or switch to Card mode to view all candidates at once.
- **Unsaved Score Auto-Caching:** Unsubmitted score inputs are saved in `localStorage` so accidental refreshes do not lose progress.
- **Per-Candidate Score Locking:** Judges lock scores per candidate with built-in min/max validation (`5` to criterion `max_score`).

### Reporting, Awards & Backups
- **Official Awards & Public Page:** Create Major, Minor, and Special awards, assign winners, and display them on `/public-results.html`.
- **Full Tabulation Reports:** Filter by contest, branch, and Top N (`All`, `Top 3`, `Top 5`, `Top 10`). Export directly via **Print**, **PDF** (server-rendered via Puppeteer), or **Excel (`.xlsx`)**.
- **Backup & Restore:** Download a single `.zip` archive containing both the SQLite database (safely WAL-checkpointed) and the `uploads/` photo directory, and restore from either `.zip` or `.db`.

---

## Tech Stack

- **Backend:** Node.js, Express 5, Socket.IO 4
- **Database:** SQLite (`node:sqlite` built-in `DatabaseSync` in WAL mode with foreign keys enabled)
- **Authentication:** JSON Web Tokens (`jsonwebtoken`) + `bcryptjs`
- **Media & Files:** `multer`, `sharp`, `archiver`, `adm-zip`
- **Exports:** `puppeteer` (PDF generation), `xlsx` / SheetJS (Excel export)
- **Process Management:** `pm2`, `nodemon`
- **Frontend:** Vanilla HTML5, CSS3, JavaScript (ES6+)

---

## Prerequisites

- **Node.js `v22.5.0` or higher** (recommended **`v22.13+`** or **`v23+`**)
- **npm** (bundled with Node.js)

---

## Installation & Initial Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/MarkLawrenceArtistry/tabulation-refactored.git
   cd tabulation-refactored
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Initialize the SQLite database**
   This creates `./db/tabulation.db` with all required tables:
   ```bash
   npm run init
   ```
   > **Note:** `npm run init` drops and recreates all tables. It is automatically blocked if `NODE_ENV=production`.

4. **Create the `superadmin` account**
   Run the interactive CLI script and enter a password when prompted:
   ```bash
   npm run register
   ```
   This creates a user with username `superadmin` and role `superadmin`.

---

## Running the Application

### Development Mode
Runs with `nodemon` for automatic restarts on server changes:
```bash
npm run dev
```

### Production Mode (PM2)
Starts the server in production mode (`NODE_ENV=production`) via PM2:
```bash
npm run pm2
```

To stop or restart the PM2 process:
```bash
npm run pm2-stop
npm run pm2-restart
```

### Accessing the System
- **Local Machine:** `http://localhost:5015`
- **LAN / Other Devices (Judges & Displays):** Find your host machine's local IP address on the **System Monitoring** page (`/monitoring.html`) and connect via `http://<SERVER-IP>:5015`.

*(Default port is `5015`, configurable via the `PORT` environment variable.)*

---

## User Roles & Complete Usage Guide

The system has three authenticated roles (`superadmin`, `admin`, `judge`) plus a public results display. Logging in at `/login.html` redirects automatically based on role.

### 1. Superadmin: Initial Setup & Users
Sign in with your `superadmin` credentials. Only `superadmin` has access to **Manage Users** (`/manage-users.html`):
1. Open **Management → Manage Users** in the sidebar.
2. Create accounts for **Admins** (tabulators/organizers) and **Judges**.
3. You can edit usernames, roles, or reset passwords at any time. *(You cannot delete your own account or another superadmin.)*

### 2. Admin: Pre-Event Configuration
Sign in as an `admin` or `superadmin` to access the Admin Dashboard (`/dashboard.html`):

1. **Create Contests (`/dashboard.html`)**
   - Add each contest (e.g., *Mr. DCSA*, *Ms. DCSA*) with an optional banner/logo image.
2. **Configure Segments & Criteria (`/manage-segments.html`)**
   - Add **Segments** with a name, overall percentage weight, and type:
     - **Judge-Voted (`judge`):** Requires criteria. Check that the **Total** indicator reaches `100%` across all segments.
     - **Admin-Scored (`admin`):** No criteria needed (scored directly by admins).
   - Select each Judge-Voted segment and add its **Criteria** (name and weight/`max_score` %). Ensure each segment's criteria weights total `100%`.
   - Keep segments **Closed** until they are ready to be judged.
3. **Add Candidates (`/manage-candidates.html`)**
   - Select a contest and add candidates with their Name, Candidate Number, Branch, Course, Section, Year Level, and Photo.
   - Use the search bar to quickly locate and edit or delete candidates.
4. **Set Candidate Display Order & Status (`/manage-order.html`)**
   - Select a contest, set custom `Display Order` numbers, and toggle candidates `Open` or `Closed` (or use **Open All** / **Close All**), then click **Save All Changes**.
5. **Enter Admin-Scored Segments (`/special-scores.html`)** *(if applicable)*
   - Select a contest and enter scores (`0–100`) for any `admin`-type segments (e.g., Popularity, Charity), then click **Save All Scores**.

### 3. Judge: Scoring Workflow
Judges log in at `/login.html` and are directed to the **Judge Dashboard** (`/judge-dashboard.html`):

1. **Select a Segment:** Only segments currently set to `Open` by an admin appear on the dashboard.
2. **Score Candidates (`/judging-sheet.html`):**
   - Only candidates set to `Open` are displayed.
   - Use **View Carousel Mode** (one candidate spotlight at a time with Previous/Next buttons) or **View Card Mode** (grid of all candidates).
   - Filter by **Branch** or sort by **Official Order** / **Name**.
   - Enter scores for each criterion (minimum `5`, maximum = criterion weight `%`). Validation feedback appears at the top of each card.
   - Unsaved entries are automatically cached locally in the browser.
3. **Lock Scores:**
   - Click **Lock Scores** on a candidate's card and confirm. Locked scores are immediately saved and broadcast to the live tabulation engine.
   - Once all open candidates in the segment are locked, a completion modal redirects back to the Judge Dashboard.
4. **View Submitted Scores (`/view-scores.html`):**
   - Completed segments show a **View Submitted Scores** button so judges can review their locked scores and segment totals.

### 4. Admin: Live Event Control & Monitoring
During the live pageant:
- **Open/Close Segments:** Toggle segment statuses in **Manage Segments** (`/manage-segments.html`). Connected judges' dashboards update in real time.
- **Reveal/Hide Candidates:** Open candidates individually or in batches in **Order & Status** (`/manage-order.html`). Judges' sheets update live.
- **Track & Unlock Scores (`/judging-progress.html`):** Select a segment to see a live matrix of Judges vs. Candidates (`Pending` vs. `Unlock`). Clicking **Unlock** clears that judge's scores for that candidate and immediately unlocks their sheet.
- **Monitor Connections (`/monitoring.html`):** View connected users, server IP, uptime, total scores submitted, and open candidates. Click **Force Refresh All Clients** if you need all connected browsers to reload.
- **Live Tabulation (`/results.html`):** Displays the live animated Top-3 podium and Top-10 leaderboard per contest (with optional Branch filtering).
- **Inspect Raw Scores (`/manage-scores.html`):** Filter and inspect individual criterion scores submitted by contest, segment, and judge.

### 5. Post-Event: Awards, Reports & Backups
- **Manage Awards (`/awards.html`):** Create `Major`, `Minor`, or `Special` awards and assign winning candidates.
- **Public Winners Page (`/public-results.html`):** Unauthenticated page displaying all assigned award winners grouped by award type.
- **Printable & Exportable Reports (`/report.html`):**
  - Select Contest, optional Branch filter, and Top N (`All`, `Top 3`, `Top 5`, `Top 10`), then click **Generate**.
  - Export using **Print**, **Export as PDF**, or **Export as XLSX**.
- **Backup & Restore (`/backup.html`):**
  - **Backup:** Click **Download Database Backup** to download `tabulation_backup_<timestamp>.zip` containing `tabulation.db` and `uploads/`.
  - **Restore:** Upload a `.zip` backup (restores database and photos) or a `.db` file (restores database only). *Warning: Restoring overwrites all current data.*

---

## How Scoring & Tabulation Works

1. **Judge-Voted Segments:**
   - For each judge, their criterion scores for a candidate within a segment are **summed**:
     $$\text{Judge Segment Score} = \sum \text{Criterion Scores}$$
   - Those totals are **averaged** across all judges who scored that candidate in that segment:
     $$\text{Segment Score} = \text{AVG}(\text{Judge Segment Scores})$$
2. **Admin-Scored Segments:**
   - The score (`0–100`) entered in **Admin-Scored Segments** is used directly as the $\text{Segment Score}$.
3. **Final Candidate Score:**
   - Each segment score is multiplied by its segment weight and summed:
     $$\text{Final Score} = \sum \left(\text{Segment Score} \times \frac{\text{Segment Percentage}}{100}\right)$$
