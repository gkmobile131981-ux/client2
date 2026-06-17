# GK Repair System: API Specification

The backend service is built using Node.js + Express and communicates via JSON payloads (except where multipart file uploads are indicated).

## Authentication & Headers
All endpoints except `/api/auth/register-owner` and `/api/auth/login` require authentication via a JWT Bearer token in the request header:
```http
Authorization: Bearer <accessToken>
```

---

## 1. Authentication & Shop Management (`/api/auth`)

### POST `/api/auth/register-owner`
Registers a new shop owner and seeds their initial store record.
- **Request Body**:
  ```json
  {
    "name": "Jane Owner",
    "email": "owner@example.com",
    "password": "strongpassword123",
    "shopName": "Jane Repair Center",
    "shopAddress": "456 Main Street",
    "shopPhone": "1234567890"
  }
  ```
- **Success Response (201 Created)**:
  ```json
  {
    "accessToken": "eyJhbGciOi...",
    "refreshToken": "ref_eyJhb...",
    "user": {
      "id": "e30b6567-27b0-466d-a602-d9be34d5218d",
      "name": "Jane Owner",
      "email": "owner@example.com",
      "role": "owner",
      "staff_id": null,
      "shop_id": "8c0a87a2-f8c6-48c0-bc62-7de1c0e3a6c9",
      "is_active": true,
      "created_at": "2026-06-17T12:00:00Z"
    },
    "shop": {
      "id": "8c0a87a2-f8c6-48c0-bc62-7de1c0e3a6c9",
      "name": "Jane Repair Center",
      "address": "456 Main Street",
      "phone": "1234567890",
      "owner_id": "e30b6567-27b0-466d-a602-d9be34d5218d"
    }
  }
  ```

### POST `/api/auth/login`
Authenticates a user (owner or staff) and starts a session.
- **Request Body**:
  ```json
  {
    "email": "owner@example.com",
    "password": "strongpassword123"
  }
  ```
- **Success Response (200 OK)**:
  ```json
  {
    "accessToken": "eyJhbGciOi...",
    "refreshToken": "ref_eyJhb...",
    "user": {
      "id": "e30b6567-27b0-466d-a602-d9be34d5218d",
      "name": "Jane Owner",
      "email": "owner@example.com",
      "role": "owner",
      "staff_id": null,
      "shop_id": "8c0a87a2-f8c6-48c0-bc62-7de1c0e3a6c9"
    }
  }
  ```

### POST `/api/auth/create-staff` (Owner Only)
Creates a new staff technician under the owner's shop, generating a sequential Staff ID (`GK001`, `GK002`...).
- **Request Body**:
  ```json
  {
    "name": "Alex Tech",
    "email": "alex@gkrepair.com",
    "password": "technicianpassword123"
  }
  ```
- **Success Response (201 Created)**:
  ```json
  {
    "message": "Staff user created successfully",
    "user": {
      "id": "f51276a2-bc45-42bc-9d0a-1a89b0cc8bc1",
      "name": "Alex Tech",
      "email": "alex@gkrepair.com",
      "role": "staff",
      "staff_id": "GK001",
      "shop_id": "8c0a87a2-f8c6-48c0-bc62-7de1c0e3a6c9"
    }
  }
  ```

### GET `/api/auth/me`
Retrieves profile data of the logged-in user.
- **Success Response (200 OK)**:
  ```json
  {
    "user": {
      "id": "e30b6567-27b0-466d-a602-d9be34d5218d",
      "email": "owner@example.com",
      "role": "owner",
      "shop_id": "8c0a87a2-f8c6-48c0-bc62-7de1c0e3a6c9"
    }
  }
  ```

### GET `/api/auth/staff` (Owner Only)
Lists all staff registered for the owner's shop.
- **Success Response (200 OK)**:
  ```json
  [
    {
      "id": "f51276a2-bc45-42bc-9d0a-1a89b0cc8bc1",
      "name": "Alex Tech",
      "email": "alex@gkrepair.com",
      "role": "staff",
      "staff_id": "GK001",
      "is_active": true
    }
  ]
  ```

### PUT `/api/auth/staff/:id/toggle` (Owner Only)
Deactivates or reactivates a staff member's access.
- **Success Response (200 OK)**:
  ```json
  {
    "message": "Staff status updated successfully",
    "user": { "id": "f51276a2", "is_active": false }
  }
  ```

---

## 2. Customer Management (`/api/customers`)

