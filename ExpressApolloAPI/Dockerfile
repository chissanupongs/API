# ใช้ Node.js LTS image
FROM node:20

# ตั้ง working directory
WORKDIR /app

# คัดลอก package.json และ package-lock.json จาก root
COPY package*.json ./

# ติดตั้ง dependencies
RUN npm install

# คัดลอก source code ทั้งหมด (รวม server/)
COPY . .

# เปิดพอร์ต 4000
EXPOSE 4000

# สั่งรันแอป (ถ้าไฟล์หลักคือ server/index.js)
CMD ["node", "server/index.js"]