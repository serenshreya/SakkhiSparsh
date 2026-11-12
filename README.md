# SakkhiSparsh 🌿

**AI-powered skin disease detection with Ayurvedic insights**

SakkhiSparsh is a full-stack web application that uses deep learning to detect skin diseases from uploaded images and provides clinical reports with Ayurvedic treatment recommendations. Built for patients and doctors with role-based dashboards.

---

## 🏗️ Project Structure

```
SakkhiSparsh/
├── client/                  # Next.js 14 frontend (TypeScript)
│   ├── src/
│   │   ├── app/             # App Router pages
│   │   │   ├── login/       # Authentication page
│   │   │   ├── upload/      # Image upload & scan
│   │   │   ├── patient/     # Patient scan report view
│   │   │   └── doctor/      # Doctor dashboard & scan review
│   │   ├── components/ui/   # Reusable UI components
│   │   ├── lib/             # Supabase client, types, constants
│   │   └── utils/           # Supabase middleware & helpers
│   └── public/              # Static assets
│
└── server/
    ├── inference_server/    # FastAPI ML inference server
    │   ├── main.py          # API endpoints for skin disease prediction
    │   ├── Dockerfile       # Docker container for deployment
    │   ├── requirements.txt # Python dependencies
    │   └── models/          # Place your trained .h5/.pt model here
    ├── kaggle_training/     # Model training scripts (Kaggle)
    │   ├── train.py         # Training pipeline
    │   ├── train.ipynb      # Jupyter notebook
    │   ├── class_mappings.py
    │   └── glcm_utils.py    # GLCM feature extraction utilities
    └── supabase/
        └── migrations/      # Database schema & RLS policies
            ├── 001_schema.sql
            ├── 002_rls_policies.sql
            ├── 003_storage.sql
            └── 004_seed_ayurveda.sql
```

---

## 🚀 Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14, TypeScript, TailwindCSS |
| Backend | FastAPI (Python) |
| Database | Supabase (PostgreSQL) |
| Auth | Supabase Auth |
| Storage | Supabase Storage |
| ML Model | TensorFlow / PyTorch (custom trained) |
| Deployment | Docker, Railway/Render (server), Vercel (client) |

---

## ⚙️ Getting Started

### 1. Clone the repo
```bash
git clone https://github.com/serenshreya/SakkhiSparsh.git
cd SakkhiSparsh
```

### 2. Set up the client (Next.js)
```bash
cd client
npm install
cp .env.example .env.local
# Fill in your Supabase credentials in .env.local
npm run dev
```

### 3. Set up the inference server (FastAPI)
```bash
cd server/inference_server
python -m venv .venv
.venv\Scripts\activate      # Windows
# source .venv/bin/activate  # Mac/Linux
pip install -r requirements.txt
# Place your trained model in the models/ folder
uvicorn main:app --reload --port 8000
```

### 4. Set up Supabase
- Create a project at [supabase.com](https://supabase.com)
- Run the SQL migrations in order from `server/supabase/migrations/`
- Copy your project URL and keys into `.env.local`

---

## 🔐 Environment Variables

### `client/.env.local`
```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your_supabase_publishable_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
INFERENCE_API_URL=http://localhost:8000
```

### `server/.env`
```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
INFERENCE_API_URL=http://localhost:8000
PORT=8000
```

> See `.env.example` files in each folder for templates.

---

## 👥 Roles

| Role | Access |
|---|---|
| **Patient** | Upload skin images, view own scan reports |
| **Doctor** | View all patient scans, add clinical notes |

---

## 📄 License

MIT License — feel free to use and contribute!