### GET `/api/customers`
Lists all active customers in the shop. Supports pagination and searches.
- **Query Parameters**:
  - `page` (optional, default: `1`)
  - `limit` (optional, default: `10`)
  - `search` (optional, filters by name or phone)
- **Success Response (200 OK)**:
  ```json
  {
    "customers": [
      {
        "id": "b328a6f4-a0c4-4b50-9c1c-96947bc188b0",
        "name": "John Doe",
        "phone": "5551112222",
        "address": "12 High Road",
        "photo_url": "https://...",
        "repairsCount": 3,
        "lastRepairDate": "2026-06-15T09:30:00Z"
      }
    ],
    "pagination": { "page": 1, "limit": 10, "total": 1, "pages": 1 }
  }
  ```

### POST `/api/customers`
Registers a new customer. Supports optional profile image upload.
- **Request Format**: `multipart/form-data`
- **Request Body Fields**:
  - `name`: string (min 2 chars)
  - `phone`: string (min 5 chars)
  - `address`: string (optional)
  - `photo`: file (optional, image/png or image/jpeg, max 5MB)
- **Success Response (201 Created)**:
  ```json
  {
    "message": "Customer registered successfully",
    "customer": {
      "id": "b328a6f4-a0c4-4b50-9c1c-96947bc188b0",
      "name": "John Doe",
      "phone": "5551112222",
      "address": "12 High Road",
      "photo_url": "https://..."
    }
  }
  ```

### GET `/api/customers/:id`
Retrieves a customer's detailed profile, registered hardware devices, and full repair ticket history.
- **Success Response (200 OK)**:
  ```json
  {
    "customer": { "id": "b328a6f4", "name": "John Doe", "phone": "5551112222" },
    "devices": [
      { "id": "d1", "brand": "Apple", "model": "iPhone 15" }
    ],
    "repairs": [
      { "id": "r1", "job_number": "GK-20260615-001", "status": "ready" }
    ]
  }
  ```

### DELETE `/api/customers/:id` (Soft Delete)
Soft-deletes a customer record from lists by setting `is_active = false`.
- **Success Response (200 OK)**:
  ```json
  {
    "message": "Customer deactivated successfully"
  }
  ```

---

## 3. Repair Ticket Lifecycles (`/api/repairs`)

### GET `/api/repairs`
Lists repair tickets. Owners see all shop tickets; technicians only see tickets assigned to them.
- **Query Parameters**:
  - `page`, `limit`
  - `search` (matches job number or customer name)
  - `status` (filters by status: `pending`, `repairing`, `ready`, `delivered`, `cancelled`)
  - `staffId` (optional, Owner-only filter by technician)
  - `dateStart`, `dateEnd` (optional date ranges)
- **Success Response (200 OK)**:
  ```json
  {
    "repairs": [
      {
        "id": "a908234c-12b4...",
        "job_number": "GK-20260617-001",
        "status": "pending",
        "estimate": 250,
        "advance": 50,
        "device": { "brand": "Google", "model": "Pixel 8" },
        "customer": { "name": "John Doe" },
        "assigned_staff": { "id": "tech1", "name": "Alex Tech" }
      }
    ],
    "pagination": { "page": 1, "limit": 10, "total": 1, "pages": 1 }
  }
  ```

### POST `/api/repairs`
Creates a new repair ticket and registers a device. Supports uploading photos of the hardware condition.
- **Request Format**: `multipart/form-data`
- **Request Body Fields**:
  - `customerId`: string (valid UUID)
  - `brand`: string, `model`: string
  - `imei`: string (optional)
  - `problem`: string (min 5 chars)
  - `quality`: string (`good` | `fair` | `poor` | `damaged`)
  - `physicalDamage`: string (optional)
  - `estimate`: number, `advance`: number
  - `deliveryDate`: string (format `YYYY-MM-DD`, optional)
  - `staffId`: string (valid UUID, optional)
  - `notes`: string (optional)
  - `frontPhoto`: file (optional image)
  - `backPhoto`: file (optional image)
- **Success Response (201 Created)**:
  ```json
  {
    "message": "Repair order created successfully",
    "repair": {
      "id": "e3b0c442...",
      "job_number": "GK-20260617-001",
      "status": "pending",
      "estimate": 250,
      "advance": 50,
      "notes": null
    }
  }
  ```

