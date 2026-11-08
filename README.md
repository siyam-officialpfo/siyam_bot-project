# NU 404 BOT Official Portal

Official documentation, downloads, reports, announcements and support portal.

## Technology

- React
- Vite
- Supabase Database
- Supabase Authentication
- Supabase Storage
- Render Static Hosting

## Local development

Install dependencies:

npm install

Start development server:

npm run dev

Build for production:

npm run build

## Supabase setup

1. Create a Supabase project.
2. Open SQL Editor.
3. Run the complete file: supabase/schema.sql
4. Copy your Project URL.
5. Copy your Publishable Key (or legacy anon key).
6. Add them as environment variables.

Environment variables:

VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY

Never put a Supabase service_role or secret key in frontend code.

## Create the first administrator

1. Open Supabase Dashboard.
2. Go to Authentication > Users.
3. Add a user with your administrator email and password.
4. Open SQL Editor.
5. Run this query, replacing the email:

UPDATE public.profiles
SET role = 'admin'
WHERE email = 'YOUR_ADMIN_EMAIL';

6. Sign in through the Admin Login page.

Do not share the administrator password.

## Render deployment

1. Connect this GitHub repository to Render.
2. Select Static Site.
3. Build command: npm install && npm run build
4. Publish directory: dist
5. Add environment variables:
   - VITE_SUPABASE_URL
   - VITE_SUPABASE_ANON_KEY
6. Deploy the site.

The public/_redirects file supports client-side routes.

## File storage

Files uploaded through the Admin Dashboard are stored in the
Supabase Storage bucket named portal-files.

The bucket is public for downloads. Only administrators can upload,
update or delete files.

Maximum configured upload size: 50 MB.

## Security

- Row Level Security is enabled.
- Only administrator profiles can manage resources.
- Only administrators can read support tickets.
- Public users can submit support requests.
- Never upload passwords, session cookies, access tokens,
  Facebook account data or private environment files.
