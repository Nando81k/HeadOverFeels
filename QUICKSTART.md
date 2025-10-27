# Head Over Feels - Quick Start Guide

## 🚀 Get Started in 5 Minutes

### 1. Install Dependencies
```bash
npm install
```

### 2. Set Up Environment Variables
Create a `.env` file in the root directory:

```env
# Database
DATABASE_URL="file:./dev.db"

# Cloudinary (Sign up at cloudinary.com for free)
CLOUDINARY_CLOUD_NAME=your_cloud_name_here
CLOUDINARY_API_KEY=your_api_key_here
CLOUDINARY_API_SECRET=your_api_secret_here
```

### 3. Initialize Database
```bash
npx prisma migrate dev --name init
npx prisma generate
```

### 4. Run Development Server
```bash
npm run dev
```

### 5. Access Admin Panel
Open your browser and go to:
- **Homepage**: http://localhost:3000
- **Admin Dashboard**: http://localhost:3000/admin
- **Products**: http://localhost:3000/admin/products

---

## 📋 What You Can Do Now

### Create Your First Product
1. Go to http://localhost:3000/admin/products
2. Click "Add New Product"
3. Fill in the form:
   - **Name**: "Oversized Streetwear Hoodie"
   - **Description**: "Premium cotton hoodie with embroidered logo"
   - **Price**: 89.99
   - **Upload Images**: Drag and drop product photos
   - **Add Variants**: Size S, M, L, XL with inventory
4. Click "Publish Product"

### Manage Products
- **View All**: See your product catalog
- **Edit**: Update product details
- **Publish/Unpublish**: Control visibility
- **Delete**: Remove products

---

## 🎨 Get Cloudinary Credentials (Free)

1. Go to https://cloudinary.com
2. Sign up for a free account
3. Go to your Dashboard
4. Copy these values:
   - **Cloud Name**: Found at the top
   - **API Key**: Found under Account Details
   - **API Secret**: Click "Reveal" to see it
5. Add them to your `.env` file

---

## 🔍 Troubleshooting

### Database Issues
```bash
# Reset database
rm prisma/dev.db
npx prisma migrate dev --name init
```

### Build Errors
```bash
# Clear Next.js cache
rm -rf .next
npm run build
```

### Image Upload Not Working
- Check your Cloudinary credentials in `.env`
- Make sure CLOUDINARY_CLOUD_NAME, API_KEY, and API_SECRET are correct
- Restart your dev server after adding credentials

---

## 📚 Learn More

- [Next.js Documentation](https://nextjs.org/docs)
- [Prisma Documentation](https://www.prisma.io/docs)
- [Cloudinary Documentation](https://cloudinary.com/documentation)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)

---

## 🎯 What's Next?

Now that your admin panel is working, you can:

1. **Add more products** - Build your catalog
2. **Test image uploads** - Ensure Cloudinary works
3. **Explore the API** - Check out `/api/products`
4. **Build customer pages** - Create the shopping experience

---

**Need Help?** Check `ADMIN_IMPLEMENTATION.md` for detailed documentation!