import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "src") } },
  // الكود الأصلي كان يقرأ عنوان الخادم من هذا المتغير؛ الملفات الآن على النطاق نفسه.
  define: { "process.env.REACT_APP_BACKEND_URL": JSON.stringify("") },
});
