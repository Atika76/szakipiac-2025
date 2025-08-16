SZAKIPIAC 2025 – USER GUIDE

1. Files:

- index.html ............. Homepage, search, ad listing
- upload.html ............ Ad upload, photos, package selection, payment (if applicable)
- admin.html ............. Admin approval/deletion, only for admin emails
- auth.html .............. Registration and login (Supabase Auth)
- contact.html ........... Contact details, form
- about.html ............. About Us page
- header.js ............... Header, menu, logo, ad banner for all pages
- supabase.js ............. Here you need to enter your own Supabase URL and key!
- style.css ............... Shared style, for all pages
- logo.png ................ Your own logo (can be replaced)
- ad1.png ................. Your own ad image (can be replaced)

2. SUPABASE SETUP

In the supabase.js file, you need to fill in the following two lines with your project data:
const SUPABASE_URL = "https://...supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1...";

You can find this in Supabase > Settings > API menu.

3. IMPORTANT!
The <head> section of all your main .html pages includes:
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js"></script>
<script src="header.js"></script>
<script src="supabase.js"></script>
<link rel="stylesheet" href="style.css">

4. HOW TO START?

- On GitHub Pages, Netlify, or any static hosting, just copy all files into one folder.
- If you're viewing it offline, the Supabase-based functions will only work if you have an internet connection and have correctly entered your data in supabase.js.
- If any function (registration, login, upload, admin) is not working, check:
  – are the Supabase details correct in supabase.js
  – is it loaded on every page
  – are the tables and columns correctly set up in Supabase (e.g., 'hirdetesek' table, 'email' column).