### GET `/api/repairs/:id`
Fetches full details of a repair ticket, including assigned technician profile and chronological status change timeline history.
- **Success Response (200 OK)**:
  ```json
  {
    "repair": {
      "id": "e3b0c442...",
      "job_number": "GK-20260617-001",
      "status": "pending",
      "estimate": 250,
      "advance": 50,
      "device": { "brand": "Apple", "model": "iPhone 15" },
      "customer": { "name": "John Doe", "phone": "5551112222" },
      "history": [
        {
          "id": "h1",
          "old_status": "pending",
          "new_status": "pending",
          "note": "Repair order initialized",
          "created_at": "2026-06-17T12:00:00Z",
          "changed_by_user": { "name": "Jane Owner" }
        }
      ]
    }
  }
  ```

### PUT `/api/repairs/:id/status`
Updates repair status and pushes a status transition record into the timeline.
- **Request Body**:
  ```json
  {
    "status": "repairing",
    "notes": "Opened back casing, replacing internal battery component"
  }
  ```
- **Success Response (200 OK)**:
  ```json
  {
    "message": "Repair status updated successfully",
    "repair": { "id": "e3b0c442", "status": "repairing" }
  }
  ```

### POST `/api/repairs/:id/deliver`
Closes a repair order. Collects receiver information, canvas signatures, and webcam photographs.
- **Request Body**:
  ```json
  {
    "receiverName": "John Doe",
    "receiverPhone": "5551112222",
    "receivedBy": "customer",
    "notes": "Device handed off in fully working condition",
    "signatureDataUrl": "data:image/png;base64,iVBOR...",
    "receiverPhotoUrl": "https://..." // if pre-uploaded, or base64 photo
  }
  ```
- **Success Response (200 OK)**:
  ```json
  {
    "message": "Repair order delivered successfully",
    "repair": { "id": "e3b0c442", "status": "delivered", "delivered_at": "2026-06-17T12:45:00Z" }
  }
  ```

### GET `/api/repairs/:id/receipt`
Generates and downloads a vector PDF receipt, complete with shop logo, billing records, device specifications, and signatures.
- **Success Response (200 OK)**:
  - **Headers**: `Content-Type: application/pdf`
  - **Body**: Binary PDF stream.

---

## 4. Dashboard & Reports Analytics (`/api/dashboard`, `/api/reports`)

### GET `/api/dashboard`
Loads the shop statistics.
- Owners see shop-wide metrics. Staff see only metrics for tickets assigned to them.
- **Success Response (200 OK)**:
  ```json
  {
    "todayStats": {
      "newRepairs": 2,
      "delivered": 1,
      "revenueCollected": 350,
      "pendingDeliveries": 4,
      "totalOutstandingBalance": 1250
    },
    "repairsByStatus": {
      "pending": 2,
      "repairing": 3,
      "ready": 4,
      "delivered": 15,
      "cancelled": 1
    },
    "recentRepairs": [
      { "id": "r1", "job_number": "GK-20260617-001", "status": "pending" }
    ],
    "monthlyRevenue": [
      { "month": "2026-06", "revenue": 1450, "repairsCount": 8 }
    ],
    "topDeviceBrands": [
      { "brand": "Apple", "count": 12 },
      { "brand": "Samsung", "count": 8 }
    ]
  }
  ```

### GET `/api/reports/repairs` (Owner Only)
Returns detailed repair list for CSV export.
- **Query Parameters**:
  - `from` (required, e.g. `2026-01-01`)
  - `to` (required, e.g. `2026-06-30`)
  - `status` (optional, e.g. `all` or specific status)
  - `staffId` (optional)
- **Success Response (200 OK)**: JSON list of matching tickets.

### GET `/api/reports/staff-performance` (Owner Only)
Retrieves efficiency stats and revenue collected per technician.
- **Query Parameters**:
  - `from` (required), `to` (required)
- **Success Response (200 OK)**:
  ```json
  [
    {
      "staff_name": "Alex Tech",
      "staff_id": "GK001",
      "assigned_count": 8,
      "delivered_count": 6,
      "avg_turnaround_days": 1.4,
      "total_estimate_collected": 950
    }
  ]
  ```

### GET `/api/reports/aging` (Owner Only)
Lists active, outstanding tickets sorted by their open duration in days.
- **Success Response (200 OK)**:
  ```json
  [
    {
      "id": "r1",
      "job_number": "GK-20260601-002",
      "status": "pending",
      "age_in_days": 16,
      "brand": "OnePlus",
      "model": "11",
      "staff_name": "Alex Tech"
    }
  ]
  ```
