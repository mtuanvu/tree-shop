const express = require('express');
const multer = require('multer');
const path = require('path');
const admin = require('firebase-admin');
const fs = require('fs');
const cors = require('cors');
require('dotenv').config();

const app = express();

// Cấu hình CORS
app.use(cors({
  origin: 'http://localhost:8080',
  methods: 'GET,POST,PUT,DELETE',
  allowedHeaders: '*'
}));

app.use(express.json()); // Để đọc dữ liệu JSON từ request body

// Khởi tạo Firebase Admin SDK từ biến môi trường
admin.initializeApp({
  credential: admin.credential.cert({
    private_key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    client_email: process.env.FIREBASE_CLIENT_EMAIL,
    project_id: process.env.FIREBASE_PROJECT_ID,
  }),
  storageBucket: `${process.env.FIREBASE_PROJECT_ID}.appspot.com`
});

const db = admin.firestore();
const bucket = admin.storage().bucket(); // Firebase Storage bucket

// Kiểm tra và tạo thư mục 'uploads' nếu chưa tồn tại
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}

// Multer setup để upload ảnh
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, './uploads/'),
  filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname)) 
});
const upload = multer({ storage });

// Tạo cây mới và upload ảnh lên Firebase Storage
app.post('/trees', upload.single('image'), async (req, res) => {
  try {
    const { name, description } = req.body;
    const file = req.file;

    if (!file) {
      return res.status(400).send('No file uploaded.');
    }

    const filePath = path.join(__dirname, 'uploads', file.filename);
    const fileBuffer = fs.readFileSync(filePath);

    const blob = bucket.file(file.filename);
    const blobStream = blob.createWriteStream({
      resumable: false,
    });

    blobStream.on('error', (err) => {
      console.error('Error uploading file:', err);
      res.status(500).send({ message: 'Error uploading image' });
    });

    blobStream.on('finish', async () => {
      const imageUrl = `https://storage.googleapis.com/${bucket.name}/${file.filename}`;
      await blob.makePublic();

      // Lưu thông tin cây vào Firestore
      const docRef = await db.collection('trees').add({
        name,
        description,
        imageUrl
      });

      fs.unlinkSync(filePath); // Xóa file tạm sau khi upload xong

      res.status(201).send({ id: docRef.id, name, description, imageUrl });
    });

    blobStream.end(fileBuffer);
  } catch (error) {
    console.error('Error creating tree:', error);
    res.status(500).send('Error creating tree: ' + error.message);
  }
});

// Lấy danh sách cây
app.get('/trees', async (req, res) => {
  try {
    const snapshot = await db.collection('trees').get();
    const trees = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.status(200).json(trees);
  } catch (error) {
    console.error('Error fetching trees:', error);
    res.status(500).send('Error fetching trees: ' + error.message);
  }
});

// Cập nhật thông tin cây (bao gồm cả hình ảnh và xóa ảnh cũ)
app.put('/trees/:id', upload.single('image'), async (req, res) => {
  try {
    const { name, description } = req.body;
    const file = req.file;
    let imageUrl;

    // Lấy thông tin cây hiện tại từ Firestore để xóa ảnh cũ
    const treeDoc = await db.collection('trees').doc(req.params.id).get();
    if (!treeDoc.exists) {
      return res.status(404).send('Tree not found');
    }
    const currentData = treeDoc.data();
    const oldImageUrl = currentData.imageUrl;

    if (file) {
      const filePath = path.join(__dirname, 'uploads', file.filename);
      const fileBuffer = fs.readFileSync(filePath);

      const blob = bucket.file(file.filename);
      const blobStream = blob.createWriteStream({
        resumable: false,
      });

      blobStream.on('error', (err) => {
        console.error('Error uploading file:', err);
        res.status(500).send({ message: 'Error uploading image' });
      });

      blobStream.on('finish', async () => {
        imageUrl = `https://storage.googleapis.com/${bucket.name}/${file.filename}`;
        await blob.makePublic();

        fs.unlinkSync(filePath);

        // Xóa ảnh cũ trong Firebase Storage
        if (oldImageUrl) {
          const oldFileName = oldImageUrl.split('/').pop();
          await bucket.file(oldFileName).delete();
        }

        // Cập nhật URL ảnh mới trong Firestore
        const updatedData = { name, description, imageUrl };
        await db.collection('trees').doc(req.params.id).update(updatedData);
        res.status(200).send({ message: 'Tree updated successfully', imageUrl });
      });

      blobStream.end(fileBuffer);
    } else {
      // Nếu không có file mới, chỉ cập nhật tên và mô tả
      const updatedData = { name, description };
      await db.collection('trees').doc(req.params.id).update(updatedData);
      res.status(200).send({ message: 'Tree updated successfully' });
    }

  } catch (error) {
    console.error('Error updating tree:', error);
    res.status(500).send('Error updating tree: ' + error.message);
  }
});

// Xóa cây
app.delete('/trees/:id', async (req, res) => {
  try {
    const treeDoc = await db.collection('trees').doc(req.params.id).get();
    if (!treeDoc.exists) {
      return res.status(404).send('Tree not found');
    }

    const treeData = treeDoc.data();
    const imageUrl = treeData.imageUrl;

    // Xóa ảnh từ Firebase Storage
    if (imageUrl) {
      const fileName = imageUrl.split('/').pop();
      await bucket.file(fileName).delete();
    }

    // Xóa tài liệu trong Firestore
    await db.collection('trees').doc(req.params.id).delete();
    res.status(200).send('Tree deleted successfully');
  } catch (error) {
    console.error('Error deleting tree:', error);
    res.status(500).send('Error deleting tree: ' + error.message);
  }
});

// Chạy server với port online hoặc 3000 local
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running on port ${PORT}`);
});
